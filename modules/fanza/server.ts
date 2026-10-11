// FANZA 模組接進後端的插口：一個定時任務。跑完的結果記在後臺「執行」頁（job_runs 的 detail）。
// 沒填憑證時整支任務不會註冊（框架的 when 會把它濾掉），後臺不會出現一個每次都回報「未設定」的排程。
import { credential } from "@aihot/backend/config";
import { defineServerModule } from "@aihot/backend/modules";
import { syncFanzaItems } from "./sync.ts";

/** 兩個憑證都在才會啟用；缺一個就當這個模組不存在。 */
const configured = (): boolean =>
  !!credential("collectors", "FANZA_API_ID") && !!credential("collectors", "FANZA_AFFILIATE_ID");

export const fanzaServer = defineServerModule({
  name: "fanza",
  schedules: [
    // 每 6 小時一次，慢半點避開整點的任務；停機錯過的一次之後補跑。
    { name: "fanza.items", cron: "20 */6 * * *", missed: "once", when: configured, run: () => syncFanzaItems() },
  ],
  admin: {
    currentJobs: async () => (configured() ? ["fanza.items"] : []),
  },
});
