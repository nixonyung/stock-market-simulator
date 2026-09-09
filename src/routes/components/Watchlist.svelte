<script lang="ts">
  import { dateToIdx, formatDate, getDateIdxToRecord, S } from "#lib/utils.svelte.js";
  import { debounce, sample } from "es-toolkit";
  import { HTTPError } from "ky";
  import {
    apiDeleteWatchlist,
    apiPatchWatchlist,
    apiPostWatchlist,
    apiSwapWatchlist,
  } from "../api/[...slugs]/client";
  import DeleteBtnWithConfirm from "./DeleteBtnWithConfirm.svelte";
  import SlidableDateIdx from "./SlidableDateIdx.svelte";

  const NUM_LEFT_COLS = 5;

  const historyCols = $derived.by(() => {
    return [
      { label: "1D", duration: { days: 1 } },
      { label: "3D", duration: { days: 3 } },
      { label: "1M", duration: { months: 1 } },
      { label: "3M", duration: { months: 3 } },
      { label: "6M", duration: { months: 6 } },
      { label: "1Y", duration: { years: 1 } },
      { label: "2Y", duration: { years: 2 } },
      { label: "5Y", duration: { years: 5 } },
    ].map((x) => {
      const { result, isClamped } = dateToIdx(S.currDate.subtract(x.duration), false);
      return {
        ...x,
        idx: isClamped ? undefined : result,
      };
    });
  });

  let tickerInput = $state("");
  let tickerInputRef = $state<HTMLInputElement>();
  let err = $state("");

  let iDragging = $state(0);

  function getPriceColor(percent: number) {
    const abs = Math.abs(percent);
    return (
      `${percent > 0 ? "text-success" : percent < 0 ? "text-error" : "text-warning"} ` +
      `${abs < 2 ? "opacity-33" : abs < 10 ? "opacity-80 brightness-100 saturate-110" : "opacity-100 saturate-150"}`
    );
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (document.activeElement !== document.body || e.ctrlKey || e.metaKey || !e.key) return;

    if (e.key.match(/^[a-zA-Z]$/) || e.key === "Backspace") {
      tickerInputRef?.focus();
      tickerInputRef?.select();
    }
  }}
/>

<div class="h-60 min-h-1/3 overflow-y-auto border-t border-base-content/10 select-none">
  <div
    class="grid min-h-full grid-cols-[10ch_repeat(var(--num-left-cols),max-content)_repeat(calc(var(--num-history-cols)*2+2),1fr)] grid-rows-[auto_repeat(var(--num-watchlist-item),auto)_1fr]"
    style:--num-left-cols={NUM_LEFT_COLS}
    style:--num-history-cols={historyCols.length}
    style:--num-watchlist-item={S.watchlist.length}
  >
    <div
      class="sticky top-0 z-20 col-span-full grid grid-cols-subgrid gap-2 border-b-3 border-base-content/25 bg-base-100 text-sm text-base-content/50"
    >
      <div
        class="sticky left-0 col-span-(--num-left-cols) grid grid-cols-subgrid place-items-center gap-2 border-r-3 border-base-content/25 bg-base-100"
        style:--num-left-cols={NUM_LEFT_COLS}
      >
        <span class="mx-4">Ticker</span>
        <span class="mx-4">Buy Date</span>
        <span></span>
        <span></span>
        <span class="mx-4">Close</span>
      </div>
      <div
        class="col-start-[calc(var(--num-left-cols)+1)] -col-end-1 grid grid-cols-subgrid place-items-center gap-2"
        style:--num-left-cols={NUM_LEFT_COLS}
      >
        <span class="col-span-2">vs Buy</span>
        {#each historyCols as { label } (label)}
          <span class="col-span-2">vs {label}</span>
        {/each}
      </div>
    </div>

    {#each S.watchlist.entries() as [i, { ticker, buyDateIdx, dateIdxToRecord }] (ticker)}
      {@const currPrice = dateIdxToRecord[S.dateIdx].close}

      <div
        class="col-span-full grid cursor-move grid-cols-subgrid place-items-center gap-2 leading-none {i ===
          S.watchlistActiveIdx && 'bg-base-300'}"
        draggable="true"
        ondragstart={() => (iDragging = i)}
        // required to enable `ondrop`
        ondragover={(e) => e.preventDefault()}
        ondragenter={() => {
          if (i === iDragging) return;

          const item = S.watchlist[iDragging];
          S.watchlist.splice(iDragging, 1);
          S.watchlist.splice(i, 0, item);
          apiSwapWatchlist({ idx1: iDragging, idx2: i }); // don't block UI

          if (S.watchlistActiveIdx === iDragging) S.watchlistActiveIdx = i;
          else if (S.watchlistActiveIdx === i) S.watchlistActiveIdx = iDragging;

          iDragging = i;
        }}
        role="option"
        tabindex="-1"
        aria-selected={i === S.watchlistActiveIdx}
      >
        <div
          class="sticky left-0 z-10 col-span-(--num-left-cols) grid grid-cols-subgrid place-items-center gap-2 border-r-3 border-base-content/25 {i ===
          S.watchlistActiveIdx
            ? 'bg-neutral text-neutral-content'
            : 'bg-base-100'}"
          style:--num-left-cols={NUM_LEFT_COLS}
        >
          <button
            class="cursor-pointer rounded px-3 py-1 list-col-grow hover:bg-primary/50 hover:text-primary-content"
            onclick={() => (S.watchlistActiveIdx = i)}
            tabindex="-1"
          >
            {ticker}
          </button>

          <span class="text-sm">
            <SlidableDateIdx
              bind:idx={S.watchlist[i].buyDateIdx}
              onchange={debounce(() => {
                apiPatchWatchlist(i, { buyDate: dateIdxToRecord[buyDateIdx].date });
              }, 500)}
            />
          </span>

          <DeleteBtnWithConfirm
            title="delete {ticker}"
            class="ml-2"
            onclick={() => {
              S.watchlist.splice(i, 1);
              apiDeleteWatchlist(i);
            }}
          />

          <form
            onchange={(e) => {
              if (!(e.target instanceof HTMLInputElement)) return;

              const rating = parseInt(e.target.value);
              S.watchlist[i].rating = rating;

              apiPatchWatchlist(i, { rating });
            }}
          >
            <div class="rating opacity-75">
              {#each [[0, "rating-hidden"], [1, "bg-red-400"], [2, "bg-orange-400"], [3, "bg-yellow-400"], [4, "bg-lime-400"], [5, "bg-green-400"]] as [score, style] (score)}
                <input
                  type="radio"
                  value={score}
                  bind:group={S.watchlist[i].rating}
                  class="mask mask-heart {style}"
                />
              {/each}
            </div>
          </form>

          <div
            class="ml-6 grid h-full place-items-center justify-self-end border-r-3 border-base-content/10 pr-6 font-mono"
          >
            <span>{currPrice.toFixed(2)}</span>
          </div>
        </div>

        {#snippet priceWithPercentAndColor(price: number | undefined)}
          {#if price !== undefined}
            {@const percent = ((currPrice - price) / price) * 100}

            <span class="ml-4 justify-self-end font-mono tracking-tighter {getPriceColor(percent)}">
              {price.toFixed(2)}
            </span>
            <span
              class="mr-4 justify-self-start font-mono text-sm tracking-tighter {getPriceColor(
                percent,
              )}"
            >
              ({percent > 0 ? "+" : ""}{percent.toFixed(2)}%)
            </span>
          {:else}
            <span class="col-span-2 mx-18 opacity-50">N/A</span>
          {/if}
        {/snippet}

        {@render priceWithPercentAndColor(
          buyDateIdx <= S.dateIdx ? dateIdxToRecord[buyDateIdx].close : undefined,
        )}
        {#each historyCols as { label, idx } (label)}
          {@render priceWithPercentAndColor(
            idx !== undefined ? dateIdxToRecord[idx].close : undefined,
          )}
        {/each}
      </div>
    {/each}

    <div class="col-span-full grid grid-cols-subgrid gap-2">
      <div
        class="sticky left-0 z-10 col-span-(--num-left-cols) border-r-3 border-base-content/25 bg-base-100"
        style:--num-left-cols={NUM_LEFT_COLS}
      >
        <form
          onsubmit={async (e) => {
            e.preventDefault();

            const ticker = tickerInput.trim() ? tickerInput.toUpperCase() : sample(S.allTickers);

            try {
              const records = await apiPostWatchlist({
                ticker,
                buyDate: formatDate(S.currDate),
              });

              S.watchlist.push({
                ticker,
                buyDateIdx: S.dateIdx,
                records,
                dateIdxToRecord: getDateIdxToRecord(records),
              });
              tickerInput = "";
              err = "";
            } catch (e) {
              if (e instanceof HTTPError) err = e.data;
            }

            tickerInputRef?.scrollIntoView();
          }}
        >
          <div class="join mt-4 w-full pr-6 pl-4">
            <input
              bind:this={tickerInputRef}
              bind:value={tickerInput}
              class="input join-item grow input-sm"
              placeholder="Add Ticker"
              onclick={({ currentTarget }) => currentTarget.select()}
            />
            <button
              type="submit"
              class="btn join-item cursor-pointer btn-neutral btn-sm"
              title="Add Ticker"
            >
              <span class="icon-[tabler--plus]"></span>
            </button>
          </div>
          <div class="mr-6 mb-2 ml-4 h-8 text-error">{err}</div>
        </form>
      </div>
    </div>
  </div>
</div>
