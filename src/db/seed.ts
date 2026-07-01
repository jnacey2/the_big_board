import { getDb, stocks } from "./index";
import { STOCK_UNIVERSE, BENCHMARK } from "./universe";

export async function seedStocks() {
  const db = await getDb();
  const all = [...STOCK_UNIVERSE, BENCHMARK];
  for (const s of all) {
    await db
      .insert(stocks)
      .values({
        ticker: s.ticker,
        name: s.name,
        sector: s.sector,
        category: s.category,
        productsBlurb: s.productsBlurb,
        howMoneyBlurb: s.howMoneyBlurb,
        bullBlurb: s.bullBlurb,
        bearBlurb: s.bearBlurb,
        teachingConcept: s.teachingConcept,
        isBenchmark: s.isBenchmark ?? false,
      })
      .onConflictDoNothing();
  }
  return all.length;
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seedStocks()
    .then((n) => {
      console.log(`Seeded ${n} stocks`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
