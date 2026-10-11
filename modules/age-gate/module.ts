// 年龄闸门模块的地址声明：它没有自己的页面、跳转或接口，全部行为都在 web.tsx 里
// （root.bootScript 在绘制前挡住内容，root.Bottom 画出确认层）。
import { defineModule } from "@aihot/contracts/modules";

export const ageGate = defineModule({ name: "age-gate" });
