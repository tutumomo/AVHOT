// 这个行业的分类体系：类别、标签词表、公司（主体）名录，以及防止张冠李戴的身份词典。
// 模型按这里的词表打标签，主题页（topics.json）按标签归类，筛选栏按类别分组。
// 换行业时：类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 是网址和接口里的身份，上线后不要改。
 * section 是日报里的分节标题（几个类别可以共用一节，按这里的顺序排）；guide 告诉结构抽取模型这一类收什么、
 * 和相邻类别的边界在哪（总的归类原则写在 prompts/structure.md 里）。
 * commentary 标出评论类（访谈、观点、专题）：日报写过的事又有评论类的后续报道，只占一行快讯（报道它的信源够多时除外）。
 * 没归上类的资料在日报里放进第一个 key 为 industry 的类别所在的节（没有就放最后一节）。
 * feedLabel 是分类 RSS 标题里的名字（不写就用 label）。公开接口、RSS 和 MCP 里要把一类并进另一类发布，写在站点设置里（site/site.ts 的 PUBLIC_CATEGORIES）。
 */
export const CATEGORIES = [
  { key: "new-releases", label: "新作", feedLabel: "AV 新作", section: "新作发售", guide: "新作与新片的发售情报：发售日、片名、系列、出演阵容、样品与预告、规格（VR、4K、串流先行、实体盘）与定价。厂商同时公布多部同批新作属于这一类，多个作品各自成条。判边界：作品本身的发售归这里；厂牌、体制或经营层面的变化归片商；平台自己的价格、政策与上架机制归平台。" },
  { key: "studios", label: "片商", feedLabel: "片商动态", section: "片商与品牌", guide: "片商与品牌的动向：新厂牌成立、厂牌改组或收摊、制作体制与专属契约、官方声明与更正、与通路或平台的分润谈判。判边界：单一作品的发售归新作；公司层面的并购、投资与人事归产业；出演者个人的移籍归出演者。" },
  { key: "performers", label: "出演者", feedLabel: "出演者动态", section: "出演者", guide: "出演者的个人动态：出道、引退、移籍、更名、专属与事务所异动、获奖、健康与休息声明、跨领域活动与个人品牌。判边界：所属片商的作品发售归新作；事务所本身的经营变化归产业；涉及权利或人身安全的制度性事件归政策法规。涉及未成年或非自愿的任何指控，只按已公开的事实与官方处置进展记录，不做推断。" },
  { key: "platforms", label: "平台", feedLabel: "平台与通路", section: "平台与通路", guide: "平台与通路：FANZA、MGS、DUGA 等官方商店与串流服务的政策变化、价格与订阅方案、地区与付款限制、上架与下架机制、搜索与推荐规则、官方 API 与联盟制度的调整。判边界：平台自己做的事归这里；片商在平台上的新作上架归新作；平台涉及的著作权诉讼归产业。" },
  { key: "industry", label: "产业", feedLabel: "产业动态", section: "产业动态", guide: "产业经营：公司设立与并购、投资与估值、财报与销售数据、人事与组织、与其他产业的合作、通路谈判、著作权与盗版诉讼、展会与商展的商业面。判边界：作品发售归新作；法规与主管机关的动作归政策法规；产业评论与观察归文化与观点。" },
  { key: "policy", label: "政策", feedLabel: "政策与权益", section: "政策与权益", guide: "法规、主管机关与业界规范：AV出演被害防止・救济法（AV新法）与相关修法、审查与伦理规范、行政指导、出演者人权与劳动条件、同意程序、海外市场的年龄验证与合规要求、业界自律组织的规则。判边界：具体公司被处分或起诉的经过归产业；对制度的讨论与评论归文化与观点。" },
  { key: "awards", label: "奖项", feedLabel: "奖项与榜单", section: "奖项与榜单", guide: "奖项、榜单与票选：FANZA ADULT AWARDS、スカパー!アダルト放送大赏、AV OPEN、AVN／XBIZ Awards 等入围与得奖名单、年度榜单与销售排行、票选活动的规则与结果。判边界：作品本身的发售归新作；得奖者个人的后续动向归出演者；活动的商业合作归产业。" },
  { key: "culture", label: "观点", section: "观点与文化", guide: "评论、访谈与产业观察：对产业现象的分析与批评、从业者访谈、纪录片与专题报道、社会与文化层面的讨论、历史回顾。判边界：报道新发生的事实归对应类别；这里的重点是作者的解释与判断。", commentary: true },
] as const satisfies ReadonlyArray<{ key: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/**
 * 这个行业最受关注的一类发布（AV 行业是新作）：日报报头的“N 部新作”、改分类后修订已出的报告都按它数。
 * category 是类别，tag 是标签，两者都对上才算；unit 接在数字后面。
 * 没有这样一类的行业设成 null，报头就不显示这个数。
 */
export const RELEASE: { category: string; tag: string; unit: string } | null = { category: "new-releases", tag: "新作情报", unit: "部新作" };

/** 周报月报的总述可以直接写、不必在报道里找到出处的行业通用词（小写）。站名会自动算进去。 */
export const PLAIN_TERMS: readonly string[] = ["av", "jav", "vr", "dvd", "bd", "4k", "8k", "hd", "sns", "18禁"];

/**
 * 内容理解一步给每篇资料判的“内容类型”（写在 prompts/content-understanding.md 里，改了类型要同步改那份提示词）。
 * 评分提示词（prompts/selection-score.md）按类型给五个维度不同的权重。
 */
export const ITEM_TYPES = ["new_release", "platform_update", "performer_news", "award_result", "industry_event", "opinion_analysis", "explainer"] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一。最后一项是模型没给出分类时的兜底。 */
export const CATEGORY_TAGS = [
  "新作情报", "片商动态", "出演者", "平台/通路", "产业经营", "政策/法规", "奖项/榜单", "产业观点", "盗版/取缔", "活动/展会", "其他",
] as const;

/** 可选的主题标签：题材与产业面向。 */
export const TOPIC_TAGS = [
  "VR", "企划单体", "系列作品", "素人", "熟女", "人妻", "剧情长篇", "偶像写真", "欧美", "亚洲其他", "男同向", "女同向", "动画/二次元",
  "出道", "引退", "移籍", "事务所", "导演/制作", "串流/订阅", "出演被害防止法", "人权/劳动",
] as const;

/** 可选的实体标签（片商、平台、业界机构）。 */
export const ENTITY_TAGS = ["SOD", "S1", "MOODYZ", "IdeaPocket", "Madonna", "PRESTIGE", "FALENO", "KMP", "FANZA", "MGS", "DUGA", "AVN", "XBIZ", "IPPA"] as const;

/** 模型常写的近义词，统一成词表里的写法。值必须落在上面的三个词表里。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  新作: "新作情报", 发售: "新作情报", 上市: "新作情报", 新片: "新作情报", 作品: "新作情报", 发布: "新作情报",
  厂商: "片商动态", 片商: "片商动态", 厂牌: "片商动态", 品牌: "片商动态", 制作公司: "片商动态",
  女优: "出演者", 男优: "出演者", 演员: "出演者", 优优: "出演者",
  平台: "平台/通路", 串流: "平台/通路", 订阅: "平台/通路", 通路: "平台/通路", 商店: "平台/通路",
  公司: "产业经营", 融资: "产业经营", 收购: "产业经营", 并购: "产业经营", 投资: "产业经营", 人事: "产业经营", 合作: "产业经营", 财报: "产业经营",
  法规: "政策/法规", 监管: "政策/法规", 法律: "政策/法规", 政策: "政策/法规", av新法: "政策/法规", 伦理: "政策/法规", 人权: "政策/法规",
  奖: "奖项/榜单", 奖项: "奖项/榜单", 榜单: "奖项/榜单", 排名: "奖项/榜单", 票选: "奖项/榜单",
  评论: "产业观点", 观点: "产业观点", 观察: "产业观点", 访谈: "产业观点", 专题: "产业观点", 文化: "产业观点",
  盗版: "盗版/取缔", 取缔: "盗版/取缔", 侵权: "盗版/取缔", 磁力: "盗版/取缔", 侵权诉讼: "盗版/取缔",
  题材: "其他", 类型: "其他", 体裁: "其他",
  展会: "活动/展会", 活动: "活动/展会", 颁奖: "活动/展会",
};

// ── 公司与主体 ──────────────────────────────────────────────────────────────────────────

/**
 * 公司主题：id → 显示名、卡片上显示的标签（null 表示只用 entity:<id> 归类）、别名。
 * aliases 给结构抽取模型看；otherNames 是公司自己的其他称呼（官方账号名、子品牌），
 * 把事实的主体对到发布方时也认它们。片商与平台的口径按运营方归属（例：S1、MOODYZ 同属北都）。
 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; otherNames?: string[] }> = {
  // 日本主要片商与集团
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
  // 平台与通路
  fanza: { name: "FANZA", displayTag: "FANZA", aliases: ["FANZA", "DMM", "DMM.com"], otherNames: ["FANZA動画", "FANZA TV", "DMMアダルト"] },
  mgs: { name: "MGS動画", displayTag: null, aliases: ["MGS", "MGS動画", "MGStage"] },
  duga: { name: "DUGA", displayTag: null, aliases: ["DUGA"] },
  adultempire: { name: "Adult Empire", displayTag: null, aliases: ["Adult Empire", "adultempire"] },
  pornhub: { name: "Pornhub", displayTag: null, aliases: ["Pornhub"] },
  aylo: { name: "Aylo", displayTag: null, aliases: ["Aylo", "MindGeek"], otherNames: ["Brazzers", "Reality Kings", "Digital Playground"] },
  onlyfans: { name: "OnlyFans", displayTag: null, aliases: ["OnlyFans", "Fenix International"] },
  manyvids: { name: "ManyVids", displayTag: null, aliases: ["ManyVids"] },
  vixen: { name: "Vixen Media Group", displayTag: null, aliases: ["Vixen", "Vixen Media Group"], otherNames: ["Blacked", "Tushy", "Deeper", "Vixen"] },
  adulttime: { name: "Adult Time", displayTag: null, aliases: ["Adult Time", "Gamma Entertainment"] },
  // 业界机构与媒体
  ippa: { name: "IPPA（知的財産振興協会）", displayTag: null, aliases: ["IPPA", "知的財産振興協会"] },
  avn: { name: "AVN", displayTag: null, aliases: ["AVN", "Adult Video News"] },
  xbiz: { name: "XBIZ", displayTag: null, aliases: ["XBIZ"] },
  fsc: { name: "Free Speech Coalition", displayTag: null, aliases: ["Free Speech Coalition", "FSC"] },
  apag: { name: "APAG（出演者工会）", displayTag: null, aliases: ["APAG", "Adult Performance Artists Guild"] },
  tpowers: { name: "ティーパワーズ", displayTag: null, aliases: ["ティーパワーズ", "T-Powers", "T-POWERS"] },
  paps: { name: "ぱっぷす（PAPS）", displayTag: null, aliases: ["ぱっぷす", "PAPS"] },
};

/**
 * 身份词典：摘要和标题里出现的公司或片商，必须在原文里也出现过，否则退回原标题、丢掉摘要（防止模型张冠李戴）。
 * 行业没有这个问题时可以留空数组。这里只放最容易认错的几家；行业名录在 ENTITIES 里。
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
  { id: "mgs", name: "MGS動画", patterns: [/\bmgs\b/i, /mgstage/i, /MGS動画/] },
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
 * 这些域名上的文章，发布方就是对应的公司（只放已经核对过的官方域名；托管平台不算）。
 * 加新信源时先确认官方域名，再写到这里；填错会把别人的文章记到这家名下。
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

/** 原文里的这些写法也算提到了对应公司。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [
  { entityId: "fanza", pattern: /@FANZA_\w+/i },
  { entityId: "sod", pattern: /@SOD_create\b/i },
  { entityId: "moodyz", pattern: /@MOODYZ_OFFICIAL\b/i },
  { entityId: "onlyfans", pattern: /@OnlyFans\b/i },
];
