// 封面模組的地址宣告：它自己的一個讀取接口（清單頁的封面欄用），沒有頁面或跳轉。
import { defineModule } from "@aihot/contracts/modules";

export const covers = defineModule({ name: "covers", apiPaths: [/^\/api\/covers\//] });
