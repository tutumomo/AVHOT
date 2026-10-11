// 清單頁最上面的「最新作品與官方封面」橫向封面欄。
//
// 資料來自本模組自己的只讀接口（/api/covers/recent），那個接口的候選來自公開讀取層，所以撤回、
// 隔離與未發布的資料不會出現在這裡。頁面本身的正文照舊只有摘要（框架的版權預設不動），
// 這一欄顯示的是各官方頁面上的作品封面，並附一個連到官方頁的連結。
//
// 伺服器端先渲染成空（拿不到資料就不佔位），瀏覽器載入後才填上：這是刻意的，模組沒有頁面層的 loader。
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { defineWebModule } from "@aihot/web/modules";

interface Cover {
  id: string;
  title: string;
  source: string;
  cover: string;
  official: string;
  at: string;
}

/** 只在這幾個頁面顯示；其他頁面（含後台）不佔位。 */
const SHOW_ON = new Set(["/", "/all"]);

function CoverRail() {
  const { pathname } = useLocation();
  const [items, setItems] = useState<Cover[] | null>(null);

  useEffect(() => {
    if (!SHOW_ON.has(pathname)) {
      setItems(null);
      return;
    }
    let alive = true;
    fetch("/api/covers/recent?limit=12", { headers: { accept: "application/json" } })
      .then((res) => (res.ok ? (res.json() as Promise<{ items?: Cover[] }>) : { items: [] }))
      .then((data) => alive && setItems(data.items ?? []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [pathname]);

  if (!items?.length) return null;

  return (
    <section aria-label="最新作品與官方封面" className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold text-ink">最新作品與官方封面</h2>
        <span className="hidden text-[12px] text-ink-4 sm:inline">封面與連結取自各官方頁面</span>
      </div>
      <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {items.map((item) => (
          <li key={item.id} className="w-[150px] shrink-0">
            <a
              href={`/items/${item.id}`}
              className="block overflow-hidden rounded-control border border-line bg-surface transition-colors duration-150 hover:border-line-strong"
            >
              <img
                src={item.cover}
                alt={item.title}
                width={336}
                height={188}
                loading="lazy"
                decoding="async"
                className="aspect-[16/9] w-full object-cover"
              />
            </a>
            <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-ink-2">{item.title}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-4">
              <span className="truncate">{item.source}</span>
              <a
                href={item.official}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="shrink-0 text-accent transition-colors hover:underline"
              >
                官方頁 ↗
              </a>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const coversWeb = defineWebModule({ name: "covers", root: { Top: CoverRail } });
