// What the site's modules add to the web pages (site/modules/index.ts).
import { ageGateWeb } from "@aihot/age-gate/web";
import { coversWeb } from "@aihot/covers/web";
import type { WebModule } from "@aihot/web/modules";

export const WEB_MODULES: readonly WebModule[] = [ageGateWeb, coversWeb];
