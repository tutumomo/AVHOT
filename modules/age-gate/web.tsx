// 18+ 年龄闸门。纯前端模块：不改动引擎的页面、接口、缓存与数据库，机器出口（RSS / API / MCP）不受影响。
//
// 两道配合：bootScript 在绘制前给 <html> 打标记并挡住正文（只露出闸门），Bottom 画出确认层。
// 读者确认后把选择写进本机 localStorage，之后不再出现。后台（/admin）不挡。
import { useEffect, useState } from "react";
import { SITE } from "@aihot/site";
import { defineWebModule } from "@aihot/web/modules";

/** 读者确认过年满 18 岁，只存在这台浏览器里，不发送到服务器。 */
const STORAGE_KEY = "avhot.age-confirmed.v1";

const GATE_ATTRIBUTE = "data-age-gate";
const STYLE_ID = "age-gate-style";

/**
 * 绘制前执行：确认过就什么都不做；没确认过就给 <html> 打标记，并用一条样式把正文藏起来，
 * 只让闸门（#age-gate）可见，避免闸门出现前先闪出内容。
 * 10 秒内闸门没渲染出来（脚本没加载完、浏览器禁用了它等），撤掉遮挡：宁可少挡一次，也不要留一张白页。
 */
const BOOT_SCRIPT = `(function(){var K=${JSON.stringify(STORAGE_KEY)};try{if(localStorage.getItem(K)==="1")return}catch(e){}
var p=location.pathname;if(p==="/admin"||p.indexOf("/admin/")===0)return;
var d=document.documentElement;d.setAttribute(${JSON.stringify(GATE_ATTRIBUTE)},"on");
var s=document.createElement("style");s.id=${JSON.stringify(STYLE_ID)};
s.textContent='html[${GATE_ATTRIBUTE}="on"] body{visibility:hidden}html[${GATE_ATTRIBUTE}="on"] #age-gate,html[${GATE_ATTRIBUTE}="on"] #age-gate *{visibility:visible}';
(document.head||d).appendChild(s);
setTimeout(function(){if(!document.getElementById("age-gate")){d.removeAttribute(${JSON.stringify(GATE_ATTRIBUTE)});var x=document.getElementById(${JSON.stringify(STYLE_ID)});if(x)x.remove()}},10000)})();`;

/** 与引擎按钮同一套写法（components/ui/Controls.tsx 的两种变体），这里写成字面量，模块自带。 */
const PRIMARY =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-accent px-5 text-[14.5px] font-medium text-accent-contrast transition-[background-color,color,transform] duration-150 hover:bg-accent-ink active:scale-[0.98]";
const SECONDARY =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-surface px-5 text-[14.5px] font-medium text-ink-2 transition-[background-color,border-color,color,transform] duration-150 hover:border-ink-4 hover:text-ink active:scale-[0.98]";

function AgeGate() {
  // 服务端渲染时不挡；确认层只在浏览器里按 bootScript 留下的标记决定出不出现。
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(document.documentElement.getAttribute(GATE_ATTRIBUTE) === "on"), []);
  if (!open) return null;

  const confirm = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 隐私模式等写不进去的情况：这次照常放行，下次再问。
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
          本站内容仅限成年人
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-3">
          {SITE.name} 是日本 AV 与全球成人影片产业的新闻与作品情报索引。进入前请确认你已年满 18 岁（或你所在地区规定的成年年龄），并且在你所在地区访问此类内容不违法。
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-4">本站不提供任何影片文件、下载或磁力链接。</p>
        <div className="mt-7 flex flex-col gap-2.5">
          <button type="button" onClick={confirm} className={PRIMARY}>
            我已满 18 岁，进入
          </button>
          <button type="button" onClick={leave} className={SECONDARY}>
            未满 18 岁，离开
          </button>
        </div>
        <p className="mt-5 text-[11.5px] leading-relaxed text-ink-4">
          你的确认只保存在这台浏览器里，不会发送到服务器。
        </p>
      </div>
    </div>
  );
}

export const ageGateWeb = defineWebModule({
  name: "age-gate",
  root: { bootScript: BOOT_SCRIPT, Bottom: AgeGate },
});
