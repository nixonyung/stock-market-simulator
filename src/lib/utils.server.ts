import type { Index, StockRecord, WatchedStockRecord } from "#lib/types.js";
import { STOCK_DATA_DIR } from "$app/env/private";

export const INDEX_PATH = `${STOCK_DATA_DIR}/index.json`;
export const DATES_PATH = `${STOCK_DATA_DIR}/dates.json`;
export const WATCHLIST_PATH = `data/watchlist.json`;
export const TIMERANGE_REF_TICKER = "SPY";
export const getStockRecordsPath = (ticker: string) =>
  `${STOCK_DATA_DIR}/${ticker[0]}/${ticker}.txt`;

export async function loadIndex() {
  return (await Bun.file(INDEX_PATH).json()) as Index;
}

export async function loadDates() {
  return (await Bun.file(DATES_PATH).json()) as string[];
}

export async function loadWatchlist() {
  return (await Bun.file(WATCHLIST_PATH).json()) as WatchedStockRecord[];
}

export async function loadStockRecords(ticker: string) {
  return (await Bun.file(getStockRecordsPath(ticker)).text())
    .trimEnd()
    .split("\n")
    .slice(1)
    .map((line) => {
      const tokens = line.split(",");

      return {
        date: tokens[2],
        open: parseFloat(tokens[4]),
        high: parseFloat(tokens[5]),
        low: parseFloat(tokens[6]),
        close: parseFloat(tokens[7]),
        volume: parseFloat(tokens[8]),
      } satisfies StockRecord;
    });
}
