import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import chroma from "chroma-js";
import { debounce } from "es-toolkit";
import { untrack } from "svelte";
import { SvelteURLSearchParams } from "svelte/reactivity";
import type { StockRecord, WatchedStockRecord } from "./types";

//#region searchParams
const searchParams = new SvelteURLSearchParams(window.location.search);

export function getSearchParam(name: string) {
  return untrack(() => searchParams.get(name));
}

const updateURL = debounce(
  () =>
    goto(resolve(searchParams.size ? `?${searchParams.toString()}` : ""), {
      replace: true,
      shallow: true,
    }),
  100,
);
export function setSearchParam(name: string, value: string | undefined) {
  if (value) {
    searchParams.set(name, value);
  } else {
    searchParams.delete(name);
  }
  updateURL();
}
//#endregion

//#region css helpers
function getCSSVarValue(variableName: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  return chroma(value);
}
//#endregion

//#region states
export const S = new (class {
  allTickers = $state<string[]>([]);

  allDates = $state<Temporal.PlainDate[]>([]);
  dateIdx = $state(0);
  get currDate() {
    return S.allDates.at(S.dateIdx) ?? Temporal.Now.plainDateISO();
  }
  get minDate() {
    return S.allDates.at(0);
  }
  get maxDate() {
    return this.allDates.at(-1);
  }

  watchlist = $state<
    (Omit<WatchedStockRecord, "buyDate"> & {
      buyDateIdx: number;
      records: StockRecord[];
      dateIdxToRecord: StockRecord[];
    })[]
  >([]);
  watchlistActiveIdx = $state(0);
  get watchlistActiveItem() {
    return S.watchlist.at(S.watchlistActiveIdx);
  }

  get BASE_100_CHROMA() {
    return getCSSVarValue("--color-base-100");
  }
  get BASE_CONTENT_CHROMA() {
    return getCSSVarValue("--color-base-content");
  }
  get NEUTRAL_CHROMA() {
    return getCSSVarValue("--color-neutral");
  }
  get ACCENT_CHROMA() {
    return getCSSVarValue("--color-accent");
  }
  get SUCCESS_CHROMA() {
    return getCSSVarValue("--color-success");
  }
  get ERROR_CHROMA() {
    return getCSSVarValue("--color-error");
  }
})();
//#endregion

//#region date helpers
export function formatDate(date: Temporal.PlainDate) {
  const year = date.year;
  const month = date.month.toString().padStart(2, "0");
  const day = date.day.toString().padStart(2, "0");

  return `${year}${month}${day}`;
}

const datesInv = $derived(Object.fromEntries(S.allDates.map((date, i) => [formatDate(date), i])));
export function dateToIdx(
  date: Temporal.PlainDate,
  forward = true,
): {
  result: number;
  isClamped: boolean;
} {
  if (forward && S.maxDate && Temporal.PlainDate.compare(date, S.maxDate) === 1)
    return { result: S.allDates.length - 1, isClamped: true };
  if (!forward && S.minDate && Temporal.PlainDate.compare(date, S.minDate) === -1)
    return { result: 0, isClamped: true };

  while (true) {
    const key = formatDate(date);
    if (Object.hasOwn(datesInv, key)) return { result: datesInv[key], isClamped: false };

    date = forward ? date.add({ days: 1 }) : date.subtract({ days: 1 });
  }
}

const DAY_OF_WEEK_STRS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function formatDayOfWeek(dayOfWeek: number) {
  return DAY_OF_WEEK_STRS[dayOfWeek - 1];
}
//#endregion

//#region data helpers
export function getDateIdxToRecord(records: StockRecord[]) {
  const result = [];
  let i = 0;
  for (const date of S.allDates) {
    // forward-fill records,
    // scripts should ensure records at least contains `metadata.dates`
    while (i + 1 < records.length && Temporal.PlainDate.compare(records[i + 1].date, date) <= 0)
      i++;
    result.push(records[i]);
  }

  return result;
}
//#endregion
