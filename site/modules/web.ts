// What the site's modules add to the web pages (site/modules/index.ts).
import { ageGateWeb } from "@aihot/age-gate/web";
import type { WebModule } from "@aihot/web/modules";

export const WEB_MODULES: readonly WebModule[] = [ageGateWeb];
