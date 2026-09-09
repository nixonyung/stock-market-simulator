<script lang="ts">
  import { S } from "#lib/utils.svelte.js";
  import {
    CandlestickSeries,
    createChart,
    CrosshairMode,
    HistogramSeries,
    LineSeries,
    type IChartApi,
    type ISeriesApi,
    type LineData,
  } from "lightweight-charts";
  import { untrack } from "svelte";
  import { ATR, EMA, RSI, SMA, VWMA } from "trading-signals";

  const records = $derived(
    (S.watchlistActiveItem?.records ?? []).map((r) => ({
      ...r,
      time: Temporal.PlainDate.from(r.date),
    })),
  );

  // const BETA_TIMEPERIODS = [21, 60, 125, 250, 750];
  const ATR_TIMEPERIODS = [5, 14, 21, 30, 50];
  // const ROC_TIMEPERIODS = [1, 2, 3, 4, 5];
  const MA_TIMEPERIODS = [5, 10, 20, 50, 100, 200];
  // const MACD_SETTINGS = [(12, 26, 9), (19, 39, 9), (34, 144, 9), (100, 200, 50)];
  // const STOCH_SETTINGS = [(14, 3, 3), (21, 5, 5), (21, 7, 7), (28, 5, 5), (28, 12, 12)];
  // const PVO_SETTINGS = [(5, 10), (5, 14), (12, 26), (5, 100), (10, 250)];
  // const ADOSC_SETTINGS = [(3, 10), (10, 50)];
  interface IndicatorOutput {
    time: Temporal.PlainDate;
    value: number | null;
  }
  interface Indicator {
    getData: () => IndicatorOutput[];
    color: string;
  }
  const INDICATORS_BY_TAB1: Record<string, Indicator[]> = {
    // const colorPalette = ["#2962FF", "#FF6D00", "#00C853", "#D500F9", "#FFD600"];
    SMA: MA_TIMEPERIODS.map((t, i) => ({
      getData: () => {
        const state = new SMA(t);
        return records.map((r) => ({ time: r.time, value: state.add(r.close) }));
      },
      color: S.NEUTRAL_CHROMA.brighten(4)
        .alpha(0.25 + (0.75 * (i + 1)) / MA_TIMEPERIODS.length)
        .hex(),
    })),
    EMA: MA_TIMEPERIODS.map((t, i) => ({
      getData: () => {
        const state = new EMA(t);
        return records.map((r) => ({ time: r.time, value: state.add(r.close) }));
      },
      color: S.NEUTRAL_CHROMA.brighten(4)
        .alpha(0.25 + (0.75 * (i + 1)) / MA_TIMEPERIODS.length)
        .hex(),
    })),
    VWMA: MA_TIMEPERIODS.map((t, i) => ({
      getData: () => {
        const state = new VWMA(t);
        return records.map((r) => ({ time: r.time, value: state.add(r) }));
      },
      color: S.NEUTRAL_CHROMA.brighten(4)
        .alpha(0.25 + (0.75 * (i + 1)) / MA_TIMEPERIODS.length)
        .hex(),
    })),
  };
  const INDICATORS_BY_TAB2: Record<string, Indicator[]> = {
    ATR: ATR_TIMEPERIODS.map((t, i) => ({
      getData: () => {
        const state = new ATR(t);
        return records.map((r) => ({ time: r.time, value: state.add(r) }));
      },
      color: S.ACCENT_CHROMA.saturate(1)
        .brighten(2)
        .alpha(0.5 + (0.5 * (i + 1)) / ATR_TIMEPERIODS.length)
        .hex(),
    })),
    RSI: ATR_TIMEPERIODS.map((t, i) => ({
      getData: () => {
        const state = new RSI(t);
        return records.map((r) => ({ time: r.time, value: state.add(r.close) }));
      },
      color: S.ACCENT_CHROMA.saturate(1)
        .brighten(2)
        .alpha(0.5 + (0.5 * (i + 1)) / ATR_TIMEPERIODS.length)
        .hex(),
    })),
  };
  function filterData(data: IndicatorOutput[]) {
    return data.filter((r): r is LineData<Temporal.PlainDate> => r.value !== null);
  }

  let chart = $state<IChartApi>();

  let priceSeries = $state<ISeriesApi<"Candlestick">>();
  let volumeSeries = $state<ISeriesApi<"Histogram">>();
  $effect(() => {
    chart;
    records;

    untrack(() => {
      if (!chart) return;

      priceSeries?.setData(records);
      volumeSeries?.setData(records.map(({ time, volume }) => ({ time, value: volume })));
    });
  });

  let tab1 = $state<keyof typeof INDICATORS_BY_TAB1>("SMA");
  let tab1Seriess = $state<ISeriesApi<"Line">[]>([]);
  $effect(() => {
    chart;
    records;
    tab1;

    untrack(() => {
      if (!chart) return;

      for (const series of tab1Seriess) chart.removeSeries(series);

      tab1Seriess = records.length
        ? INDICATORS_BY_TAB1[tab1].map(({ getData, color }) => {
            const series = chart!.addSeries(LineSeries, {
              color,
              lineWidth: 1,
              priceLineVisible: false,
            });
            series.setData(filterData(getData()));

            return series;
          })
        : [];
    });
  });

  let tab2 = $state<keyof typeof INDICATORS_BY_TAB2>("ATR");
  let tab2Seriess = $state<ISeriesApi<"Line">[]>([]);
  $effect(() => {
    chart;
    records;
    tab2;

    untrack(() => {
      if (!chart) return;

      for (const series of tab2Seriess) chart.removeSeries(series);

      tab2Seriess = records.length
        ? INDICATORS_BY_TAB2[tab2].map(({ getData, color }) => {
            const series = chart!.addSeries(
              LineSeries,
              { color, lineWidth: 1, priceLineVisible: false },
              2,
            );
            series.setData(filterData(getData()));

            return series;
          })
        : [];
    });
  });

  $effect(() => {
    S.watchlistActiveIdx;

    chart?.timeScale().setVisibleRange({
      from: S.currDate.subtract({ years: 1 }),
      to: S.currDate,
    });
  });
</script>

<div class="flex size-full flex-col">
  <div class="grow">
    {#if records.length}
      <div
        class="size-full"
        {@attach (div) =>
          untrack(() => {
            chart = createChart(div, {
              autoSize: true,
              layout: {
                background: { color: S.BASE_100_CHROMA.hex() },
                textColor: S.BASE_CONTENT_CHROMA.hex(),
                attributionLogo: false,
                panes: {
                  separatorColor: S.BASE_CONTENT_CHROMA.alpha(0.5).hex(),
                  // separatorHoverColor: "#00ff00",
                  enableResize: false,
                },
              },
              grid: {
                vertLines: { color: S.BASE_CONTENT_CHROMA.alpha(0.2).hex() },
                horzLines: { color: S.BASE_CONTENT_CHROMA.alpha(0.2).hex() },
              },
              rightPriceScale: {
                borderColor: S.BASE_CONTENT_CHROMA.alpha(0.3).hex(),
              },
              timeScale: {
                borderColor: S.BASE_CONTENT_CHROMA.alpha(0.3).hex(),
              },
              crosshair: {
                mode: CrosshairMode.MagnetOHLC,
              },

              // handleScroll: false,
              // handleScale: false,

              // handleScroll: {
              //   pressedMouseMove: false, // Disable panning/dragging the chart horizontally
              //   mouseWheel: false, // Disable scrolling navigation
              //   horzTouchDrag: false, // Disable horizontal touch dragging
              // },
              // handleScale: {
              //   mouseWheel: false,
              //   pinch: false,
              //   axisDoubleClickReset: { time: false },
              //   axisPressedMouseMove: { time: false },
              // },
            });

            priceSeries = chart.addSeries(
              CandlestickSeries,
              {
                upColor: S.SUCCESS_CHROMA.saturate(2).darken(2).hex(),
                downColor: S.ERROR_CHROMA.saturate(2).darken(2).hex(),
                borderVisible: false,
                priceLineVisible: false,
              },
              0,
            );
            volumeSeries = chart.addSeries(
              HistogramSeries,
              {
                priceFormat: { type: "volume" },
                color: S.BASE_CONTENT_CHROMA.alpha(0.5).hex(),
                priceLineVisible: false,
              },
              1,
            );

            chart.addPane(true);
            chart.panes()[0].setStretchFactor(0.7);
            chart.panes()[1].setStretchFactor(0.15);
            chart.panes()[2].setStretchFactor(0.15);
          })}
      ></div>
    {/if}
  </div>

  <div class="tabs tabs-box tabs-lg">
    {#each Object.keys(INDICATORS_BY_TAB1) as tab (tab)}
      <input type="radio" class="tab" value={tab} aria-label={tab} bind:group={tab1} />
    {/each}
  </div>
  <div class="tabs tabs-box tabs-lg">
    {#each Object.keys(INDICATORS_BY_TAB2) as tab (tab)}
      <input type="radio" class="tab" value={tab} aria-label={tab} bind:group={tab2} />
    {/each}
  </div>
</div>
