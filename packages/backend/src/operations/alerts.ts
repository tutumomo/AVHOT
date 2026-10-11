// Operations alerts. The person reading them is the site owner, not an engineer: each
// message says what readers see, whether it heals by itself and what, if anything, the owner must do.
//   now   — readers are affected and it has not healed: sent at once, repeated hourly, recovery reported.
//   today — money at risk or only the owner can act: sent at once, repeated at most daily, recovery reported.
//   later — other follow-ups: one 09:00 message a day, meant to be handed to the AI.
// A site's responder (modules.ts) filters findings for the owner, preserving repeat and recovery
// tracking for messages it returns and replacing the default digest policy.
// Delivery goes through sendAlert (ops chat, internal-chat fallback; off unless FEISHU_INTERNAL_ENABLED).
import { addDays, beijingAt, beijingDate, isValidDate } from "@aihot/contracts/time";
import { ALERTS, EDITION_TIMES } from "@aihot/site";
import { sql } from "../db.ts";
import { beijingDay, beijingStamp, duration, formatAlert, formatRecovery, sendAlert, type Finding, type Level } from "../notify/feishu.ts";
import { stepsOnService } from "../editorial/models.ts";
import { backupConfigured } from "./backup.ts";
import { GROUPING_WARN_AFTER_MS, waitingSelectedNews } from "./grouping.ts";
import { upstreamFindings } from "../media/upstream.ts";
import { responder, serverModules } from "../modules.ts";
import { sourceHealth, sourceHealthList } from "../sources/health.ts";

const REPEAT_MS: Record<Exclude<Level, "later">, number> = { now: 3600_000, today: 24 * 3600_000 };

// Valves default off: read at call time, only an explicit "true" turns them on.
const collecting = () => process.env.COLLECT_ENABLED === "true";
const modelsOn = () => process.env.MODEL_CALLS_ENABLED === "true";
/**
 * How long the site may go without a new article before it counts as stalled (ALERT_QUIET_MINUTES, else
 * the site's own setting; small source lists are quieter). At most a day: the check looks one day back.
 */
const QUIET_MINUTES = Math.min(Number(process.env.ALERT_QUIET_MINUTES || ALERTS.quietMinutes), 1440);

/** Everything wrong right now, with its level. */
export async function collectFindings(now = Date.now()): Promise<Finding[]> {
  const out: Finding[] = [];

  // Readers affected now
  // Content flow, judged by outcome: whatever broke (worker, egress proxy, models, queues), readers see
  // a site that stops changing. Skipped for 20 minutes after the worker starts, and where the valves are off.
  const [hb] = await sql<{ value: { startedAt?: string } }[]>`SELECT value FROM settings WHERE key = 'heartbeat.worker'`;
  const settled = !hb?.value.startedAt || now - Date.parse(hb.value.startedAt) > 20 * 60_000;
  if (settled && collecting()) {
    const [last] = await sql<{ at: Date | null }[]>`SELECT max(a.discovered_at) AS at FROM articles a
      JOIN sources s ON s.id = a.source_id WHERE s.participation_mode = 'editorial' AND a.discovered_at > now() - interval '1 day'`;
    if (!last?.at || now - last.at.getTime() > QUIET_MINUTES * 60_000) {
      // A site without an enabled source has nothing to collect.
      const [anySource] = await sql`SELECT 1 FROM sources WHERE enabled AND participation_mode = 'editorial' LIMIT 1`;
      if (anySource) {
        out.push({
          key: "content.collect",
          level: "now",
          title: "網站停止收錄新文章",
          impact: last?.at ? `讀者看不到新文章：最後一篇收錄於 ${beijingStamp(last.at)}` : "讀者看不到新文章：一天內沒有收錄任何文章",
          heals: ALERTS.usualFlow ? `沒有，${ALERTS.usualFlow}` : "沒有",
          action: "儘快發起一次維護處理",
          detail: `editorial articles.discovered_at 超過 ${QUIET_MINUTES} 分鐘沒有新值（熱度訊號單獨評估）；查 sources.schedule、出網代理與採集失敗`,
          since: last?.at ?? undefined,
        });
      }
    }
  }
  if (settled && collecting() && modelsOn()) {
    const waiting = (await waitingSelectedNews()).filter((item) => now - item.since.getTime() >= GROUPING_WARN_AFTER_MS);
    if (waiting.length) {
      const manual = waiting.filter((item) => item.recovery === "manual").length;
      const receipt = waiting.some((item) => item.recovery === "receipt");
      out.push({
        key: "content.grouping",
        level: "now",
        title: "有精選新聞卡在去重確認，暫未釋出",
        impact: `${waiting.length} 條已達到精選條件的新聞等待確認超過 10 分鐘，還沒進入精選，讀者可能晚看到這些更新`,
        heals: manual ? `${manual} 條需要人工處理後才能恢復${manual < waiting.length ? "；其餘仍在自動恢復" : ""}`
          : receipt ? "仍在等待自動恢復；付費結果未知的請求會在 30 分鐘後自動放行一次" : "還會自動重試，但等待已經超過正常範圍",
        action: manual ? "轉給 AI 處理；結果未知的付費請求需先核對計費與結果，再決定是否放行" : "轉給 AI 檢查等待原因，避免繼續積壓",
        detail: waiting.slice(0, 8).map((item) => `${item.articleId}（${duration(now - item.since.getTime())}）${item.receiptId ? ` 回執 #${item.receiptId}` : ""}${item.error ? `：${item.error.slice(0, 120)}` : ""}`).join("；"),
        since: waiting[0]!.since,
      });
    }
    const [p] = await sql<{ waiting: number; oldest: Date | null; failed: number }[]>`
      SELECT count(*) FILTER (WHERE processing_state = 'new' AND discovered_at < now() - interval '2 hours')::int AS waiting,
             min(discovered_at) FILTER (WHERE processing_state = 'new') AS oldest,
             count(*) FILTER (WHERE processing_state = 'failed' AND discovered_at > now() - interval '3 hours')::int AS failed
      FROM articles WHERE processing_state IN ('new', 'failed') AND discovered_at > now() - interval '2 days'`;
    if (p!.waiting >= 10 || p!.failed >= 20) {
      const errors = await sql<{ error: string; n: number }[]>`
        SELECT left(coalesce(processing_error, '（無）'), 120) AS error, count(*)::int AS n FROM articles
        WHERE processing_state IN ('new', 'failed') AND discovered_at > now() - interval '3 hours' AND processing_error IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 3`;
      out.push({
        key: "content.process",
        level: "now",
        title: "新內容卡住了，進不了網站",
        impact: [p!.waiting >= 10 && `${p!.waiting} 篇新文章等了 2 小時以上還沒處理完`, p!.failed >= 20 && `最近 3 小時 ${p!.failed} 篇新文章處理失敗`]
          .filter(Boolean)
          .join("；") + "，精選和熱點會缺內容",
        heals: p!.waiting >= 10 ? "服務恢復後會自動補處理" : "不會，需要修好後重新處理這些文章",
        action: "轉給 AI 處理",
        detail: errors.map((e) => `${e.error}（${e.n}）`).join("；") || "沒有記錄錯誤",
        since: p!.waiting >= 10 && p!.oldest ? p!.oldest : undefined,
      });
    }
    out.push(...await dailyReportFindings(now));
  }

  // Money, and things only the owner can do
  out.push(...(await providerFindings()));

  // Content-group pushes the Feishu webhook refused (a removed bot, a changed address); nothing resends them.
  const [refused] = await sql<{ n: number; target: string | null; response: string | null }[]>`
    SELECT count(*)::int AS n, max(t.note) AS target, left(max(d.response), 200) AS response FROM deliveries d JOIN notify_targets t ON t.key = d.target_key
    WHERE d.status = 'failed' AND d.updated_at > now() - interval '1 day'`;
  if (refused!.n > 0) {
    out.push({
      key: "deliveries.failed",
      level: "today",
      title: "飛書內容群有推送沒發出去",
      impact: `過去 24 小時 ${refused!.n} 條通知沒進${refused!.target ?? "內容群"}`,
      heals: "不會自動重發",
      action: "轉給 AI 處理；如果推送機器人被移出了群，需要你把它加回去",
      detail: refused!.response ?? "",
    });
  }

  if (backupConfigured()) {
    const [b] = await sql<{ value: { at: string; uploaded: boolean; filesError?: string } }[]>`SELECT value FROM settings WHERE key = 'backup.last'`;
    // A failed archive updates backup.last too. Reuse the run history so repeated failures cannot
    // reset the age; before the first success, count from the first attempt rather than from now.
    const [runs] = await sql<{ last_ok: Date | null; first_attempt: Date | null }[]>`
      SELECT max(finished_at) FILTER (WHERE status = 'ok') AS last_ok, min(started_at) AS first_attempt
      FROM job_runs WHERE job = 'ops.backup'`;
    const lastOk = Math.max(runs?.last_ok?.getTime() ?? 0, b?.value.uploaded ? Date.parse(b.value.at) : 0);
    const since = lastOk || runs?.first_attempt?.getTime() || now;
    const age = now - since;
    const state = b?.value.filesError ? `資料庫已上傳，附件打包失敗：${b.value.filesError}` : b?.value.uploaded === false ? "未上傳" : "";
    if (age > 50 * 3600_000) {
      out.push({
        key: "backup.failed",
        level: "today",
        title: "資料庫備份連續兩天沒成功",
        impact: lastOk ? `萬一伺服器出事，最近 ${duration(age)} 的資料可能無法完整恢復` : "還沒有成功的完整備份，伺服器出事時可能無法恢復資料",
        heals: "不會",
        action: "轉給 AI 處理",
        detail: `${lastOk ? "最近一次成功" : "首次備份嘗試"} ${beijingStamp(since)}${state ? `；${state}` : ""}；看 ops.backup 的執行記錄`,
        since: new Date(since),
      });
    } else if (!b || !b.value.uploaded || age > 30 * 3600_000) {
      out.push({ key: "backup.stale", level: "later", title: "資料庫備份超過一天沒成功", detail: b ? `最近一次 ${beijingStamp(b.value.at)}${state ? `（${state}）` : ""}；看 ops.backup` : "還沒有成功的備份記錄" });
    }
  }

  out.push(...(await upstreamFindings(now)));

  // What the site's modules find.
  for (const m of serverModules()) if (m.alerts) out.push(...(await m.alerts(now)));

  // Follow-ups
  if (collecting()) {
    for (const group of await sourceHealth(now)) {
      if (group.failing.length) out.push({
        key: `sources.failing.${group.mode}`, level: "later", title: `${group.name}有 ${group.failing.length} 個信源連續抓取失敗`,
        detail: sourceHealthList(group.failing, s => `連續失敗 ${s.fail_count} 次${s.last_error ? `，${s.last_error}` : ""}`) + "；轉給 AI 檢查抓取錯誤",
      });
      if (group.unstable.length) out.push({
        key: `sources.unstable.${group.mode}`, level: "later", title: `${group.name}有 ${group.unstable.length} 個信源反覆抓取失敗`,
        detail: sourceHealthList(group.unstable, s => `近 7 天失敗 ${s.failed}/${s.runs} 次`) + "；即使最近成功也需檢查，避免繼續漏收",
      });
      if (group.silent.length) out.push({
        key: `sources.silent.${group.mode}`, level: "later", title: `${group.name}有 ${group.silent.length} 個信源 7 天未發現新內容`,
        detail: sourceHealthList(group.silent, s => `近 7 天 ${s.runs} 次抓取、0 條新發現`) + "；需對照原站，區分低頻更新與採集失效",
      });
      if (group.quality.length) out.push({
        key: `sources.quality.${group.mode}`, level: "later", title: `${group.name}有 ${group.quality.length} 個信源需要核實文章質量`,
        detail: sourceHealthList(group.quality, s => `近 7 天缺釋出時間 ${s.undated} 篇、反覆修訂 ${s.repeated} 篇`) + "；缺時間可能讓新聞按歷史文章處理，反覆修訂需核對正文是否混入變化內容",
      });
      if (group.detailFailures.length) out.push({
        key: `sources.details.${group.mode}`, level: "later", title: `${group.name}有 ${group.detailFailures.length} 個信源詳情補全失敗`,
        detail: sourceHealthList(group.detailFailures, s => `近 7 天 ${s.detail_failures} 次`) + "；檢視抓取記錄中的詳情地址與錯誤",
      });
    }
  }
  const [r] = await sql<{ receipts: number; services: string | null; deliveries: number }[]>`
    SELECT (SELECT count(*)::int FROM receipts WHERE status = 'unknown') AS receipts,
           (SELECT string_agg(DISTINCT service || '/' || purpose, '、') FROM receipts WHERE status = 'unknown') AS services,
           (SELECT count(*)::int FROM deliveries WHERE status = 'unknown') AS deliveries`;
  if (r!.receipts > 0) {
    out.push({ key: "receipts.unknown", level: "later", title: `${r!.receipts} 個付費請求的結果尚未確認`, detail: `${r!.services}；可能影響內容處理，後臺“執行”頁檢視影響；自動恢復後仍未知的請求需核對後放行` });
  }
  if (r!.deliveries > 0) out.push({ key: "deliveries.unknown", level: "later", title: `${r!.deliveries} 條飛書內容群推送不確定是否送達`, detail: "後臺“執行”頁核對群裡有沒有，再標記或重發" });

  // Runnable jobs (deferred ones excluded) that have waited more than two hours.
  const queues = await sql<{ name: string; n: number; oldest: Date }[]>`
    SELECT name, count(*)::int AS n, min(start_after) AS oldest FROM pgboss.job
    WHERE state IN ('created', 'retry') AND start_after <= now() AND name NOT LIKE 'cron.%' GROUP BY 1`;
  for (const q of queues) {
    if (now - q.oldest.getTime() > 2 * 3600_000) {
      out.push({ key: `queue.${q.name}`, level: "later", title: `後臺任務排隊超過 2 小時：${q.name}`, detail: `${q.n} 個等待，最早的等了 ${duration(now - q.oldest.getTime())}` });
    }
  }

  // The site's modules' follow-ups.
  for (const m of serverModules()) if (m.followUps) out.push(...(await m.followUps(now)));
  return out;
}

/** What stops when a model service refuses us: the steps that default to its models, else a pointer to the admin. */
function modelStops(service: string): string {
  const steps = stepsOnService(service);
  return steps.length ? `${steps.join("、")}停了` : "用到這家模型的步驟停了（看後臺“模型與評測”），新內容可能進不了精選";
}
/** `stops` is for the services that are not models; a model service's follows from the steps that use it. */
const PROVIDERS: Record<string, { name: string; where: string; stops?: string }> = {
  llm: { name: "預設模型服務", where: "模型服務商的控制台" },
  zhipu: { name: "智譜", where: "智譜開放平臺" },
  dashscope: { name: "阿里雲百鍊", where: "阿里雲百鍊控制台" },
  deepseek: { name: "DeepSeek", where: "DeepSeek 開放平臺" },
  mimo: { name: "小米 MiMo", where: "小米 MiMo 開放平臺" },
  socialdata: { name: "SocialData", stops: "X（推特）上的新內容收不到", where: "SocialData 後臺" },
  jina: { name: "Jina", stops: "部分文章取不到正文", where: "Jina 後臺" },
  dajiala: { name: "極致了（Dajiala）", stops: "公眾號新文章收不到", where: "極致了後臺" },
};
export const providerName = (service: string) => PROVIDERS[service]?.name ?? service;
export const providerStops = (service: string) => {
  const p = PROVIDERS[service];
  return p ? (p.stops ?? modelStops(service)) : "相關功能停了";
};
export const providerConsole = (service: string) => PROVIDERS[service]?.where ?? `${service} 後臺`;

/** Paid services that refuse us (no balance, a dead key), and daily budgets used up. */
async function providerFindings(): Promise<Finding[]> {
  const out: Finding[] = [];
  const refused = await sql<{ service: string; n: number; last: string }[]>`
    SELECT service, count(*)::int AS n, (array_agg(left(error, 200) ORDER BY started_at DESC))[1] AS last FROM receipt_attempts
    WHERE status = 'failed' AND started_at > now() - interval '1 hour'
      AND error ~* '(HTTP 40[123]\\M|insufficient|balance|arrear|good standing|欠費|餘額)'
    GROUP BY 1 HAVING count(*) >= 3`;
  for (const p of refused) {
    out.push({
      key: `provider.refused.${p.service}`,
      level: "today",
      owner: true,
      title: `${providerName(p.service)} 拒絕服務，可能欠費或賬號失效`,
      impact: providerStops(p.service),
      heals: "不會",
      action: `去${providerConsole(p.service)}看餘額和賬號狀態，充值或恢復後系統會自動繼續；兩樣都正常的話，發起一次維護查原因`,
      detail: `最近 1 小時被拒 ${p.n} 次：${p.last}`,
    });
  }
  const capped = await sql<{ service: string; per_day: number; used: number }[]>`
    SELECT b.service, b.per_day, count(a.id)::int AS used FROM budgets b
    JOIN receipt_attempts a ON a.service = b.service AND a.origin = 'live' AND a.started_at > now() - interval '1 day'
    WHERE b.per_day > 0 GROUP BY 1, 2 HAVING count(a.id) >= b.per_day`;
  for (const c of capped) {
    out.push({
      key: `budget.day.${c.service}`,
      level: "later",
      title: `${providerName(c.service)} 過去 24 小時的呼叫額度用完了`,
      impact: `${providerStops(c.service)}，直到額度隨時間騰出來`,
      heals: "會，額度按 24 小時滾動恢復",
      action: "這次不用處理；如果經常出現，再決定要不要調高額度",
      detail: `24 小時內 ${c.used} 次，上限 ${c.per_day}（budgets 表）`,
    });
  }
  return out;
}

interface AlertState {
  [key: string]: { title: string; since: string; sentAt: string };
}

const DAILY_PREFIX = "report.daily:";
const dailyDate = (key: string) => key.startsWith(DAILY_PREFIX) && isValidDate(key.slice(DAILY_PREFIX.length))
  ? key.slice(DAILY_PREFIX.length) : undefined;
/** Missing dailies are looked for, and announced ones followed, over the last seven Beijing calendar days. */
const dailyScanFrom = (now: number) => addDays(beijingDate(now), -6);

async function alertState(): Promise<AlertState> {
  const [row] = await sql<{ value: AlertState }[]>`SELECT value FROM settings WHERE key = 'alerts.state'`;
  const state = { ...(row?.value ?? {}) };
  // The old shared key recorded its first alert date in since. Keep its reminder timing on upgrade.
  const legacy = state["report.daily"];
  if (legacy && Number.isFinite(Date.parse(legacy.since))) {
    const date = beijingDate(legacy.since);
    state[`${DAILY_PREFIX}${date}`] ??= { ...legacy, title: `${date} 的日報還沒生成` };
    delete state["report.daily"];
  }
  return state;
}

async function dailyReportFindings(now: number): Promise<Finding[]> {
  const today = beijingDate(now);
  const state = await alertState();
  const [activity] = await sql<{ first_report: string | null; first_attempt: Date | null }[]>`
    SELECT (SELECT min(key) FROM reports WHERE kind = 'daily') AS first_report,
           (SELECT min(started_at) FROM job_runs WHERE job = 'reports.compose') AS first_attempt`;
  const starts = [activity?.first_report, activity?.first_attempt && beijingDate(activity.first_attempt)]
    .filter((date): date is string => !!date && isValidDate(date)).sort();
  const start = starts[0] ?? today;
  // New gaps and announced editions alike are followed for the scan window; checkAlerts closes older ones.
  const from = dailyScanFrom(now);
  const dates = new Set(Object.keys(state).map(dailyDate).filter((date): date is string => !!date && date >= from));
  for (let date = from; date <= today; date = addDays(date, 1)) {
    if (date >= start) dates.add(date);
  }
  const overdue = [...dates].filter(date => now >= beijingAt(date, EDITION_TIMES.daily).getTime() + 2 * 3600_000).sort();
  if (!overdue.length) return [];
  const published = new Set((await sql<{ key: string }[]>`SELECT key FROM reports WHERE kind = 'daily' AND key IN ${sql(overdue)}`).map(r => r.key));
  return overdue.filter(date => !published.has(date)).map(date => ({
    key: `${DAILY_PREFIX}${date}`, level: "now",
    title: `${date} 的日報還沒生成`, impact: `讀者看不到 ${date} 的日報`,
    heals: "尚未補齊；需檢視執行記錄確認是否需要人工補做",
    action: "儘快發起一次維護處理",
    detail: `reports daily ${date} 不存在；看 reports.compose 的執行記錄`,
  }));
}

/**
 * Every 10 minutes: new problems and recoveries of the now/today levels go out; follow-ups wait for 09:00.
 * With a responder, only what it hands back goes out, and what it still holds is not reported as recovered.
 */
export async function checkAlerts(now = Date.now()) {
  const all = await collectFindings(now);
  const r = responder();
  const { tell, held } = r ? await r.take(all, now) : { tell: all, held: [] as string[] };
  const found = tell.filter((f) => f.level !== "later");
  const state = await alertState();
  const sent: string[] = [];
  for (const f of found) {
    const open = state[f.key];
    if (open && now - Date.parse(open.sentAt) <= REPEAT_MS[f.level as Exclude<Level, "later">]) continue;
    const since = open ? new Date(open.since) : (f.since ?? new Date(now));
    const msg = formatAlert(f, since, now, !!open);
    await sendAlert(msg.title, msg.lines);
    state[f.key] = { title: f.title, since: since.toISOString(), sentAt: new Date(now).toISOString() };
    sent.push(f.key);
  }
  for (const [key, open] of Object.entries(state)) {
    if (found.some((f) => f.key === key) || held.includes(key)) continue;
    // Suppressed findings (valves, startup grace or responder policy) are not evidence of recovery.
    const date = dailyDate(key);
    if (date) {
      const [report] = await sql`SELECT 1 FROM reports WHERE kind = 'daily' AND key = ${date}`;
      if (!report && date >= dailyScanFrom(now)) continue;
      if (!report) {
        // Past the scan window a missing edition is closed with one message instead of reminded about forever.
        await sendAlert(`${date} 的日報沒能補出，停止提醒`, [`讀者看不到 ${date} 的日報；缺期從 ${beijingStamp(new Date(open.since))} 起，已超出七天的檢查範圍`]);
        sent.push(`${key}:expired`);
        delete state[key];
        continue;
      }
    }
    const msg = formatRecovery(open.title, new Date(open.since), now);
    await sendAlert(msg.title, msg.lines);
    sent.push(`${key}:recovered`);
    delete state[key];
  }
  await sql`INSERT INTO settings (key, value, updated_by) VALUES ('alerts.state', ${sql.json(state as never)}, 'alerts')
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  return { open: Object.keys(state), sent };
}

/** 09:00 (without a responder): one message with the follow-ups; nothing when there are none. */
export async function sendDigest(now = Date.now()) {
  const items = (await collectFindings(now)).filter((f) => f.level === "later");
  const lines = items.map((f, i) => `${i + 1}. ${f.title}${f.detail ? `\n   ${f.detail}` : ""}`);
  if (!lines.length) return { items: 0 };
  await sendAlert(`📋 系統日報 · ${beijingDay(now)}`, ["以下事項需要跟進，具體影響見各條說明；可把整條轉給 AI 處理。", ...lines]);
  return { items: lines.length };
}
