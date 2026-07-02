import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
  boolean,
  date,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/** Kids and the robot rival. kind = 'kid' | 'robot' */
export const kids = pgTable("kids", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().default("kid"),
  name: text("name").notNull(),
  teamName: text("team_name").notNull(),
  mascot: text("mascot").notNull().default("🚀"),
  color: text("color").notNull().default("#22d3ee"),
  startingBudget: doublePrecision("starting_budget").notNull().default(500),
  tourSeen: boolean("tour_seen").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** The draftable stock universe (plus SPY as a non-draftable benchmark). */
export const stocks = pgTable("stocks", {
  ticker: text("ticker").primaryKey(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  industry: text("industry"),
  logoUrl: text("logo_url"),
  category: text("category").notNull(), // kid-facing grouping, e.g. "Games & Toys"
  description: text("description"), // official FMP profile description
  kidDescription: text("kid_description"), // Claude kid-friendly rewrite
  productsBlurb: text("products_blurb").notNull(), // "Stuff you know them for"
  howMoneyBlurb: text("how_money_blurb").notNull(), // "How this company makes money"
  bullBlurb: text("bull_blurb").notNull(), // "Why investors like it"
  bearBlurb: text("bear_blurb").notNull(), // "What could go wrong"
  teachingConcept: text("teaching_concept").notNull(),
  valuationLabel: text("valuation_label"), // cheap | fair | expensive | tricky
  isBenchmark: boolean("is_benchmark").notNull().default(false),
  active: boolean("active").notNull().default(true),
  profileFetchedAt: timestamp("profile_fetched_at"),
});

/** Real transactions logged by the parent (and mirrored robot SPY trades). */
export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kids.id),
    ticker: text("ticker")
      .notNull()
      .references(() => stocks.ticker),
    type: text("type").notNull(), // buy | sell | dividend
    shares: doublePrecision("shares").notNull().default(0),
    price: doublePrecision("price").notNull().default(0),
    amount: doublePrecision("amount").notNull(), // total dollars (+ for value in, used directly for dividends)
    tradeDate: date("trade_date").notNull(),
    note: text("note"),
    /** id of the kid transaction this robot trade mirrors */
    mirrorsTransactionId: integer("mirrors_transaction_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("tx_kid_idx").on(t.kidId), index("tx_ticker_idx").on(t.ticker)]
);

/** End-of-day portfolio value snapshots (one per kid/robot per market day). */
export const snapshots = pgTable(
  "snapshots",
  {
    id: serial("id").primaryKey(),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kids.id),
    snapDate: date("snap_date").notNull(),
    value: doublePrecision("value").notNull(), // holdings value + cash
    holdingsValue: doublePrecision("holdings_value").notNull(),
    cash: doublePrecision("cash").notNull(),
    invested: doublePrecision("invested").notNull(), // cumulative net dollars put to work
  },
  (t) => [uniqueIndex("snap_unique").on(t.kidId, t.snapDate)]
);

/** Draft sessions. */
export const drafts = pgTable("drafts", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("setup"), // setup | live | done
  rounds: integer("rounds").notNull().default(8),
  pickTimerSecs: integer("pick_timer_secs").notNull().default(0), // 0 = no timer
  kidOrder: jsonb("kid_order").notNull().$type<number[]>(), // kid ids in round-1 order
  currentPick: integer("current_pick").notNull().default(0), // 0-based overall pick number
  /** When the draft was turned into real buy transactions (equal-weight). */
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const draftPicks = pgTable(
  "draft_picks",
  {
    id: serial("id").primaryKey(),
    draftId: integer("draft_id")
      .notNull()
      .references(() => drafts.id),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kids.id),
    ticker: text("ticker")
      .notNull()
      .references(() => stocks.ticker),
    round: integer("round").notNull(),
    pickNumber: integer("pick_number").notNull(), // overall, 1-based
    commentary: text("commentary"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pick_unique").on(t.draftId, t.ticker)]
);

/** "Why I own it" theses, scored by the Coach. */
export const theses = pgTable(
  "theses",
  {
    id: serial("id").primaryKey(),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kids.id),
    ticker: text("ticker")
      .notNull()
      .references(() => stocks.ticker),
    body: text("body").notNull(),
    score: doublePrecision("score"), // 1-10
    feedback: text("feedback"),
    scoredAt: timestamp("scored_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("thesis_unique").on(t.kidId, t.ticker)]
);

export const badges = pgTable(
  "badges",
  {
    id: serial("id").primaryKey(),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kids.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    emoji: text("emoji").notNull(),
    awardedAt: timestamp("awarded_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("badge_unique").on(t.kidId, t.code)]
);

/** Coach chat history, per kid. */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kids.id),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("chat_kid_idx").on(t.kidId)]
);

/** Cached Claude-generated commentary, keyed by a content key. */
export const commentaryCache = pgTable(
  "commentary_cache",
  {
    id: serial("id").primaryKey(),
    cacheKey: text("cache_key").notNull(),
    content: text("content").notNull(),
    meta: jsonb("meta"),
    generatedAt: timestamp("generated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("commentary_key_unique").on(t.cacheKey)]
);

/** Annual fundamentals per ticker (last ~10 fiscal years + a TTM row with year = 0). */
export const fundamentals = pgTable(
  "fundamentals",
  {
    id: serial("id").primaryKey(),
    ticker: text("ticker")
      .notNull()
      .references(() => stocks.ticker),
    fiscalYear: integer("fiscal_year").notNull(), // 0 = TTM/current
    revenue: doublePrecision("revenue"),
    ebitda: doublePrecision("ebitda"),
    marketCap: doublePrecision("market_cap"),
    enterpriseValue: doublePrecision("enterprise_value"),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("fund_unique").on(t.ticker, t.fiscalYear)]
);

/** 15-minute quote cache. */
export const quotes = pgTable("quotes", {
  ticker: text("ticker")
    .primaryKey()
    .references(() => stocks.ticker),
  price: doublePrecision("price").notNull(),
  change: doublePrecision("change").notNull().default(0),
  changePct: doublePrecision("change_pct").notNull().default(0),
  prevClose: doublePrecision("prev_close"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Daily close price history cache (for charts, Sharpe, robot mirror, backfill). */
export const priceHistory = pgTable(
  "price_history",
  {
    id: serial("id").primaryKey(),
    ticker: text("ticker")
      .notNull()
      .references(() => stocks.ticker),
    priceDate: date("price_date").notNull(),
    close: doublePrecision("close").notNull(),
  },
  (t) => [
    uniqueIndex("hist_unique").on(t.ticker, t.priceDate),
    index("hist_ticker_idx").on(t.ticker),
  ]
);

/** Cached news per ticker. */
export const newsItems = pgTable(
  "news_items",
  {
    id: serial("id").primaryKey(),
    ticker: text("ticker")
      .notNull()
      .references(() => stocks.ticker),
    title: text("title").notNull(),
    url: text("url").notNull(),
    site: text("site"),
    summary: text("summary"),
    publishedAt: timestamp("published_at").notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("news_unique").on(t.ticker, t.url),
    index("news_ticker_idx").on(t.ticker),
  ]
);

/** Detected dividends awaiting parent confirmation. */
export const pendingDividends = pgTable(
  "pending_dividends",
  {
    id: serial("id").primaryKey(),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kids.id),
    ticker: text("ticker")
      .notNull()
      .references(() => stocks.ticker),
    payDate: date("pay_date").notNull(),
    amountPerShare: doublePrecision("amount_per_share").notNull(),
    shares: doublePrecision("shares").notNull(),
    total: doublePrecision("total").notNull(),
    status: text("status").notNull().default("pending"), // pending | confirmed | dismissed
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("div_unique").on(t.kidId, t.ticker, t.payDate)]
);

/** Claude-generated deep-dive content per stock (rationale, risks). */
export const stockAnalysis = pgTable("stock_analysis", {
  ticker: text("ticker")
    .primaryKey()
    .references(() => stocks.ticker),
  rationaleKid: text("rationale_kid"),
  rationaleGrownup: text("rationale_grownup"),
  risks: jsonb("risks").$type<string[]>(),
  generatedAt: timestamp("generated_at"),
});

/** Simple app settings key/value store. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
});
