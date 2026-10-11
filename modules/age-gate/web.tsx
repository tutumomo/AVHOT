// 18+ 年齡閘門。純前端模組：不改動引擎的頁面、介面、快取與資料庫，機器出口（RSS / API / MCP）不受影響。
//
// 兩道配合：bootScript 在繪製前給 <html> 打標記並擋住正文（只露出閘門），Bottom 畫出確認層。
// 讀者確認後把選擇寫進本機 localStorage，之後不再出現。後臺（/admin）不擋。
import { useEffect, useState } from "react";
import { SITE } from "@aihot/site";
import { defineWebModule } from "@aihot/web/modules";

/** 讀者確認過年滿 18 歲，只存在這臺瀏覽器裡，不傳送到伺服器。 */
const STORAGE_KEY = "avhot.age-confirmed.v1";

const GATE_ATTRIBUTE = "data-age-gate";
const STYLE_ID = "age-gate-style";

/**
 * 繪製前執行：確認過就什麼都不做；沒確認過就給 <html> 打標記，並用一條樣式把正文藏起來，
 * 只讓閘門（#age-gate）可見，避免閘門出現前先閃出內容。
 * 10 秒內閘門沒渲染出來（指令碼沒載入完、瀏覽器停用了它等），撤掉遮擋：寧可少擋一次，也不要留一張白頁。
 */
const BOOT_SCRIPT = `(function(){var K=${JSON.stringify(STORAGE_KEY)};try{if(localStorage.getItem(K)==="1")return}catch(e){}
var p=location.pathname;if(p==="/admin"||p.indexOf("/admin/")===0)return;
var d=document.documentElement;d.setAttribute(${JSON.stringify(GATE_ATTRIBUTE)},"on");
var s=document.createElement("style");s.id=${JSON.stringify(STYLE_ID)};
s.textContent='html[${GATE_ATTRIBUTE}="on"] body{visibility:hidden}html[${GATE_ATTRIBUTE}="on"] #age-gate,html[${GATE_ATTRIBUTE}="on"] #age-gate *{visibility:visible}';
(document.head||d).appendChild(s);
setTimeout(function(){if(!document.getElementById("age-gate")){d.removeAttribute(${JSON.stringify(GATE_ATTRIBUTE)});var x=document.getElementById(${JSON.stringify(STYLE_ID)});if(x)x.remove()}},10000)})();`;

/** 與引擎按鈕同一套寫法（components/ui/Controls.tsx 的兩種變體），這裡寫成字面量，模組自帶。 */
const PRIMARY =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-accent px-5 text-[14.5px] font-medium text-accent-contrast transition-[background-color,color,transform] duration-150 hover:bg-accent-ink active:scale-[0.98]";
const SECONDARY =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-surface px-5 text-[14.5px] font-medium text-ink-2 transition-[background-color,border-color,color,transform] duration-150 hover:border-ink-4 hover:text-ink active:scale-[0.98]";

function AgeGate() {
  // 服務端渲染時不擋；確認層只在瀏覽器裡按 bootScript 留下的標記決定出不出現。
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(document.documentElement.getAttribute(GATE_ATTRIBUTE) === "on"), []);
  if (!open) return null;

  const confirm = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 隱私模式等寫不進去的情況：這次照常放行，下次再問。
    }
    document.documentElement.removeAttribute(GATE_ATTRIBUTE);
    document.getElementById(STYLE_ID)?.remove();
    setOpen(false);
  };
  const leave = () => window.location.replace("https://www.google.com/");

  return (
    <div
      id="age-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-auto bg-bg px-6 py-10"
    >
      <div className="w-full max-w-sm text-center">
        <div className="mono text-[12px] tracking-widest text-ink-4">18+</div>
        <h1 id="age-gate-title" className="mt-2 text-[22px] font-bold leading-snug text-ink">
          本站內容僅限成年人
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-3">
          {SITE.name} 是日本 AV 與全球成人影片產業的新聞與作品情報索引。進入前請確認你已年滿 18 歲（或你所在地區規定的成年年齡），並且在你所在地區訪問此類內容不違法。
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-4">本站不提供任何影片檔案、下載或磁力連結。</p>
        <div className="mt-7 flex flex-col gap-2.5">
          <button type="button" onClick={confirm} className={PRIMARY}>
            我已滿 18 歲，進入
          </button>
          <button type="button" onClick={leave} className={SECONDARY}>
            未滿 18 歲，離開
          </button>
        </div>
        <p className="mt-5 text-[11.5px] leading-relaxed text-ink-4">
          你的確認只儲存在這臺瀏覽器裡，不會傳送到伺服器。
        </p>
      </div>
    </div>
  );
}

export const ageGateWeb = defineWebModule({
  name: "age-gate",
  root: { bootScript: BOOT_SCRIPT, Bottom: AgeGate },
});
