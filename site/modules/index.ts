// The modules this site runs (modules/<name>/, see docs/architecture.md). A module has a line in each list
// it has an entry for: here for its addresses (module.ts), in server.ts for its backend, in web.ts for its
// pages' parts. Each list keeps the order its entries appear in on the site.
import { ageGate } from "@aihot/age-gate";
import type { ModuleDeclaration } from "@aihot/contracts/modules";

/** age-gate 没有自己的页面或接口，行为全在 web.tsx；列在这里是为了让“本站跑了哪些模块”有一份完整清单。 */
export const MODULES: readonly ModuleDeclaration[] = [ageGate];
