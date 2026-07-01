import { and, eq, gte, inArray, sql } from "drizzle-orm";
import {
  getDb,
  quotes,
  priceHistory,
  newsItems,
  stocks,
  fundamentals,
} from "@/db";
import { isMarketOpen } from "./market";

const BASE = "https://financialmodelingprep.com/api/v3";
const QUOTE_TTL_OPEN_MS = 15 * 60 * 1000; // 15 min during market hours
const QUOTE_TTL_CLOSED_MS = 6 * 60 * 60 * 1000; // 6h when closed
const NEWS_TTL_MS = 30 * 60 * 1000;

export function hasFmp(): boolean {
  const k = process.env.FMP_API_KEY;
  return Boolean(k) && !/your_|_here/i.test(k!);
}

function key(): string {
  const k = process.env.FMP_API_KEY;
  if (!k || !hasFmp()) throw new Error("FMP_API_KEY is not set");
  return k;
}

async function fmpGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!hasFmp()) throw new Error(`FMP skipped (no API key): ${path}`);
  return fmpFetch(path, params);
}

async function fmpFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ ...params, apikey: key() });
  const res = await fetch(`${BASE}${path}?${qs}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`FMP ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// ── Quotes ────────────────────────────────────────────────────────

export type Quote = {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  prevClose: number | null;
  updatedAt: Date;
};

type FmpQuote = {
  symbol: string;
  price: number;
  change: number;
  changesPercentage: number;
  previousClose: number;
};

/** Get quotes for tickers, refreshing any that are stale (15-min TTL when market open). */
export async function getQuotes(tickers: string[]): Promise<Map<string, Quote>> {
  if (tickers.length === 0) return new Map();
  const db = await getDb();
  const ttl = isMarketOpen() ? QUOTE_TTL_OPEN_MS : QUOTE_TTL_CLOSED_MS;
  const cutoff = new Date(Date.now() - ttl);

  const cached = await db.select().from(quotes).where(inArray(quotes.ticker, tickers));
  const fresh = new Map<string, Quote>();
  for (const q of cached) {
    if (q.updatedAt > cutoff) {
      fresh.set(q.ticker, {
        ticker: q.ticker,
        price: q.price,
        change: q.change,
        changePct: q.changePct,
        prevClose: q.prevClose,
        updatedAt: q.updatedAt,
      });
    }
  }

  const stale = tickers.filter((t) => !fresh.has(t));
  if (stale.length > 0) {
    try {
      const data = await fmpGet<FmpQuote[]>(`/quote/${stale.join(",")}`);
      const now = new Date();
      for (const d of data) {
        const q: Quote = {
          ticker: d.symbol,
          price: d.price,
          change: d.change ?? 0,
          changePct: d.changesPercentage ?? 0,
          prevClose: d.previousClose ?? null,
          updatedAt: now,
        };
        fresh.set(d.symbol, q);
        await db
          .insert(quotes)
          .values({
            ticker: q.ticker,
            price: q.price,
            change: q.change,
            changePct: q.changePct,
            prevClose: q.prevClose,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: quotes.ticker,
            set: {
              price: q.price,
              change: q.change,
              changePct: q.changePct,
              prevClose: q.prevClose,
              updatedAt: now,
            },
          });
      }
    } catch (e) {
      // On FMP failure, fall back to whatever stale cache exists.
      if (hasFmp()) console.error("Quote refresh failed:", e);
      for (const q of cached) {
        if (!fresh.has(q.ticker)) {
          fresh.set(q.ticker, {
            ticker: q.ticker,
            price: q.price,
            change: q.change,
            changePct: q.changePct,
            prevClose: q.prevClose,
            updatedAt: q.updatedAt,
          });
        }
      }
    }
  }
  return fresh;
}

// ── Historical prices ─────────────────────────────────────────────

type FmpHistorical = {
  historical?: { date: string; close: number }[];
};

/**
 * Ensure daily close history exists in the DB for a ticker from `fromDate` onward.
 * Fetches from FMP only when the cached range is incomplete.
 */
export async function ensurePriceHistory(ticker: string, fromDate: string): Promise<void> {
  const db = await getDb();
  const [latest] = await db
    .select({ max: sql<string | null>`max(${priceHistory.priceDate})` })
    .from(priceHistory)
    .where(eq(priceHistory.ticker, ticker));
  const [earliest] = await db
    .select({ min: sql<string | null>`min(${priceHistory.priceDate})` })
    .from(priceHistory)
    .where(eq(priceHistory.ticker, ticker));

  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const haveFrom = earliest?.min ?? null;
  const haveTo = latest?.max ?? null;
  const needsEarlier = !haveFrom || haveFrom > fromDate;
  const needsLater = !haveTo || haveTo < yesterday;
  if (!needsEarlier && !needsLater) return;

  const data = await fmpGet<FmpHistorical>(
    `/historical-price-full/${ticker}`,
    { from: fromDate, serietype: "line" }
  );
  const rows = data.historical ?? [];
  if (rows.length === 0) return;
  // Insert in chunks to keep statements reasonable.
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200).map((r) => ({
      ticker,
      priceDate: r.date,
      close: r.close,
    }));
    await db.insert(priceHistory).values(chunk).onConflictDoNothing();
  }
}

export async function getPriceHistory(
  ticker: string,
  fromDate: string
): Promise<{ date: string; close: number }[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(priceHistory)
    .where(and(eq(priceHistory.ticker, ticker), gte(priceHistory.priceDate, fromDate)))
    .orderBy(priceHistory.priceDate);
  return rows.map((r) => ({ date: r.priceDate, close: r.close }));
}

// ── Profiles ──────────────────────────────────────────────────────

type FmpProfile = {
  symbol: string;
  companyName: string;
  industry: string;
  sector: string;
  description: string;
  image: string;
};

/** Fetch and store profile (logo, industry, description) for tickers missing one. */
export async function ensureProfiles(tickers: string[]): Promise<void> {
  const db = await getDb();
  const rows = await db.select().from(stocks).where(inArray(stocks.ticker, tickers));
  const missing = rows.filter((r) => !r.profileFetchedAt).map((r) => r.ticker);
  for (const t of missing) {
    try {
      const [p] = await fmpGet<FmpProfile[]>(`/profile/${t}`);
      if (!p) continue;
      await db
        .update(stocks)
        .set({
          industry: p.industry,
          logoUrl: p.image,
          description: p.description,
          profileFetchedAt: new Date(),
        })
        .where(eq(stocks.ticker, t));
    } catch (e) {
      if (hasFmp()) console.error(`Profile fetch failed for ${t}:`, e);
    }
  }
}

// ── News ──────────────────────────────────────────────────────────

type FmpNews = {
  symbol: string;
  publishedDate: string;
  title: string;
  site: string;
  text: string;
  url: string;
};

export async function getNews(ticker: string, limit = 8) {
  const db = await getDb();
  const cutoff = new Date(Date.now() - NEWS_TTL_MS);
  const existing = await db
    .select()
    .from(newsItems)
    .where(eq(newsItems.ticker, ticker))
    .orderBy(sql`${newsItems.publishedAt} desc`)
    .limit(limit);

  const freshEnough = existing.length > 0 && existing[0].fetchedAt > cutoff;
  if (!freshEnough) {
    try {
      const data = await fmpGet<FmpNews[]>(`/stock_news`, {
        tickers: ticker,
        limit: String(limit),
      });
      for (const n of data) {
        await db
          .insert(newsItems)
          .values({
            ticker,
            title: n.title,
            url: n.url,
            site: n.site,
            summary: n.text?.slice(0, 500) ?? null,
            publishedAt: new Date(n.publishedDate),
          })
          .onConflictDoNothing();
      }
      return db
        .select()
        .from(newsItems)
        .where(eq(newsItems.ticker, ticker))
        .orderBy(sql`${newsItems.publishedAt} desc`)
        .limit(limit);
    } catch (e) {
      if (hasFmp()) console.error(`News fetch failed for ${ticker}:`, e);
    }
  }
  return existing;
}

// ── Fundamentals (income statements + enterprise values) ─────────

type FmpIncome = {
  calendarYear: string;
  revenue: number;
  ebitda: number;
};
type FmpEV = {
  date: string; // fiscal date
  marketCapitalization: number;
  enterpriseValue: number;
};

const FUNDAMENTALS_TTL_MS = 90 * 24 * 3600 * 1000; // quarterly

/** Fetch ~10y of annual revenue/EBITDA/mktcap/EV for a ticker, cached quarterly. */
export async function ensureFundamentals(ticker: string): Promise<void> {
  const db = await getDb();
  const existing = await db
    .select()
    .from(fundamentals)
    .where(eq(fundamentals.ticker, ticker))
    .limit(1);
  if (existing.length > 0 && existing[0].fetchedAt > new Date(Date.now() - FUNDAMENTALS_TTL_MS)) {
    return;
  }

  const [income, evs] = await Promise.all([
    fmpGet<FmpIncome[]>(`/income-statement/${ticker}`, { period: "annual", limit: "10" }),
    fmpGet<FmpEV[]>(`/enterprise-values/${ticker}`, { period: "annual", limit: "10" }),
  ]);

  const evByYear = new Map<number, FmpEV>();
  for (const ev of evs) evByYear.set(new Date(ev.date).getFullYear(), ev);

  const now = new Date();
  for (const row of income) {
    const year = Number(row.calendarYear);
    const ev = evByYear.get(year);
    await db
      .insert(fundamentals)
      .values({
        ticker,
        fiscalYear: year,
        revenue: row.revenue ?? null,
        ebitda: row.ebitda ?? null,
        marketCap: ev?.marketCapitalization ?? null,
        enterpriseValue: ev?.enterpriseValue ?? null,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: [fundamentals.ticker, fundamentals.fiscalYear],
        set: {
          revenue: row.revenue ?? null,
          ebitda: row.ebitda ?? null,
          marketCap: ev?.marketCapitalization ?? null,
          enterpriseValue: ev?.enterpriseValue ?? null,
          fetchedAt: now,
        },
      });
  }
}

export async function getFundamentals(ticker: string) {
  const db = await getDb();
  return db
    .select()
    .from(fundamentals)
    .where(eq(fundamentals.ticker, ticker))
    .orderBy(fundamentals.fiscalYear);
}

// ── Dividends ─────────────────────────────────────────────────────

type FmpDividend = {
  date: string; // ex-date
  paymentDate: string;
  dividend: number;
};

export async function getDividendHistory(ticker: string): Promise<FmpDividend[]> {
  const data = await fmpGet<{ historical?: FmpDividend[] }>(
    `/historical-price-full/stock_dividend/${ticker}`
  );
  return data.historical ?? [];
}
