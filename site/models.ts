// 這個站用哪些模型。框架自帶一個 `default`：環境變數 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 指定的模型。
// 這裡再列出具名的模型（每個用自己的地址和金鑰環境變數），以及每一步預設用哪個；沒寫的步驟用 default。
// 部署時還可以用環境變數（PREFILTER_MODEL、SCORE_MODEL……）或後臺的“模型與評測”頁逐步改選。

export interface ModelPreset {
  service: string;
  model: string;
  baseUrlEnv: string;
  apiKeyEnv: string;
  /** 額外的請求欄位，比如短小的結構化任務關掉推理。 */
  extra?: Record<string, unknown>;
  /** 推理模型先想再答，額外給推理留的輸出額度（token），加在每一步自己的額度上。default 用環境變數 LLM_REASONING_TOKENS。 */
  reasoningTokens?: number;
  /** 介面支援 JSON 模式。 */
  jsonMode: boolean;
  /** 能看圖。 */
  vision?: boolean;
}

/** 具名的模型示例（每個要配自己的金鑰）。用不上可以刪掉。 */
export const PRESETS: Record<string, ModelPreset> = {
  // GLM 5.3 Flash always reasons; the lowest effort keeps short structured tasks fast.
  "glm-5.3-flash": {
    service: "zhipu", model: "glm-5.3-flash", baseUrlEnv: "ZHIPU_BASE_URL", apiKeyEnv: "ZHIPU_API_KEY",
    extra: { thinking: { type: "enabled" }, reasoning_effort: "low" }, jsonMode: true, vision: true,
  },
  // The scorer's parameters for glm-5.3-flash (score calls; temperature 1 is set per call).
  "glm-5.3-flash-selection": {
    service: "zhipu", model: "glm-5.3-flash", baseUrlEnv: "ZHIPU_BASE_URL", apiKeyEnv: "ZHIPU_API_KEY",
    extra: { thinking: { type: "enabled", clear_thinking: false }, reasoning_effort: "high", top_p: 0.95 }, jsonMode: true, vision: true,
  },
  // DeepSeek Flash reasons by default; structured tasks switch it off. deepseek-flash-think keeps it on,
  // with room in the output for the reasoning.
  "deepseek-flash": {
    service: "deepseek", model: "deepseek-flash", baseUrlEnv: "DEEPSEEK_BASE_URL", apiKeyEnv: "DEEPSEEK_API_KEY",
    extra: { thinking: { type: "disabled" } }, jsonMode: true,
  },
  "deepseek-flash-think": {
    service: "deepseek", model: "deepseek-flash", baseUrlEnv: "DEEPSEEK_BASE_URL", apiKeyEnv: "DEEPSEEK_API_KEY", reasoningTokens: 4000, jsonMode: true,
  },
  "qwen3.7-flash": {
    service: "dashscope", model: "qwen3.7-flash", baseUrlEnv: "DASHSCOPE_BASE_URL", apiKeyEnv: "DASHSCOPE_API_KEY",
    extra: { enable_thinking: false }, jsonMode: true,
  },
  "qwen3.8-flash": {
    service: "dashscope", model: "qwen3.8-flash", baseUrlEnv: "DASHSCOPE_BASE_URL", apiKeyEnv: "DASHSCOPE_API_KEY",
    extra: { enable_thinking: false }, jsonMode: true,
  },
  "mimo-v2.6-flash": {
    service: "mimo", model: "mimo-v2.6-flash", baseUrlEnv: "XIAOMI_MIMO_BASE_URL", apiKeyEnv: "XIAOMI_MIMO_API_KEY",
    extra: { thinking: { type: "disabled" } }, jsonMode: true,
  },
  "qwen3-vl-flash": {
    service: "dashscope", model: "qwen3-vl-flash", baseUrlEnv: "DASHSCOPE_BASE_URL", apiKeyEnv: "DASHSCOPE_API_KEY",
    extra: { enable_thinking: false }, jsonMode: false, vision: true,
  },
  // MiniMax（基地臺 https://api.minimaxi.chat/v1）。M 系列會先想再答，給推理留出輸出額度；
  // 它的 OpenAI 相容介面不一定接受 response_format，因此 jsonMode 關掉，由提示詞要求純 JSON。
  "minimax-m3": {
    service: "minimax", model: "MiniMax-M3", baseUrlEnv: "MINIMAX_BASE_URL", apiKeyEnv: "MINIMAX_API_KEY",
    reasoningTokens: 4000, jsonMode: false,
  },
  "minimax-m2.7-highspeed": {
    service: "minimax", model: "MiniMax-M2.7-highspeed", baseUrlEnv: "MINIMAX_BASE_URL", apiKeyEnv: "MINIMAX_API_KEY",
    reasoningTokens: 4000, jsonMode: false,
  },
};

/**
 * 每一步預設用的模型（步驟見後臺“模型與評測”頁），值是上面的名字或 default。沒寫的步驟用 default。
 * 例：{ score: "glm-5.3-flash-selection", groupReview: "mimo-v2.6-flash" }
 */
export const DEFAULTS: Record<string, string> = {};
