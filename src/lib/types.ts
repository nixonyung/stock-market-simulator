export interface StockRecord {
  date: string;

  open: number;
  high: number;
  low: number;
  close: number;

  volume: number;
}

export type Index = Record<
  string, // ticker
  {
    type: string;
    lastDate: StockRecord["date"];
  }
>;

export interface WatchedStockRecord {
  ticker: string;
  buyDate: string;
  comment?: string;
  rating?: number;
}
