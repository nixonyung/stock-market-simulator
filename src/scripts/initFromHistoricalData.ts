import type { Index } from "#lib/types.js";
import { writeFile } from "node:fs/promises";
import { basename } from "node:path";
import pLimit from "p-limit";

//#region env
const STOOQ_DIR = Bun.env.STOOQ_HISTORICAL_DATA_DIR;
if (!STOOQ_DIR) throw "missing STOOQ_HISTORICAL_DATA_DIR in .env file";
const STOCK_DATA_DIR = Bun.env.STOCK_DATA_DIR;
if (!STOCK_DATA_DIR) throw "missing STOCK_DATA_DIR in .env file";
//#endregion

//#region paths
const INDEX_PATH = `${STOCK_DATA_DIR}/index.json`;
const DATES_PATH = `${STOCK_DATA_DIR}/dates.json`;
const TICKERS_MUST_IN_TIMERANGE = ["SPY", "VOO"];
const TICKERS_WITH_RECORDS_EVERYDAY = ["AAPL", "AMD", "INTC", "MSFT"];
function getDest(ticker: string) {
  return `${STOCK_DATA_DIR}/${ticker[0]}/${ticker}.txt`;
}
//#endregion

//#region helpers
const LIMIT = pLimit(500);

async function loadContent(src: string) {
  return await Bun.file(src).text();
}

function getLines(content: string) {
  return content.trimEnd().split("\n").slice(1);
}

function parseDate(line: string) {
  return line.split(",", 4)[2];
}
//#endregion

//#region main
let startDate: Temporal.PlainDate;
let endDate: Temporal.PlainDate;
await (async function () {
  const srcs = await Array.fromAsync(
    new Bun.Glob(
      `${STOOQ_DIR}/data/daily/us/**/{${TICKERS_MUST_IN_TIMERANGE.map((ticker) => ticker.toLowerCase()).join(",")}}.us.txt`,
    ).scan(),
  );
  const dates = await Promise.all(
    srcs.map(async (src) => {
      const content = await loadContent(src);
      const lines = getLines(content);

      return {
        startDate: parseDate(lines[0]),
        endDate: parseDate(lines.at(-1)!),
      };
    }),
  );

  startDate = dates
    .map(({ startDate }) => Temporal.PlainDate.from(startDate))
    .reduce((max, d) => (Temporal.PlainDate.compare(d, max) === 1 ? d : max));
  endDate = dates
    .map(({ endDate }) => Temporal.PlainDate.from(endDate))
    .reduce((max, d) => (Temporal.PlainDate.compare(d, max) === 1 ? d : max));

  console.log(`timeRange: ${startDate} to ${endDate}`);
})();

const index: Index = {};
const dates = new Set<string>();
console.log("processing files...");
await (async function () {
  const srcs = Array.from(new Bun.Glob(`${STOOQ_DIR}/data/daily/us/**/*.us.txt`).scanSync());

  await Promise.allSettled(
    srcs.map((src) =>
      LIMIT(async () => {
        const content = await loadContent(src);
        const lines = getLines(content);
        if (
          Temporal.PlainDate.compare(parseDate(lines[0]), startDate) === 1 ||
          Temporal.PlainDate.compare(parseDate(lines.at(-1)!), endDate) === -1
        )
          return;

        const ticker = basename(src, ".us.txt").toUpperCase();
        const typeMatch = src.match(/.+\/data\/daily\/us\/([ a-z]+)(\/\d+)?\/[a-z]+\.us\.txt/);
        index[ticker] = {
          type: typeMatch![1],
          lastDate: parseDate(lines.at(-1)!),
        };

        if (TICKERS_WITH_RECORDS_EVERYDAY.includes(ticker)) {
          for (const line of lines) {
            const date = parseDate(line);
            if (Temporal.PlainDate.compare(date, startDate) === -1) continue;
            dates.add(date);
          }
        }

        const dest = getDest(ticker);
        await Bun.write(dest, content);
      }),
    ),
  );
})();
console.log(`copied ${Object.keys(index).length} files`);

await writeFile(
  INDEX_PATH,
  JSON.stringify(
    Object.fromEntries(
      Object.keys(index)
        .toSorted()
        .map((key) => [key, index[key]]),
    ),
    null,
    2,
  ),
);
console.log(`wrote index to ${INDEX_PATH}`);

await writeFile(DATES_PATH, JSON.stringify(Array.from(dates).sort(), null, 2));
console.log(`wrote dates to ${DATES_PATH}`);
//#endregion
