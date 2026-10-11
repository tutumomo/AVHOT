// FANZA（DMM）官方新作模組的地址宣告：它沒有自己的頁面、跳轉或介面，行為全在 server.ts 的排程裡。
import { defineModule } from "@aihot/contracts/modules";

export const fanza = defineModule({ name: "fanza" });
