// The modules this site runs (modules/<name>/, see docs/architecture.md). A module has a line in each list
// it has an entry for: here for its addresses (module.ts), in server.ts for its backend, in web.ts for its
// pages' parts. Each list keeps the order its entries appear in on the site.
import { ageGate } from "@aihot/age-gate";
import { covers } from "@aihot/covers";
import { fanza } from "@aihot/fanza";
import type { ModuleDeclaration } from "@aihot/contracts/modules";

/** age-gate 沒有自己的頁面或介面，行為全在 web.tsx；fanza 沒有頁面，行為全在 server.ts 的排程；
 *  covers 有自己的一個讀取接口（清單頁封面欄用）。列在這裡是為了讓「本站跑了哪些模組」有一份完整清單。 */
export const MODULES: readonly ModuleDeclaration[] = [ageGate, fanza, covers];
