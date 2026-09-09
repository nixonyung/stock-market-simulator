import {
  loadDates,
  loadIndex,
  loadStockRecords,
  loadWatchlist,
  WATCHLIST_PATH,
} from "#lib/utils.server.js";
import { Elysia, t } from "elysia";
import pLimit from "p-limit";

const MAX_NUM_CONCURRENT_TASKS = 500;

const app = new Elysia()
  // .onBeforeHandle(({ request: { method, url }, body }) => {
  //   console.log(`[${Temporal.Now.plainDateTimeISO().toLocaleString()}] ${method} ${url}`);
  //   if (body) console.log(body);
  // })

  .get("/api/metadata", async () => {
    const index = await loadIndex();
    const dates = await loadDates();

    return {
      tickers: Object.keys(index),
      dates,
    };
  })

  .get("/api/watchlist", async () => {
    const file = Bun.file(WATCHLIST_PATH);
    if (!(await file.exists())) {
      await Bun.write(file, JSON.stringify([], null, 2));
    }

    const watchlistRecords = await loadWatchlist();
    const limit = pLimit(MAX_NUM_CONCURRENT_TASKS);
    return await Promise.all(
      watchlistRecords.map((r) =>
        limit(async () => {
          const records = await loadStockRecords(r.ticker);

          return {
            ...r,
            records,
          };
        }),
      ),
    );
  })

  .post(
    "/api/watchlist/add",
    async ({ body, status }) => {
      const ticker = `${body.ticker.toUpperCase()}`;

      const index = await loadIndex();
      if (!Object.hasOwn(index, ticker)) return status(400, `${ticker} does not exist`);

      const watchlistRecords = await loadWatchlist();
      if (watchlistRecords.some((r) => ticker === r.ticker))
        return status(400, `${ticker} already in watchlist`);

      watchlistRecords.push({
        ticker,
        buyDate: body.buyDate,
      });
      await Bun.write(WATCHLIST_PATH, JSON.stringify(watchlistRecords, null, 2));

      return await loadStockRecords(ticker);
    },
    {
      body: t.Object({
        ticker: t.String(),
        buyDate: t.String(),
      }),
    },
  )

  .patch(
    "/api/watchlist/:index",
    async ({ params, body, status }) => {
      const watchlistRecords = await loadWatchlist();
      const index = parseInt(params.index);
      if (index < 0 || index >= watchlistRecords.length)
        return status(
          400,
          `Invalid index ${index} for watchlist with ${watchlistRecords.length} items`,
        );

      watchlistRecords[index] = {
        ...watchlistRecords[index],
        ...body,
      };
      if (!watchlistRecords[index].comment) delete watchlistRecords[index].comment;
      if (watchlistRecords[index].rating === 0) delete watchlistRecords[index].rating;

      await Bun.write(WATCHLIST_PATH, JSON.stringify(watchlistRecords, null, 2));
    },
    {
      body: t.Partial(
        t.Object({
          buyDate: t.String(),
          comment: t.String(),
          rating: t.Number(),
        }),
      ),
    },
  )

  .post(
    "/api/watchlist/swap",
    async ({ body: { idx1, idx2 } }) => {
      console.log(idx1, idx2);
      const watchlistRecords = await loadWatchlist();

      const item = watchlistRecords[idx1];
      watchlistRecords.splice(idx1, 1);
      watchlistRecords.splice(idx2, 0, item);
      await Bun.write(WATCHLIST_PATH, JSON.stringify(watchlistRecords, null, 2));
    },
    {
      body: t.Object({
        idx1: t.Integer(),
        idx2: t.Integer(),
      }),
    },
  )

  .delete("/api/watchlist/:index", async ({ params, status }) => {
    const watchlistRecords = await loadWatchlist();
    const index = parseInt(params.index);
    if (index < 0 || index >= watchlistRecords.length)
      return status(
        400,
        `Invalid index ${index} for watchlist with ${watchlistRecords.length} items`,
      );

    watchlistRecords.splice(index, 1);
    await Bun.write(WATCHLIST_PATH, JSON.stringify(watchlistRecords, null, 2));
  });

export const GET = ({ request }) => app.handle(request);
export const POST = ({ request }) => app.handle(request);
export const PUT = ({ request }) => app.handle(request);
export const PATCH = ({ request }) => app.handle(request);
export const DELETE = ({ request }) => app.handle(request);

export type App = typeof app;
