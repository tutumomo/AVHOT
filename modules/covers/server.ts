// 封面模組的後端：一個每天跑的清理任務，和一個只讀的接口。
//
// 公開範圍不在這裡決定：候選清單來自公開讀取層（publication/pool.ts），本模組只補充「那篇的封面是哪一張」，
// 以及把它清乾淨。所以撤回、隔離與未發布的資料不會因為這個接口露出來。
import type { FastifyInstance } from "fastify";
import { sql } from "@aihot/backend/db";
import { proxiedImage } from "@aihot/backend/media/imgproxy";
import { defineServerModule } from "@aihot/backend/modules";
import { loadPool } from "@aihot/backend/publication/pool";
import { cleanMedia, coverUrl } from "./clean.ts";

interface MediaRow {
  id: string;
  url: string;
  media: unknown;
  source: string;
  title: string;
  timeline_at: Date;
}

/** 乾淨媒體存回資料庫：只碰最近幾天、而且真的變了的列。 */
export async function cleanRecentMedia(): Promise<{ scanned: number; cleaned: number }> {
  const rows = await sql<{ id: string; media: unknown }[]>`
    SELECT id, media FROM articles
    WHERE media IS NOT NULL AND jsonb_array_length(media) > 0 AND discovered_at > now() - interval '4 days'`;
  let cleaned = 0;
  for (const row of rows) {
    const before = Array.isArray(row.media) ? (row.media as { url?: string }[]) : [];
    const next = cleanMedia(row.media as never);
    if (before.length === next.length && before.every((m, i) => m?.url === next[i]?.url)) continue;
    await sql`UPDATE articles SET media = ${sql.json(next as never)} WHERE id = ${row.id}`;
    cleaned += 1;
  }
  return { scanned: rows.length, cleaned };
}

/** 清單頁封面欄的資料：公開清單中最新的幾篇，附上已簽名的縮圖網址與官方頁連結。 */
export async function recentCovers(limit = 12, now = new Date()) {
  const pool = await loadPool({ channel: "all", category: null, tag: null, page: 1, now });
  const ids = pool.items.slice(0, 80).map((item) => item.id);
  if (!ids.length) return [];
  const rows = await sql<MediaRow[]>`
    SELECT p.article_id AS id, p.url, a.media, s.name AS source, p.title, p.timeline_at
    FROM publications p JOIN articles a ON a.id = p.article_id JOIN sources s ON s.id = p.source_id
    WHERE p.article_id IN ${sql(ids)}`;
  const byId = new Map(rows.map((row) => [row.id, row]));
  const out: Array<{ id: string; title: string; source: string; cover: string; official: string; at: string }> = [];
  for (const item of pool.items) {
    const row = byId.get(item.id);
    if (!row) continue;
    const cover = proxiedImage(coverUrl(row.media as never), "card");
    if (!cover) continue;
    out.push({ id: row.id, title: row.title, source: row.source, cover, official: row.url, at: row.timeline_at.toISOString() });
    if (out.length >= limit) break;
  }
  return out;
}

export const coversServer = defineServerModule({
  name: "covers",
  schedules: [
    // 每天 04:50 清一次（排在取信源圖示之後）；只動最近四天、內容真的變了的列。
    { name: "covers.clean-media", cron: "50 4 * * *", missed: "once", run: () => cleanRecentMedia() },
  ],
  admin: { currentJobs: async () => ["covers.clean-media"] },
  http: (app: FastifyInstance) => {
    app.get("/api/covers/recent", async (req, reply) => {
      const limit = Math.min(Math.max(Number((req.query as { limit?: string })?.limit ?? 12) || 12, 1), 24);
      const items = await recentCovers(limit);
      return reply.header("Cache-Control", "public, max-age=120, s-maxage=120").send({ items });
    });
  },
});
