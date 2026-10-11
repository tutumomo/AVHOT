// 年齡閘門模組的地址宣告：它沒有自己的頁面、跳轉或介面，全部行為都在 web.tsx 裡
// （root.bootScript 在繪製前擋住內容，root.Bottom 畫出確認層）。
import { defineModule } from "@aihot/contracts/modules";

export const ageGate = defineModule({ name: "age-gate" });
