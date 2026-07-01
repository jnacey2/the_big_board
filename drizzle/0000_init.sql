CREATE TABLE "badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"kid_id" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"emoji" text NOT NULL,
	"awarded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"kid_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commentary_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cache_key" text NOT NULL,
	"content" text NOT NULL,
	"meta" jsonb,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"draft_id" integer NOT NULL,
	"kid_id" integer NOT NULL,
	"ticker" text NOT NULL,
	"round" integer NOT NULL,
	"pick_number" integer NOT NULL,
	"commentary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'setup' NOT NULL,
	"rounds" integer DEFAULT 8 NOT NULL,
	"pick_timer_secs" integer DEFAULT 0 NOT NULL,
	"kid_order" jsonb NOT NULL,
	"current_pick" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fundamentals" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"revenue" double precision,
	"ebitda" double precision,
	"market_cap" double precision,
	"enterprise_value" double precision,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kids" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'kid' NOT NULL,
	"name" text NOT NULL,
	"team_name" text NOT NULL,
	"mascot" text DEFAULT '🚀' NOT NULL,
	"color" text DEFAULT '#22d3ee' NOT NULL,
	"starting_budget" double precision DEFAULT 500 NOT NULL,
	"tour_seen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"site" text,
	"summary" text,
	"published_at" timestamp NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_dividends" (
	"id" serial PRIMARY KEY NOT NULL,
	"kid_id" integer NOT NULL,
	"ticker" text NOT NULL,
	"pay_date" date NOT NULL,
	"amount_per_share" double precision NOT NULL,
	"shares" double precision NOT NULL,
	"total" double precision NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"price_date" date NOT NULL,
	"close" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"ticker" text PRIMARY KEY NOT NULL,
	"price" double precision NOT NULL,
	"change" double precision DEFAULT 0 NOT NULL,
	"change_pct" double precision DEFAULT 0 NOT NULL,
	"prev_close" double precision,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"kid_id" integer NOT NULL,
	"snap_date" date NOT NULL,
	"value" double precision NOT NULL,
	"holdings_value" double precision NOT NULL,
	"cash" double precision NOT NULL,
	"invested" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_analysis" (
	"ticker" text PRIMARY KEY NOT NULL,
	"rationale_kid" text,
	"rationale_grownup" text,
	"risks" jsonb,
	"generated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "stocks" (
	"ticker" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sector" text NOT NULL,
	"industry" text,
	"logo_url" text,
	"category" text NOT NULL,
	"description" text,
	"kid_description" text,
	"products_blurb" text NOT NULL,
	"how_money_blurb" text NOT NULL,
	"bull_blurb" text NOT NULL,
	"bear_blurb" text NOT NULL,
	"teaching_concept" text NOT NULL,
	"valuation_label" text,
	"is_benchmark" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"profile_fetched_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "theses" (
	"id" serial PRIMARY KEY NOT NULL,
	"kid_id" integer NOT NULL,
	"ticker" text NOT NULL,
	"body" text NOT NULL,
	"score" double precision,
	"feedback" text,
	"scored_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"kid_id" integer NOT NULL,
	"ticker" text NOT NULL,
	"type" text NOT NULL,
	"shares" double precision DEFAULT 0 NOT NULL,
	"price" double precision DEFAULT 0 NOT NULL,
	"amount" double precision NOT NULL,
	"trade_date" date NOT NULL,
	"note" text,
	"mirrors_transaction_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_kid_id_kids_id_fk" FOREIGN KEY ("kid_id") REFERENCES "public"."kids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_kid_id_kids_id_fk" FOREIGN KEY ("kid_id") REFERENCES "public"."kids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_kid_id_kids_id_fk" FOREIGN KEY ("kid_id") REFERENCES "public"."kids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_ticker_stocks_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."stocks"("ticker") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fundamentals" ADD CONSTRAINT "fundamentals_ticker_stocks_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."stocks"("ticker") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_ticker_stocks_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."stocks"("ticker") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_dividends" ADD CONSTRAINT "pending_dividends_kid_id_kids_id_fk" FOREIGN KEY ("kid_id") REFERENCES "public"."kids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_dividends" ADD CONSTRAINT "pending_dividends_ticker_stocks_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."stocks"("ticker") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_ticker_stocks_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."stocks"("ticker") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_ticker_stocks_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."stocks"("ticker") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_kid_id_kids_id_fk" FOREIGN KEY ("kid_id") REFERENCES "public"."kids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_analysis" ADD CONSTRAINT "stock_analysis_ticker_stocks_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."stocks"("ticker") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theses" ADD CONSTRAINT "theses_kid_id_kids_id_fk" FOREIGN KEY ("kid_id") REFERENCES "public"."kids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theses" ADD CONSTRAINT "theses_ticker_stocks_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."stocks"("ticker") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_kid_id_kids_id_fk" FOREIGN KEY ("kid_id") REFERENCES "public"."kids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_ticker_stocks_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."stocks"("ticker") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "badge_unique" ON "badges" USING btree ("kid_id","code");--> statement-breakpoint
CREATE INDEX "chat_kid_idx" ON "chat_messages" USING btree ("kid_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commentary_key_unique" ON "commentary_cache" USING btree ("cache_key");--> statement-breakpoint
CREATE UNIQUE INDEX "pick_unique" ON "draft_picks" USING btree ("draft_id","ticker");--> statement-breakpoint
CREATE UNIQUE INDEX "fund_unique" ON "fundamentals" USING btree ("ticker","fiscal_year");--> statement-breakpoint
CREATE UNIQUE INDEX "news_unique" ON "news_items" USING btree ("ticker","url");--> statement-breakpoint
CREATE INDEX "news_ticker_idx" ON "news_items" USING btree ("ticker");--> statement-breakpoint
CREATE UNIQUE INDEX "div_unique" ON "pending_dividends" USING btree ("kid_id","ticker","pay_date");--> statement-breakpoint
CREATE UNIQUE INDEX "hist_unique" ON "price_history" USING btree ("ticker","price_date");--> statement-breakpoint
CREATE INDEX "hist_ticker_idx" ON "price_history" USING btree ("ticker");--> statement-breakpoint
CREATE UNIQUE INDEX "snap_unique" ON "snapshots" USING btree ("kid_id","snap_date");--> statement-breakpoint
CREATE UNIQUE INDEX "thesis_unique" ON "theses" USING btree ("kid_id","ticker");--> statement-breakpoint
CREATE INDEX "tx_kid_idx" ON "transactions" USING btree ("kid_id");--> statement-breakpoint
CREATE INDEX "tx_ticker_idx" ON "transactions" USING btree ("ticker");