// 商品頁與媒體頁會把站方自己的界面圖示跟作品封面一起放進 HTML，抽取時兩者都被收進來，
// 而且界面圖示常常排在封面前面（DUGA 就是這樣：評分星等 gif、裝置支援 svg 在前，真封面在第 11 張）。
// 這裡把它們挑掉，並讓封面排第一：卡片、封面欄與分享圖拿到的第一張就是作品封面。
import type { MediaItem } from "@aihot/backend/content/materials";

/** 站方界面圖示的路徑特徵。 */
const JUNK_PATH = /\/img\/contents\/(score|device)\/|\/(sprite|assets|common|template)\//i;
/** 名字一看就是界面元素的圖。 */
const JUNK_NAME = /(sprite|spacer|blank|pixel|tracking|logo|icon|banner|button|badge|arrow|star|loading|placeholder)/i;
/** 向量圖與圖示檔不會是作品封面。 */
const JUNK_EXT = /\.(svg|ico)(?:[?#]|$)/i;
/** 透明佔位圖。 */
const TINY = /(?:^|[/_-])(?:1x1|2x2|transparent|clear|dot)\.(?:gif|png)(?:[?#]|$)/i;

export function isJunkImage(url: string): boolean {
  return JUNK_PATH.test(url) || JUNK_EXT.test(url) || TINY.test(url) || JUNK_NAME.test(url);
}

/** 這個部署不想要封面的網域（選填）：填在這裡的圖一律不當封面。 */
export function isBlockedImageHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host.endsWith(".local");
  } catch {
    return true;
  }
}

export function coverUrl(media: MediaItem[] | null | undefined): string | null {
  for (const item of cleanMedia(media)) {
    if (item.kind === "image" && !isBlockedImageHost(item.url)) return item.url;
  }
  return null;
}

/** 清乾淨的 media：界面圖示不要，封面排最前面，影片接在後面，重複網址只留一次。 */
export function cleanMedia(media: MediaItem[] | null | undefined): MediaItem[] {
  const list = Array.isArray(media) ? media : [];
  const keep = (m: MediaItem, kind: "image" | "video") =>
    m && typeof m?.url === "string" && m.kind === kind && /^https?:\/\//i.test(m.url);
  const images = list.filter((m) => keep(m, "image") && !isJunkImage(m.url));
  const videos = list.filter((m) => keep(m, "video"));
  const seen = new Set<string>();
  return [...images, ...videos].filter((m) => (seen.has(m.url) ? false : (seen.add(m.url), true)));
}
