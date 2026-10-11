// The Monday source-health report for the ops chat. It goes through the same gated channel as the
// alerts (off unless FEISHU_INTERNAL_ENABLED).
import { sql } from "../db.ts";
import { sendAlert } from "../notify/feishu.ts";
import { serverModules } from "../modules.ts";
import { sourceHealth, sourceHealthList } from "../sources/health.ts";

/** The change from b to a: "+12%", "—" without a b. Also the modules' reports. */
export const pct = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${(((a - b) / b) * 100).toFixed(0)}%` : "—");
/** A count with thousands separators. */
export const n = (v: number) => v.toLocaleString("en-US");

/** Monday 09:00: how the sources did over the last seven days. */
export async function sourceHealthWeekly(now = Date.now()) {
  const since = new Date(now - 7 * 86400_000);
  const before = new Date(now - 14 * 86400_000);
  const [[counts], [items], groups] = await Promise.all([
    sql<{ enabled: number; failing: number; degraded: number; added: number }[]>`
      SELECT count(*) FILTER (WHERE enabled)::int AS enabled,
             count(*) FILTER (WHERE enabled AND health = 'failing')::int AS failing,
             count(*) FILTER (WHERE enabled AND health = 'degraded')::int AS degraded,
             count(*) FILTER (WHERE created_at >= ${since})::int AS added
      FROM sources`,
    sql<{ week: number; prev: number; selected: number }[]>`
      SELECT count(*) FILTER (WHERE discovered_at >= ${since})::int AS week,
             count(*) FILTER (WHERE discovered_at >= ${before} AND discovered_at < ${since})::int AS prev,
             (SELECT count(*)::int FROM publications p WHERE p.selected AND p.visibility <> 'withdrawn' AND p.discovered_at >= ${since}) AS selected
      FROM articles WHERE discovered_at >= ${before}`,
    sourceHealth(now),
  ]);
  const lines = [
    `本週收錄 ${n(items!.week)} 條（上週 ${n(items!.prev)}，${pct(items!.week, items!.prev)}），其中精選 ${n(items!.selected)} 條`,
    `在用信源 ${counts!.enabled} 個，本週新增 ${counts!.added} 個；抓取失敗 ${counts!.failing} 個，不太穩定 ${counts!.degraded} 個`,
  ];
  // The modules' own collectors, a line each.
  for (const m of serverModules()) if (m.sourceHealth) lines.push(...(await m.sourceHealth(now)));
  for (const group of groups) {
    lines.push("", `${group.name}：${group.sources.length} 個在用信源；本週歸屬條目 ${n(group.sources.reduce((sum, s) => sum + s.items, 0))} 條；連續失敗 ${group.failing.length} 個、反覆失敗 ${group.unstable.length} 個、7 天無新發現 ${group.silent.length} 個`);
    if (group.failing.length) lines.push(`抓取失敗：${sourceHealthList(group.failing, s => `連續失敗 ${s.fail_count} 次${s.last_error ? `（${s.last_error}）` : ""}`, Infinity)}`);
    if (group.unstable.length) lines.push(`不穩定：${sourceHealthList(group.unstable, s => `失敗 ${s.failed}/${s.runs} 次`, Infinity)}`);
    if (group.silent.length) lines.push(`7 天無新發現（需對照原站，可能只是低頻更新）：${sourceHealthList(group.silent, s => `${s.runs} 次抓取`, Infinity)}`);
    if (group.quality.length) lines.push(`文章質量待核實：${sourceHealthList(group.quality, s => `缺釋出時間 ${s.undated} 篇、反覆修訂 ${s.repeated} 篇`, Infinity)}`);
    if (group.detailFailures.length) lines.push(`詳情補全失敗：${sourceHealthList(group.detailFailures, s => `${s.detail_failures} 次`, Infinity)}`);
  }
  const failing = counts!.failing;
  const silent = groups.reduce((sum, g) => sum + g.silent.length, 0);
  const followUp = counts!.failing > 0 || groups.some(g => g.failing.length || g.unstable.length || g.silent.length || g.quality.length || g.detailFailures.length);
  lines.push("", followUp ? "需要處理的話，把這條轉給 AI；詳情在後臺“信源”與“執行”頁。" : "沒有需要處理的信源。");
  await sendAlert("📊 信源週報", lines);
  return { failing, silent };
}
