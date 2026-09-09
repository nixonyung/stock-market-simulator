import ky from "ky";
import type { App } from "./+server";

export async function apiGetMetadata() {
  return await ky
    .get<App["~Routes"]["api"]["metadata"]["get"]["response"][200]>("/api/metadata")
    .json();
}

export async function apiGetWatchlist() {
  return await ky
    .get<App["~Routes"]["api"]["watchlist"]["get"]["response"][200]>("/api/watchlist")
    .json();
}

export async function apiPostWatchlist(json: { ticker: string; buyDate: string }) {
  return await ky
    .post<App["~Routes"]["api"]["watchlist"]["add"]["post"]["response"][200]>(
      "/api/watchlist/add",
      { json },
    )
    .json();
}

export async function apiPatchWatchlist(
  index: number,
  json: Partial<{
    buyDate: string;
    comment: string;
    rating: number;
  }>,
) {
  await ky.patch(`/api/watchlist/${index}`, { json });
}

export async function apiSwapWatchlist(json: { idx1: number; idx2: number }) {
  await ky.post(`/api/watchlist/swap`, { json });
}

export async function apiDeleteWatchlist(index: number) {
  await ky.delete(`/api/watchlist/${index}`);
}
