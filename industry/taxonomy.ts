// 這個行業的分類體系：類別、標籤詞表、公司（主體）名錄，以及防止張冠李戴的身份詞典。
// 模型按這裡的詞表打標籤，主題頁（topics.json）按標籤歸類，篩選欄按類別分組。
// 換行業時：類別的 key 會出現在網址裡（/all?category=…），上線後就不要再改；標籤和名錄可以隨時增減。

/**
 * 網頁上的類別（篩選欄、卡片角標、RSS 分類訂閱）。key 是網址和介面裡的身份，上線後不要改。
 * section 是日報裡的分節標題（幾個類別可以共用一節，按這裡的順序排）；guide 告訴結構抽取模型這一類收什麼、
 * 和相鄰類別的邊界在哪（總的歸類原則寫在 prompts/structure.md 裡）。
 * commentary 標出評論類（訪談、觀點、專題）：日報寫過的事又有評論類的後續報道，只佔一行快訊（報道它的信源夠多時除外）。
 * 沒歸上類的資料在日報裡放進第一個 key 為 industry 的類別所在的節（沒有就放最後一節）。
 * feedLabel 是分類 RSS 標題裡的名字（不寫就用 label）。公開介面、RSS 和 MCP 裡要把一類並進另一類釋出，寫在站點設定裡（site/site.ts 的 PUBLIC_CATEGORIES）。
 */
export const CATEGORIES = [
  { key: "new-releases", label: "新作", feedLabel: "AV 新作", section: "新作發售", guide: "新作與新片的發售情報：發售日、片名、系列、出演陣容、樣品與預告、規格（VR、4K、串流先行、實體盤）與定價。廠商同時公佈多部同批新作屬於這一類，多個作品各自成條。判邊界：作品本身的發售歸這裡；廠牌、體制或經營層面的變化歸片商；平臺自己的價格、政策與上架機制歸平臺。" },
  { key: "studios", label: "片商", feedLabel: "片商動態", section: "片商與品牌", guide: "片商與品牌的動向：新廠牌成立、廠牌改組或收攤、製作體制與專屬契約、官方宣告與更正、與通路或平臺的分潤談判。判邊界：單一作品的發售歸新作；公司層面的併購、投資與人事歸產業；出演者個人的移籍歸出演者。" },
  { key: "performers", label: "出演者", feedLabel: "出演者動態", section: "出演者", guide: "出演者的個人動態：出道、引退、移籍、更名、專屬與事務所異動、獲獎、健康與休息宣告、跨領域活動與個人品牌。判邊界：所屬片商的作品發售歸新作；事務所本身的經營變化歸產業；涉及權利或人身安全的制度性事件歸政策法規。涉及未成年或非自願的任何指控，只按已公開的事實與官方處置進展記錄，不做推斷。" },
  { key: "platforms", label: "平臺", feedLabel: "平臺與通路", section: "平臺與通路", guide: "平臺與通路：FANZA、MGS、DUGA 等官方商店與串流服務的政策變化、價格與訂閱方案、地區與付款限制、上架與下架機制、搜尋與推薦規則、官方 API 與聯盟制度的調整。判邊界：平臺自己做的事歸這裡；片商在平臺上的新作上架歸新作；平臺涉及的著作權訴訟歸產業。" },
  { key: "industry", label: "產業", feedLabel: "產業動態", section: "產業動態", guide: "產業經營：公司設立與併購、投資與估值、財報與銷售資料、人事與組織、與其他產業的合作、通路談判、著作權與盜版訴訟、展會與商展的商業面。判邊界：作品發售歸新作；法規與主管機關的動作歸政策法規；產業評論與觀察歸文化與觀點。" },
  { key: "policy", label: "政策", feedLabel: "政策與權益", section: "政策與權益", guide: "法規、主管機關與業界規範：AV出演被害防止・救濟法（AV新法）與相關修法、審查與倫理規範、行政指導、出演者人權與勞動條件、同意程式、海外市場的年齡驗證與合規要求、業界自律組織的規則。判邊界：具體公司被處分或起訴的經過歸產業；對制度的討論與評論歸文化與觀點。" },
  { key: "awards", label: "獎項", feedLabel: "獎項與榜單", section: "獎項與榜單", guide: "獎項、榜單與票選：FANZA ADULT AWARDS、スカパー!アダルト放送大賞、AV OPEN、AVN／XBIZ Awards 等入圍與得獎名單、年度榜單與銷售排行、票選活動的規則與結果。判邊界：作品本身的發售歸新作；得獎者個人的後續動向歸出演者；活動的商業合作歸產業。" },
  { key: "culture", label: "觀點", section: "觀點與文化", guide: "評論、訪談與產業觀察：對產業現象的分析與批評、從業者訪談、紀錄片與專題報道、社會與文化層面的討論、歷史回顧。判邊界：報道新發生的事實歸對應類別；這裡的重點是作者的解釋與判斷。", commentary: true },
] as const satisfies ReadonlyArray<{ key: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/**
 * 這個行業最受關注的一類釋出（AV 行業是新作）：日報報頭的“N 部新作”、改分類後修訂已出的報告都按它數。
 * category 是類別，tag 是標籤，兩者都對上才算；unit 接在數字後面。
 * 沒有這樣一類的行業設成 null，報頭就不顯示這個數。
 */
export const RELEASE: { category: string; tag: string; unit: string } | null = { category: "new-releases", tag: "新作情報", unit: "部新作" };

/** 週報月報的總述可以直接寫、不必在報道里找到出處的行業通用詞（小寫）。站名會自動算進去。 */
export const PLAIN_TERMS: readonly string[] = ["av", "jav", "vr", "dvd", "bd", "4k", "8k", "hd", "sns", "18禁"];

/**
 * 內容理解一步給每篇資料判的“內容型別”（寫在 prompts/content-understanding.md 裡，改了型別要同步改那份提示詞）。
 * 評分提示詞（prompts/selection-score.md）按型別給五個維度不同的權重。
 */
export const ITEM_TYPES = ["new_release", "platform_update", "performer_news", "award_result", "industry_event", "opinion_analysis", "explainer"] as const;

// ── 標籤詞表 ────────────────────────────────────────────────────────────────────────────

/** 每篇資料的第一個標籤必須是這些“分類標籤”之一。最後一項是模型沒給出分類時的兜底。 */
export const CATEGORY_TAGS = [
  "新作情報", "片商動態", "出演者", "平臺/通路", "產業經營", "政策/法規", "獎項/榜單", "產業觀點", "盜版/取締", "活動/展會", "其他",
] as const;

/** 可選的主題標籤：題材與產業面向。 */
export const TOPIC_TAGS = [
  "VR", "企劃單體", "系列作品", "素人", "熟女", "人妻", "劇情長篇", "偶像寫真", "歐美", "亞洲其他", "男同向", "女同向", "動畫/二次元",
  "出道", "引退", "移籍", "事務所", "導演/製作", "串流/訂閱", "出演被害防止法", "人權/勞動",
] as const;

/** 可選的實體標籤（片商、平臺、業界機構）。 */
export const ENTITY_TAGS = ["SOD", "S1", "MOODYZ", "IdeaPocket", "Madonna", "PRESTIGE", "FALENO", "KMP", "FANZA", "MGS", "DUGA", "AVN", "XBIZ", "IPPA"] as const;

/** 模型常寫的近義詞，統一成詞表裡的寫法。值必須落在上面的三個詞表裡。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  新作: "新作情報", 發售: "新作情報", 上市: "新作情報", 新片: "新作情報", 作品: "新作情報", 釋出: "新作情報",
  廠商: "片商動態", 片商: "片商動態", 廠牌: "片商動態", 品牌: "片商動態", 製作公司: "片商動態",
  女優: "出演者", 男優: "出演者", 演員: "出演者", 優優: "出演者",
  平臺: "平臺/通路", 串流: "平臺/通路", 訂閱: "平臺/通路", 通路: "平臺/通路", 商店: "平臺/通路",
  公司: "產業經營", 融資: "產業經營", 收購: "產業經營", 併購: "產業經營", 投資: "產業經營", 人事: "產業經營", 合作: "產業經營", 財報: "產業經營",
  法規: "政策/法規", 監管: "政策/法規", 法律: "政策/法規", 政策: "政策/法規", av新法: "政策/法規", 倫理: "政策/法規", 人權: "政策/法規",
  獎: "獎項/榜單", 獎項: "獎項/榜單", 榜單: "獎項/榜單", 排名: "獎項/榜單", 票選: "獎項/榜單",
  評論: "產業觀點", 觀點: "產業觀點", 觀察: "產業觀點", 訪談: "產業觀點", 專題: "產業觀點", 文化: "產業觀點",
  盜版: "盜版/取締", 取締: "盜版/取締", 侵權: "盜版/取締", 磁力: "盜版/取締", 侵權訴訟: "盜版/取締",
  題材: "其他", 型別: "其他", 體裁: "其他",
  展會: "活動/展會", 活動: "活動/展會", 頒獎: "活動/展會",
};

// ── 公司與主體 ──────────────────────────────────────────────────────────────────────────

/**
 * 公司主題：id → 顯示名、卡片上顯示的標籤（null 表示只用 entity:<id> 歸類）、別名。
 * aliases 給結構抽取模型看；otherNames 是公司自己的其他稱呼（官方賬號名、子品牌），
 * 把事實的主體對到釋出方時也認它們。片商與平臺的口徑按運營方歸屬（例：S1、MOODYZ 同屬北都）。
 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; otherNames?: string[] }> = {
  // 日本主要片商與集團
  sod: { name: "SOD", displayTag: "SOD", aliases: ["SOD", "Soft On Demand", "SODクリエイト"], otherNames: ["SOD Create", "SOD STAR", "SOD女子社員"] },
  hokuto: { name: "北都", displayTag: null, aliases: ["北都", "Hokuto"], otherNames: ["CA", "Will"] },
  s1: { name: "S1", displayTag: "S1", aliases: ["S1", "S1 NO.1 STYLE", "エスワン"], otherNames: ["S1 No.1 Style"] },
  moodyz: { name: "MOODYZ", displayTag: "MOODYZ", aliases: ["MOODYZ", "ムーディーズ"] },
  ideapocket: { name: "IdeaPocket", displayTag: "IdeaPocket", aliases: ["IdeaPocket", "IDEA POCKET", "アイデアポケット"] },
  madonna: { name: "Madonna", displayTag: "Madonna", aliases: ["Madonna", "マドンナ", "Madonna-av"] },
  attackers: { name: "Attackers", displayTag: null, aliases: ["Attackers", "アタッカーズ"] },
  wanz: { name: "Wanz Factory", displayTag: null, aliases: ["Wanz Factory", "ワンズファクトリー", "WANZ"] },
  premium: { name: "PREMIUM", displayTag: null, aliases: ["PREMIUM", "プレミアム"] },
  prestige: { name: "PRESTIGE", displayTag: "PRESTIGE", aliases: ["PRESTIGE", "プレステージ"] },
  faleno: { name: "FALENO", displayTag: null, aliases: ["FALENO", "ファレノ"] },
  kmp: { name: "KMP", displayTag: null, aliases: ["KMP", "ケイ・エム・プロデュース", "million"] },
  dogma: { name: "Dogma", displayTag: null, aliases: ["Dogma", "ドグマ"] },
  honnaka: { name: "Honnaka", displayTag: null, aliases: ["Honnaka", "本中"] },
  tameikegoro: { name: "溜池ゴロー", displayTag: null, aliases: ["溜池ゴロー", "Tameike Goro"] },
  tma: { name: "TMA", displayTag: null, aliases: ["TMA"] },
  das: { name: "DAS", displayTag: null, aliases: ["DAS", "ダスッ"] },
  // 平臺與通路
  fanza: { name: "FANZA", displayTag: "FANZA", aliases: ["FANZA", "DMM", "DMM.com"], otherNames: ["FANZA動畫", "FANZA TV", "DMMアダルト"] },
  mgs: { name: "MGS動畫", displayTag: null, aliases: ["MGS", "MGS動畫", "MGStage"] },
  duga: { name: "DUGA", displayTag: null, aliases: ["DUGA"] },
  adultempire: { name: "Adult Empire", displayTag: null, aliases: ["Adult Empire", "adultempire"] },
  pornhub: { name: "Pornhub", displayTag: null, aliases: ["Pornhub"] },
  aylo: { name: "Aylo", displayTag: null, aliases: ["Aylo", "MindGeek"], otherNames: ["Brazzers", "Reality Kings", "Digital Playground"] },
  onlyfans: { name: "OnlyFans", displayTag: null, aliases: ["OnlyFans", "Fenix International"] },
  manyvids: { name: "ManyVids", displayTag: null, aliases: ["ManyVids"] },
  vixen: { name: "Vixen Media Group", displayTag: null, aliases: ["Vixen", "Vixen Media Group"], otherNames: ["Blacked", "Tushy", "Deeper", "Vixen"] },
  adulttime: { name: "Adult Time", displayTag: null, aliases: ["Adult Time", "Gamma Entertainment"] },
  // 業界機構與媒體
  ippa: { name: "IPPA（知的財産振興協会）", displayTag: null, aliases: ["IPPA", "知的財産振興協会"] },
  avn: { name: "AVN", displayTag: null, aliases: ["AVN", "Adult Video News"] },
  xbiz: { name: "XBIZ", displayTag: null, aliases: ["XBIZ"] },
  fsc: { name: "Free Speech Coalition", displayTag: null, aliases: ["Free Speech Coalition", "FSC"] },
  apag: { name: "APAG（出演者工會）", displayTag: null, aliases: ["APAG", "Adult Performance Artists Guild"] },
  tpowers: { name: "ティーパワーズ", displayTag: null, aliases: ["ティーパワーズ", "T-Powers", "T-POWERS"] },
  paps: { name: "ぱっぷす（PAPS）", displayTag: null, aliases: ["ぱっぷす", "PAPS"] },
};

/**
 * 身份詞典：摘要和標題裡出現的公司或片商，必須在原文裡也出現過，否則退回原標題、丟掉摘要（防止模型張冠李戴）。
 * 行業沒有這個問題時可以留空陣列。這裡只放最容易認錯的幾家；行業名錄在 ENTITIES 裡。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "sod", name: "SOD", patterns: [/\bsod\b/i, /soft\s?on\s?demand/i, /SODクリエイト/] },
  { id: "s1", name: "S1", patterns: [/\bs1\b/i, /S1\s*NO\.?1/i, /エスワン/] },
  { id: "moodyz", name: "MOODYZ", patterns: [/moodyz/i, /ムーディーズ/i] },
  { id: "ideapocket", name: "IdeaPocket", patterns: [/idea\s?pocket/i, /アイデアポケット/] },
  { id: "madonna", name: "Madonna", patterns: [/madonna/i, /マドンナ/] },
  { id: "prestige", name: "PRESTIGE", patterns: [/prestige/i, /プレステージ/] },
  { id: "faleno", name: "FALENO", patterns: [/faleno/i, /ファレノ/] },
  { id: "kmp", name: "KMP", patterns: [/\bkmp\b/i, /ケイ・エム・プロデュース/i] },
  { id: "attackers", name: "Attackers", patterns: [/attackers/i, /アタッカーズ/] },
  { id: "wanz", name: "Wanz Factory", patterns: [/wanz/i, /ワンズファクトリー/] },
  { id: "hokuto", name: "北都", patterns: [/北都/, /\bhokuto\b/i] },
  { id: "fanza", name: "FANZA", patterns: [/fanza/i, /\bdmm\b/i, /DMM\.com/i] },
  { id: "mgs", name: "MGS動畫", patterns: [/\bmgs\b/i, /mgstage/i, /MGS動畫/] },
  { id: "duga", name: "DUGA", patterns: [/\bduga\b/i] },
  { id: "pornhub", name: "Pornhub", patterns: [/pornhub/i] },
  { id: "onlyfans", name: "OnlyFans", patterns: [/onlyfans/i] },
  { id: "vixen", name: "Vixen Media Group", patterns: [/vixen/i, /\bblacked\b/i, /\btushy\b/i] },
  { id: "aylo", name: "Aylo", patterns: [/\baylo\b/i, /mindgeek/i, /brazzers/i, /reality\s?kings/i] },
  { id: "adultempire", name: "Adult Empire", patterns: [/adult\s?empire/i] },
  { id: "ippa", name: "IPPA", patterns: [/\bippa\b/i, /知的財産振興協会/] },
  { id: "avn", name: "AVN", patterns: [/\bavn\b/i, /adult\s?video\s?news/i] },
  { id: "xbiz", name: "XBIZ", patterns: [/\bxbiz\b/i] },
  { id: "fsc", name: "Free Speech Coalition", patterns: [/free\s?speech\s?coalition/i, /\bfsc\b/i] },
];

/**
 * 這些域名上的文章，釋出方就是對應的公司（只放已經核對過的官方域名；託管平臺不算）。
 * 加新信源時先確認官方域名，再寫到這裡；填錯會把別人的文章記到這家名下。
 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "fanza", domains: ["dmm.co.jp", "fanza.jp"] },
  { entityId: "mgs", domains: ["mgstage.com"] },
  { entityId: "duga", domains: ["duga.jp"] },
  { entityId: "pornhub", domains: ["pornhub.com"] },
  { entityId: "onlyfans", domains: ["onlyfans.com"] },
  { entityId: "avn", domains: ["avn.com"] },
  { entityId: "xbiz", domains: ["xbiz.com"] },
  { entityId: "adultempire", domains: ["adultempire.com"] },
];

/** 原文裡的這些寫法也算提到了對應公司。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [
  { entityId: "fanza", pattern: /@FANZA_\w+/i },
  { entityId: "sod", pattern: /@SOD_create\b/i },
  { entityId: "moodyz", pattern: /@MOODYZ_OFFICIAL\b/i },
  { entityId: "onlyfans", pattern: /@OnlyFans\b/i },
];
