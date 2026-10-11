// The backend of the site's modules, installed by the api and the worker when they start (site/modules/index.ts).
import { coversServer } from "@aihot/covers/server";
import { fanzaServer } from "@aihot/fanza/server";
import type { ServerModule } from "@aihot/backend/modules";

export const SERVER_MODULES: readonly ServerModule[] = [fanzaServer, coversServer];
