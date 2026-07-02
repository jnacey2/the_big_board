import { getDb } from "./index";
import { STOCK_UNIVERSE, BENCHMARK } from "./universe";

/**
 * The stock universe is seeded automatically (and idempotently) whenever the
 * database is initialized — see seedStockUniverse in ./index.ts. This script
 * just triggers that init, for manually refreshing a local database.
 */
export async function seedStocks() {
  await getDb();
  return STOCK_UNIVERSE.length + 1; // + benchmark
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seedStocks()
    .then((n) => {
      console.log(`Seeded ${n} stocks (${BENCHMARK.ticker} benchmark included)`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
