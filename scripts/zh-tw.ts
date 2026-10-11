// 簡體 → 繁體（臺灣用語）轉換。本站把框架的簡體中文介面與文案換成繁體，改的是**讀者看得到的字**，
// 不動任何邏輯：註解、變數名與程式結構原樣保留，只有字串、模板字串的文字、JSX 文字與正則裡的漢字會被轉。
//
//   node scripts/zh-tw.ts            # 轉換並原地寫入
//   node scripts/zh-tw.ts --check    # 只列出會改變的檔案與處數，不寫入
//   node scripts/zh-tw.ts --list     # 列出納入轉換的檔案
//
// 上游更新合併進來後，框架檔案會回到簡體：重跑一次這支指令碼即可（見 site/README.md「繁體化」）。
// 轉換是冪等的：已經繁體的文字再跑一次不會改變。
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import * as OpenCC from "opencc-js";

const ROOT = path.resolve(import.meta.dirname, "..");
const toTw = OpenCC.Converter({ from: "cn", to: "twp" });
/** 漢字（含擴充 A 與相容區）；沒有漢字的字串一律不動。 */
const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

/**
 * 這些是**日文**用字，不能跟著簡體一起轉：它們要跟來源網頁的日文原文對得上（身份詞典與信源名），
 * 或本身是日文術語的解說。轉換後把它們還原（先算轉換器會把它們變成什麼，再換回來）。
 */
const KEEP = ["知的財産振興協会", "企画単体", "単体", "新着"];

function restore(text: string): string {
  let out = text;
  for (const original of KEEP) {
    const changed = toTw(original);
    if (changed !== original) out = out.split(changed).join(original);
  }
  return out;
}

/**
 * 要轉的程式碼目錄。覆蓋面要一致：產生字串的程式與斷言那些字串的測試必須一起轉，
 * 否則兩邊一個繁體一個簡體，測試會整批失敗。
 */
const CODE_DIRS = ["apps", "packages/contracts/src", "packages/backend/src", "tests", "scripts"];
/**
 * 不轉的檔案：這裡的中文是拿來比對**來源網頁**的（樣板文字、正文清洗、中文標點），
 * 換成繁體就比對不到簡體來源了。它們的程式碼不變，只有訊息文字留在簡體。
 */
const CODE_SKIP = ["packages/backend/src/content/", "packages/backend/src/lib/text.ts", "scripts/zh-tw.ts"];

/** 要整份轉的文字檔（Markdown、JSON）：都是文案、詞表或說明。 */
const TEXT_FILES = [
  "site/pages/terms.md",
  "site/pages/privacy.md",
  "site/changelog.json",
  "site/public/manifest.webmanifest",
  "site/public/openapi-v1.json",
  "site/public/robots.txt",
  "industry/topics.json",
  "industry/sources.json",
  "industry/gold.example.jsonl",
  "industry/relation-gold.example.jsonl",
  "industry/story-digest-eval.example.jsonl",
  "industry/README.md",
  "site/README.md",
];
const TEXT_DIRS = ["industry/prompts", "modules"];
/** 這些是本站自己的檔案（不是框架的）：整份轉，連註解一起，之後讀起來一致。 */
const OWN_DIRS = ["site", "industry", "modules"];
const OWN_FILES = ["scripts/zh-tw.ts"];
const TEXT_EXT = new Set([".md", ".json", ".jsonl", ".webmanifest", ".txt"]);
const CODE_EXT = new Set([".ts", ".tsx"]);
const OWN_EXT = new Set([".ts", ".tsx"]);
const SKIP = new Set(["node_modules", ".git", ".data", "build", ".react-router", "dist", "package"]);

function walkDir(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walkDir(full, out);
    else out.push(full);
  }
  return out;
}

function targets(): string[] {
  const files = new Set<string>();
  for (const dir of CODE_DIRS) for (const f of walkDir(path.join(ROOT, dir))) if (CODE_EXT.has(path.extname(f))) files.add(f);
  for (const dir of TEXT_DIRS) for (const f of walkDir(path.join(ROOT, dir))) if (TEXT_EXT.has(path.extname(f))) files.add(f);
  for (const dir of OWN_DIRS) for (const f of walkDir(path.join(ROOT, dir))) if (OWN_EXT.has(path.extname(f))) files.add(f);
  for (const f of OWN_FILES) files.add(path.join(ROOT, f));
  for (const f of TEXT_FILES) files.add(path.join(ROOT, f));
  files.add(path.join(ROOT, "scripts/nameplates.ts"));
  const kept = [...files].filter((f) => {
    const rel = path.relative(ROOT, f).replace(/\\/g, "/");
    return !CODE_SKIP.some((skip) => rel === skip || rel.startsWith(skip));
  });
  return kept.sort();
}

interface Edit {
  start: number;
  end: number;
  value: string;
}

/** 一段程式碼裡所有該轉的位置：字串、模板文字、JSX 文字與正則。 */
function codeEdits(text: string): Edit[] {
  let ast;
  try {
    ast = parse(text, { sourceType: "unambiguous", plugins: ["typescript", "jsx", "decorators-legacy"], ranges: true, errorRecovery: true });
  } catch {
    return [];
  }
  const edits: Edit[] = [];
  /** 屬性與方法的名稱也可以是中文（`{ 最佳化: … }`）：那是鍵不是變數，一律跟著轉。 */
  const KEY_HOLDERS = ["ObjectProperty", "ObjectMethod", "ClassProperty", "ClassMethod", "ClassPrivateProperty", "TSPropertySignature", "TSMethodSignature", "TSEnumMember"];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; start?: number; end?: number; computed?: boolean; key?: { type?: string; start?: number; end?: number } } & Record<string, unknown>;
    if (typeof n.type === "string" && typeof n.start === "number" && typeof n.end === "number") {
      // 正則一律不動：框架裡的中文正則用來比對來源網頁，換成繁體就比對不到了。
      const kinds = ["StringLiteral", "TemplateElement", "JSXText", "DirectiveLiteral"];
      if (kinds.includes(n.type)) {
        const raw = text.slice(n.start, n.end);
        if (HAN.test(raw)) {
          const value = restore(toTw(raw));
          if (value !== raw) edits.push({ start: n.start, end: n.end, value });
        }
      } else if (KEY_HOLDERS.includes(n.type) && !n.computed && n.key?.type === "Identifier"
        && typeof n.key.start === "number" && typeof n.key.end === "number") {
        const raw = text.slice(n.key.start, n.key.end);
        if (HAN.test(raw)) {
          const value = restore(toTw(raw));
          if (value !== raw) edits.push({ start: n.key.start, end: n.key.end, value });
        }
      }
    }
    for (const key of Object.keys(n)) {
      if (key === "loc" || key === "start" || key === "end" || key === "range") continue;
      const child = n[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  };
  visit(ast.program);
  return edits;
}

function converted(text: string, file: string): { value: string; changes: number } {
  if (!HAN.test(text)) return { value: text, changes: 0 };
  const own = OWN_FILES.includes(path.relative(ROOT, file).replace(/\\/g, "/"))
    || OWN_DIRS.some((dir) => path.relative(ROOT, file).replace(/\\/g, "/").startsWith(`${dir}/`));
  if (CODE_EXT.has(path.extname(file)) && !own) {
    // 一段文字轉一次可能還沒穩定（片語轉換有先後），轉到不動點為止。
    let out = text;
    let changes = 0;
    for (let round = 0; round < 4; round++) {
      const edits = codeEdits(out);
      if (!edits.length) break;
      for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.value + out.slice(e.end);
      changes += edits.length;
    }
    return { value: out, changes };
  }
  let value = text;
  let changes = 0;
  for (let round = 0; round < 4; round++) {
    const next = restore(toTw(value));
    if (next === value) break;
    value = next;
    changes += 1;
  }
  return { value, changes };
}

const mode = process.argv.includes("--check") ? "check" : process.argv.includes("--list") ? "list" : "write";
const all = targets();
if (mode === "list") {
  for (const f of all) console.log(path.relative(ROOT, f));
  console.log(`${all.length} files`);
} else {
  let files = 0;
  let changes = 0;
  for (const f of all) {
    const text = readFileSync(f, "utf8");
    const res = converted(text, f);
    if (!res.changes) continue;
    files += 1;
    changes += res.changes;
    if (mode === "check") console.log(`${path.relative(ROOT, f)}  ${res.changes}`);
    else {
      writeFileSync(f, res.value);
      console.log(`${path.relative(ROOT, f)}  ${res.changes}`);
    }
  }
  console.log(mode === "check" ? `${files} file(s) would change, ${changes} place(s)` : `${files} file(s) converted, ${changes} place(s)`);
}
