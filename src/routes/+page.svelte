<script lang="ts">
  import favicon from "#lib/assets/favicon.svg";
  import {
    dateToIdx,
    formatDate,
    formatDayOfWeek,
    getDateIdxToRecord,
    getSearchParam,
    S,
    setSearchParam,
  } from "#lib/utils.svelte.js";
  import { debounce, randomInt, sortBy } from "es-toolkit";
  import { apiGetMetadata, apiGetWatchlist, apiPatchWatchlist } from "./api/[...slugs]/client";
  import SlidableDateIdx from "./components/SlidableDateIdx.svelte";
  import StockChart from "./components/StockChart.svelte";
  import Watchlist from "./components/Watchlist.svelte";
  import "./layout.css";

  $effect(() => {
    (async () => {
      const currDateParam = getSearchParam("currDate"); // caveat: have to read search param before updating dates
      const metadataRes = await apiGetMetadata();

      S.allTickers = metadataRes.tickers;

      S.allDates = metadataRes.dates.map((d) => Temporal.PlainDate.from(d));
      S.dateIdx = currDateParam
        ? dateToIdx(Temporal.PlainDate.from(currDateParam)).result
        : S.allDates.length - 1;

      S.watchlist = (await apiGetWatchlist()).map((r) => {
        return {
          ...r,
          dateIdxToRecord: getDateIdxToRecord(r.records),
          buyDateIdx: dateToIdx(Temporal.PlainDate.from(r.buyDate)).result,
        };
      });
    })();
  });

  $effect(() => {
    setSearchParam("currDate", formatDate(S.currDate));
  });
</script>

<svelte:head>
  <title>Stock Market Simulator</title>
  <link rel="icon" href={favicon} />
</svelte:head>

<svelte:window
  onkeydown={(e) => {
    if (e.ctrlKey || e.metaKey || !e.key) return;
    if (e.key === "Escape" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
      return;
    }

    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    )
      return;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowRight": {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

        if (e.key === "ArrowLeft")
          S.dateIdx = dateToIdx(
            S.currDate.subtract(e.altKey ? { weeks: 1 } : { days: 1 }),
            false,
          ).result;
        else if (e.key === "ArrowRight")
          S.dateIdx = dateToIdx(S.currDate.add(e.altKey ? { weeks: 1 } : { days: 1 })).result;

        break;
      }

      case "ArrowUp":
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

        S.watchlistActiveIdx = Math.max(S.watchlistActiveIdx - 1, 0);

        break;
      case "ArrowDown":
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

        S.watchlistActiveIdx = Math.min(S.watchlistActiveIdx + 1, S.watchlist.length - 1);

        break;
    }
  }}
/>

<div class="flex h-dvh flex-col bg-base-100">
  <div class="grow">
    <StockChart />
  </div>

  {#if S.watchlistActiveItem}
    <label class="floating-label my-1">
      <span>Comments</span>
      <textarea
        bind:value={S.watchlistActiveItem.comment}
        placeholder="Comments"
        class="textarea h-1/4 w-full textarea-lg"
        onchange={debounce(() => {
          apiPatchWatchlist(S.watchlistActiveIdx, { comment: S.watchlistActiveItem!.comment });
        }, 700)}></textarea>
    </label>
  {:else}
    <div class="divider m-0 h-0"></div>
  {/if}
  {#if S.allDates.length}
    <div class="mx-4 my-2 mb-3 flex items-center text-xl select-none">
      <span>Today:</span>
      <SlidableDateIdx bind:idx={S.dateIdx} class="ml-1" />
      <span class="ml-2">({formatDayOfWeek(S.currDate.dayOfWeek)})</span>
      <button
        class="btn ml-4 btn-neutral btn-sm"
        onclick={() => (S.dateIdx = randomInt(S.allDates.length))}
      >
        Randomize
      </button>
      <button
        class="btn ml-4 btn-neutral btn-sm"
        onclick={() => (S.watchlist = sortBy(S.watchlist, [({ rating }) => rating ?? 0]))}
      >
        Sort
      </button>
    </div>

    <div class="divider m-0 h-0"></div>

    <Watchlist />
  {/if}
</div>
