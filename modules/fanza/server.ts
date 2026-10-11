// FANZA 模組接進後端的插口：一個定時任務。跑完的結果記在後臺「執行」頁（job_runs 的 detail）。
import { defineServerModule } from "@aihot/backend/modules";
import { syncFanzaItems } from "./sync.ts";

export const fanzaServer = defineServerModule({
  name: "fanza",
  schedules: [
    // 每 6 小時一次，慢半點避開整點的任務；停機錯過的一次之後補跑。
    { name: "fanza.items", cron: "20 */6 * * *", missed: "once", run: () => syncFanzaItems() },
  ],
  admin: {
    currentJobs: async () => ["fanza.items"],
  },
});
