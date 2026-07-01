/**
 * Render Cron entrypoint: takes end-of-day snapshots for all kids (with backfill
 * for any missed days) and refreshes pending dividends.
 */
import { backfillAllSnapshots } from "../src/lib/portfolio";
import { detectDividends } from "../src/lib/dividends";

async function main() {
  await backfillAllSnapshots();
  await detectDividends();
  console.log("Snapshot cron complete");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
