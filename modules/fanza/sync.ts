// 用 DMM Web Service API v3（FANZA 聯盟）取官方新作，把每一部作品當成一條資料推進來。
//
// 這個模組做三件本站自己做不到的事：
//   · 正版入口：連結用 API 回傳的聯盟網址（item.URL），讀者點到的是 FANZA 官方商店，本站同時取得分潤。
//   · 官方封面：item.imageURL.large 放進 media，卡片與詳情頁顯示的是官方商品圖。
//   · 可核對的材料：片商、廠牌、系列、出演者、型別、發售日、價格寫進 excerpt，
//     讓評分與寫作有材料 —— FANZA 商品頁從臺灣抓不到（地區限制），不必也無法去抓。
//
// 憑證放在 .env（或 collectors.env）：FANZA_API_ID、FANZA_AFFILIATE_ID，可選 FANZA_FLOOR（預設 videoa）。
// 申請步驟見這個模組的 README.md。
import { credential } from "@aihot/backend/config";
import { upsertMaterial, type MediaItem } from "@aihot/backend/content/materials";
import { sql } from "@aihot/backend/db";
import { queueProcessing } from "@aihot/backend/jobs/content";
import { logError } from "@aihot/backend/lib/log-error";

/** 這些作品在庫裡的信源 id：外部推送進來的一種，不參與抓取排程（next_fetch_at 推到很遠）。 */
const SOURCE_ID = "fanza-new";
const SOURCE_NAME = "FANZA 新作";
const ENDPOINT = "https://api.dmm.com/affiliate/v3/ItemList";

export interface FanzaRun {
  ok: boolean;
  reason?: string;
  received: number;
  created: number;
  revised: number;
  skipped: number;
}

interface DmmItem {
  content_id?: string;
  title?: string;
  URL?: string;
  affiliateURL?: string;
  date?: string;
  imageURL?: { large?: string | null; list?: string | null } | null;
  prices?: { price?: string | null } | null;
  iteminfo?: {
    maker?: Array<{ name?: string }>;
    label?: Array<{ name?: string }>;
    series?: Array<{ name?: string }>;
    actress?: Array<{ name?: string; ruby?: string }>;
    genre?: Array<{ name?: string }>;
    director?: Array<{ name?: string }>;
  } | null;
}

/** "2026-11-01 10:00:00"（FANZA 的日本時間）→ Date；讀不到就 null。 */
function fanzaDate(value: string | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
  const at = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`);
  return Number.isFinite(at.getTime()) ? at : null;
}

/** 作品的可核對資訊，一行一項：評分與寫作只根據這些事實。 */
function metaLine(item: DmmItem): string {
  const names = (list?: Array<{ name?: string }>) => (list ?? []).map((x) => x.name).filter(Boolean).join("、");
  const rows = [
    ["片商", names(item.iteminfo?.maker)],
    ["廠牌", names(item.iteminfo?.label)],
    ["系列", names(item.iteminfo?.series)],
    ["出演者", names(item.iteminfo?.actress)],
    ["型別", names(item.iteminfo?.genre)],
    ["導演", names(item.iteminfo?.director)],
    ["發售日", item.date ?? ""],
    ["價格", item.prices?.price ? `${item.prices.price} 日圓` : ""],
    ["商品編號", item.content_id ?? ""],
  ];
  return rows.filter(([, v]) => v).map(([k, v]) => `${k}：${v}`).join("\n");
}

/** 這條作品在庫裡的信源：外部推送、進精選、屬於 FANZA；排程不會去抓它。 */
async function ensureSource(): Promise<void> {
  await sql`
    INSERT INTO sources (id, name, kind, config, tier, first_party, owner_entity_id, participation_mode,
                         interval_minutes, tags, site_fulltext, syndicate_fulltext, enabled, health, next_fetch_at)
    VALUES (${SOURCE_ID}, ${SOURCE_NAME}, 'external', '{}'::jsonb, 'T1', true, 'fanza', 'editorial',
            100000, ${["平臺", "新作"]}, false, false, true, 'ok', now() + interval '10 years')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = true, participation_mode = 'editorial',
      tier = 'T1', first_party = true, owner_entity_id = 'fanza', next_fetch_at = now() + interval '10 years'`;
}

/**
 * 跑一次同步：查 FANZA 新作（依發售日排序），逐條推進來。
 * 沒有憑證、API 拒絕或網路失敗都只回報原因，不丟擲：排程的下一次會再試。
 */
export async function syncFanzaItems(): Promise<FanzaRun> {
  const apiId = credential("collectors", "FANZA_API_ID");
  const affiliateId = credential("collectors", "FANZA_AFFILIATE_ID");
  if (!apiId || !affiliateId) {
    return { ok: false, reason: "FANZA_API_ID / FANZA_AFFILIATE_ID 未設定", received: 0, created: 0, revised: 0, skipped: 0 };
  }
  const floor = credential("collectors", "FANZA_FLOOR") ?? "videoa";
  const hits = Math.min(Math.max(Number(credential("collectors", "FANZA_HITS") ?? 30) || 30, 1), 100);
  const url = new URL(ENDPOINT);
  url.searchParams.set("api_id", apiId);
  url.searchParams.set("affiliate_id", affiliateId);
  url.searchParams.set("site", "FANZA");
  url.searchParams.set("service", "digital");
  url.searchParams.set("floor", floor);
  url.searchParams.set("hits", String(hits));
  url.searchParams.set("sort", "date");
  url.searchParams.set("output", "json");

  let payload: { result?: { status?: number; message?: string; items?: DmmItem[] } };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}: ${text.slice(0, 200)}`, received: 0, created: 0, revised: 0, skipped: 0 };
    payload = JSON.parse(text) as typeof payload;
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "fanza item list failed", err: logError(error) }));
    return { ok: false, reason: String(error).slice(0, 200), received: 0, created: 0, revised: 0, skipped: 0 };
  }
  const result = payload.result;
  if (result?.status !== 200) {
    return { ok: false, reason: `API status ${result?.status ?? "?"}: ${result?.message ?? ""}`.slice(0, 200), received: 0, created: 0, revised: 0, skipped: 0 };
  }

  await ensureSource();
  const items = result.items ?? [];
  let created = 0;
  let revised = 0;
  let skipped = 0;
  for (const item of items) {
    const title = item.title?.trim();
    const link = (item.URL ?? item.affiliateURL)?.trim();
    if (!title || !link) {
      skipped += 1;
      continue;
    }
    const cover = item.imageURL?.large ?? item.imageURL?.list ?? null;
    const media: MediaItem[] = cover ? [{ kind: "image", url: cover, alt: title }] : [];
    try {
      const res = await upsertMaterial({
        sourceId: SOURCE_ID,
        url: link,
        title,
        language: "ja",
        publishedAt: fanzaDate(item.date),
        excerpt: metaLine(item),
        // 商品頁從這裡讀不到，也沒必要讀：材料就是 API 給的商品資訊。
        bodyStatus: "none",
        media,
        raw: { fanza: { contentId: item.content_id ?? null, floor } },
        via: "fanza",
      });
      if (res.created) created += 1;
      if (res.revised) revised += 1;
      if (res.created || res.revised || res.processingNeeded) await queueProcessing(res.articleId);
    } catch (error) {
      skipped += 1;
      console.error(JSON.stringify({ level: "error", msg: "fanza item upsert failed", subject: item.content_id ?? title, err: logError(error) }));
    }
  }
  await sql`UPDATE sources SET last_fetch_at = now(), last_ok_at = now(), last_error = null WHERE id = ${SOURCE_ID}`;
  return { ok: true, received: items.length, created, revised, skipped };
}
