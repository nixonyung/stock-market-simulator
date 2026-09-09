# Stock Market Simulator

## Getting Started

- run `bun install` (or `bun i`)
- download historical daily U.S. data from [Stooq](https://stooq.com/db/h/), create `.env` (refer to `.env.example`)
- run `bun run src/scripts/initFromHistoricalData.ts`
- run `bun dev`
  - start by adding a ticker to watchlist

---

- run `uv sync` and `uv run src/scripts/analyzeIndicators.py` to analyze the most relevant indicators combo from the historical data, output at the `outputs` folder
