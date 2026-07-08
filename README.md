# 📈 The Big Board

A family stock-market competition app that teaches kids how to invest real money.
Two (or more) kids draft companies fantasy-sports style, one tap turns the
draft into equal-weighted portfolios at the latest prices, and everyone watches
the race — with an AI Coach explaining every move in kid-friendly language.

## What's inside

- **Draft Day** — snake draft over 40 kid-friendly companies with flippable
  scouting cards (products they know, how the company makes money, bull/bear
  cases, valuation labels, teaching concepts) and live Coach commentary. When
  the draft ends, a "Buy the portfolios!" button splits each kid's budget
  equally across their picks at the last available prices (fractional shares).
- **The Race** — growth-of-$100 chart for every kid plus **Indexo**, a robot
  rival that starts with the same budget as a kid and puts all of it into SPY
  on draft day, so they can see how they stack up against "just buying the
  market."
- **Two championship belts** — Total Return and Best Risk-Adjusted (Sharpe).
- **Portfolio drill-downs** — sector donut, Sharpe/volatility with soccer-team
  risk analogies, per-position P&L, and a "news detective" panel for every
  holding.
- **Stock deep dives** — price history, revenue/EBITDA/margins/EV/EV-EBITDA
  over time, kid + grown-up investment rationale, and key risks.
- **Coach everywhere** — daily recaps, weekly recaps, movement summaries, a
  floating chat drawer, and a first-visit tour. The Coach uses
  hedged language ("likely", "may") and never gives buy/sell advice.
- **Parent HQ** (PIN-gated) — log additional fractional buys/sells, manage kids and
  budgets, confirm auto-detected dividends, read chat transcripts,
  export CSVs.
- **Badges, glossary tooltips, confetti,** and a market open/closed chip.

## Tech stack

| Layer      | Choice                                                      |
| ---------- | ----------------------------------------------------------- |
| Framework  | Next.js (App Router, TypeScript)                            |
| Styling    | Tailwind CSS v4, Framer Motion, Recharts, canvas-confetti   |
| Database   | Postgres via Drizzle ORM (PGlite locally, Render Postgres in prod) |
| Market data| Financial Modeling Prep (15-min quote cache, EOD snapshots) |
| AI Coach   | Anthropic Claude (Sonnet), responses cached in the DB       |

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in your keys:

```bash
FMP_API_KEY=...        # financialmodelingprep.com (Starter tier or above)
ANTHROPIC_API_KEY=...  # console.anthropic.com
ADMIN_PIN=1234         # parent PIN for Parent HQ
CRON_SECRET=...        # any random string
# DATABASE_URL is optional locally — PGlite (embedded Postgres) is used if unset
```

3. Start the dev server (the 40-stock universe is seeded automatically on first
   database init):

```bash
npm run dev
```

Open http://localhost:3000, add the kids on the setup screen, then head to
**Draft Day**.

The app degrades gracefully without API keys (prices show as cost basis and the
Coach sits out), but you'll want both keys for the real experience.

## Deploying to Render

`render.yaml` defines everything: a web service, a Postgres database, and a
nightly cron job (runs after market close to snapshot portfolios and detect
dividends).

1. On Render, create a **New Blueprint** and link this repo (branch `main`).
2. During Blueprint setup, Render prompts for the `sync: false` secrets:
   `FMP_API_KEY` (web service **and** cron job), plus `ANTHROPIC_API_KEY` and
   `ADMIN_PIN` (web service). `CRON_SECRET` and `DATABASE_URL` are wired up
   automatically.
3. Deploy. On first boot the app runs Drizzle migrations and seeds the
   40-stock universe automatically — no manual database steps.

## Useful scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm run db:generate  # regenerate Drizzle migrations after schema changes
npm run db:seed      # manually re-run the (automatic) stock universe seed
```

To reset all local data (kids, trades, drafts), delete the `.pglite/` folder.
