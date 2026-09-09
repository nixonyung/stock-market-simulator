// import type { StockDataIndex } from "#lib/types.js";
// import { appendFile, open, readFile, writeFile } from "node:fs/promises";

// const SRC_PATH = Bun.env.STOOQ_DAILY_DATA_PATH;
// if (!SRC_PATH) throw "missing STOOQ_DAILY_DATA_PATH in .env file";
// const STOCKS_DATA_DIR = Bun.env.STOCKS_DATA_DIR;
// if (!STOCKS_DATA_DIR) throw "missing STOCKS_DATA_DIR in .env file";

// const indexPath = `${STOCKS_DATA_DIR}/index.json`;
// const index: StockDataIndex = JSON.parse(await readFile(indexPath, "utf-8"));

// function getTickerDataPath(ticker: string) {
//   return `${STOCKS_DATA_DIR}/${ticker[0]}/${ticker}.txt`;
// }

// const srcFile = await open(SRC_PATH);
// const tickerToNewData: Record<
//   string,
//   {
//     lastDate: Temporal.PlainDate;
//     newLines: string[];
//   }
// > = {};
// let prevTicker = ""; // for logging
// for await (const line of srcFile.readLines()) {
//   if (line.startsWith("<TICKER>")) continue;

//   const tokens = line.split(",");
//   const ticker = tokens[0].toLowerCase();
//   const date = Temporal.PlainDate.from(tokens[2]);
//   if (ticker !== prevTicker) console.log(`processing ${date} ${ticker}`);
//   prevTicker = ticker;

//   if (!Object.hasOwn(index, ticker)) continue;

//   const lastDate = index[ticker].lastDate;
//   if (Temporal.PlainDate.compare(date, lastDate) !== 1) continue;

//   if (!Object.hasOwn(tickerToNewData, ticker)) tickerToNewData[ticker] = { lastDate, newLines: [] };
//   tickerToNewData[ticker].lastDate = date;
//   tickerToNewData[ticker].newLines.push(line);
// }
// for (const [ticker, { lastDate, newLines }] of Object.entries(tickerToNewData)) {
//   index[ticker].lastDate = lastDate;
//   appendFile(getTickerDataPath(ticker), newLines.join("\n") + "\n");
// }
// await writeFile(
//   indexPath,
//   JSON.stringify(
//     Object.fromEntries(
//       Object.keys(index)
//         .toSorted()
//         .map((key) => [key, index[key]]),
//     ),
//     null,
//     2,
//   ),
// );
