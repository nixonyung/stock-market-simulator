import json
import math
from datetime import datetime
from pathlib import Path
from typing import Any, TypedDict

import lightgbm as lgb
import polars as pl
import polars_talib as ta
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    STOCK_DATA_DIR: Path


ENV = Environment()  # type:ignore
OUTPUT_DIR = Path("outputs")

TICKERS = ["AAPL", "MSFT", "RIG"]
START_DATE = datetime(2010, 9, 15)

BETA_TIMEPERIODS = [21, 60, 125, 250, 750]
ATR_TIMEPERIODS = [5, 14, 21, 30, 50]
ROC_TIMEPERIODS = [1, 2, 3, 4, 5]
MA_TIMEPERIODS = [5, 10, 20, 50, 100, 200]
MACD_SETTINGS = [
    (12, 26, 9),
    (19, 39, 9),
    (34, 144, 9),
    (100, 200, 50),
]
STOCH_SETTINGS = [
    (14, 3, 3),
    (21, 5, 5),
    (21, 7, 7),
    (28, 5, 5),
    (28, 12, 12),
]
PVO_SETTINGS = [
    (5, 10),
    (5, 14),
    (12, 26),
    (5, 100),
    (10, 250),
]
ADOSC_SETTINGS = [
    (3, 10),
    (10, 50),
]
TARGET_LOOKAHEAD_TIMEPERIOD = 5

PRICE_EPS = 1e-4


def get_records_df(ticker: str):
    return pl.read_csv(ENV.STOCK_DATA_DIR / f"{ticker[0]}/{ticker}.txt").select(
        symbol="<TICKER>",
        date=pl.col("<DATE>").cast(pl.String).str.to_date("%Y%m%d"),
        open="<OPEN>",
        high="<HIGH>",
        low="<LOW>",
        close="<CLOSE>",
        volume="<VOL>",
    )


SPY_DF = get_records_df("SPY")


def log_rise_vs_drop(timeperiod: int):
    prev_close = pl.col("close").shift(timeperiod - 1)

    return (
        (ta.max(timeperiod=timeperiod) - prev_close + PRICE_EPS)
        / ((prev_close - ta.min(timeperiod=timeperiod)).sqrt() + PRICE_EPS)
    ).log()


def stoch_diff(fastk: int, slowk: int, slowd: int):
    stoch = pl.col(f"stoch_struct({fastk}_{slowk}_{slowd})")
    slowk_line = stoch.struct[0]
    slowd_line = stoch.struct[1]

    return slowk_line > slowd_line


def macd_diff(fast: int, slow: int, signal: int):
    macd = pl.col(f"macd_struct({fast}_{slow}_{signal})")
    macd_line = macd.struct[0]
    signal_line = macd.struct[1]

    return macd_line > signal_line


def pvo_diff(fast: int, slow: int) -> pl.Expr:
    pvo = pl.col(f"pvo_struct({fast}_{slow})")
    pvo_line = pvo.struct[0]
    signal_line = pvo.struct[1]

    return pvo_line > signal_line


def append_features(df: pl.DataFrame):
    df = (
        df.join(SPY_DF, "date", maintain_order="left", suffix="_spy")
        .with_columns(
            **{f"log_rise_vs_drop({t})": log_rise_vs_drop(timeperiod=t) for t in MA_TIMEPERIODS},
            target=log_rise_vs_drop(TARGET_LOOKAHEAD_TIMEPERIOD).shift(
                -TARGET_LOOKAHEAD_TIMEPERIOD
            ),
            beta=ta.beta(pl.col("close_spy"), pl.col("close")),
            **{
                f"beta({t})": ta.beta(pl.col("close_spy"), pl.col("close"), timeperiod=t)
                for t in BETA_TIMEPERIODS
            },
            **{f"atr({t})": ta.atr(timeperiod=t) for t in ATR_TIMEPERIODS},
            **{f"rsi({t})": ta.rsi(timeperiod=t) for t in ATR_TIMEPERIODS},
            **{f"sma({t})": ta.sma(timeperiod=t) for t in MA_TIMEPERIODS},
            **{f"ema({t})": ta.ema(timeperiod=t) for t in MA_TIMEPERIODS},
            vwap=ta.vwap(),
            **{f"vwma({t})": ta.vwma(timeperiod=t) for t in MA_TIMEPERIODS},
            **{
                f"stoch_struct({fastk}_{slowk}_{slowd})": ta.stoch(
                    fastk_period=fastk, slowk_period=slowk, slowd_period=slowd
                )
                for (fastk, slowk, slowd) in STOCH_SETTINGS
            },
            **{
                f"macd_struct({fast}_{slow}_{signal})": ta.macd(
                    fastperiod=fast, slowperiod=slow, signalperiod=signal
                )
                for (fast, slow, signal) in MACD_SETTINGS
            },
            **{
                f"pvo({fast}_{slow})": ta.pvo(fastperiod=fast, slowperiod=slow)
                for (fast, slow) in PVO_SETTINGS
            },
            **{f"cmf({t})": ta.cmf(timeperiod=t) for t in ATR_TIMEPERIODS},
        )
        .with_columns(
            **{
                f"roc({t})_vs_beta({beta_t})": ta.roc(timeperiod=t)
                - pl.col(f"beta({beta_t})") * ta.roc(pl.col("close_spy"), timeperiod=t)
                for beta_t in BETA_TIMEPERIODS
                for t in ROC_TIMEPERIODS
            },
            **{
                f"close_vs_sma({t})/atr({atr_t})": (pl.col("close") - pl.col(f"sma({t})"))
                / pl.col(f"atr({atr_t})")
                for atr_t in ATR_TIMEPERIODS
                for t in MA_TIMEPERIODS
            },
            **{
                f"close_vs_ema({t})/atr({atr_t})": (pl.col("close") - pl.col(f"ema({t})"))
                / pl.col(f"atr({atr_t})")
                for atr_t in ATR_TIMEPERIODS
                for t in MA_TIMEPERIODS
            },
            **{
                f"close_vs_vwap/atr({atr_t})": (pl.col("close") - pl.col("vwap"))
                / pl.col(f"atr({atr_t})")
                for atr_t in ATR_TIMEPERIODS
            },
            **{
                f"close_vs_vwma({t})/atr({atr_t})": (pl.col("close") - pl.col(f"vwma({t})"))
                / pl.col(f"atr({atr_t})")
                for atr_t in ATR_TIMEPERIODS
                for t in MA_TIMEPERIODS
            },
            **{
                f"stoch({fastk}_{slowk}_{slowd})": stoch_diff(fastk, slowk, slowd)
                for (fastk, slowk, slowd) in STOCH_SETTINGS
            },
            **{
                f"macd({fast}_{slow}_{signal})": macd_diff(fast, slow, signal)
                for (fast, slow, signal) in MACD_SETTINGS
            },
        )
    )

    if START_DATE is not None:
        df = df.filter(pl.col("date") >= START_DATE)
    df = df.drop_nulls().drop_nans()

    return df


FEATURES = (
    [
        "beta",
    ]
    + [f"rsi({t})" for t in ATR_TIMEPERIODS]
    + [f"roc({t})_vs_beta({beta_t})" for beta_t in BETA_TIMEPERIODS for t in ROC_TIMEPERIODS]
    + [f"close_vs_sma({t})/atr({atr_t})" for atr_t in ATR_TIMEPERIODS for t in MA_TIMEPERIODS]
    + [f"close_vs_ema({t})/atr({atr_t})" for atr_t in ATR_TIMEPERIODS for t in MA_TIMEPERIODS]
    + [f"close_vs_vwap/atr({atr_t})" for atr_t in ATR_TIMEPERIODS]
    + [f"close_vs_vwma({t})/atr({atr_t})" for atr_t in ATR_TIMEPERIODS for t in MA_TIMEPERIODS]
    + [f"stoch({fastk}_{slowk}_{slowd})" for (fastk, slowk, slowd) in STOCH_SETTINGS]
    + [f"macd({fast}_{slow}_{signal})" for (fast, slow, signal) in MACD_SETTINGS]
    + [f"cmf({t})" for t in ATR_TIMEPERIODS]
)


class TreeResult(TypedDict):
    value: float
    count: int
    path: list[str]


def output_tree(ticker: str, df: pl.DataFrame):
    dataset = lgb.Dataset(df.select(FEATURES), df["target"])
    model = lgb.train(train_set=dataset, num_boost_round=1, params={"random_state": 0})
    model_dump = model.dump_model()

    results: list[TreeResult] = []
    q: list[tuple[dict[str, Any], int, str]] = [
        (model_dump["tree_info"][0]["tree_structure"], -1, "")
    ]
    path: list[str] = []
    while q:
        (node, level, prev) = q.pop()

        if prev:
            path = path[:level] + [prev]

        if "split_feature" in node:
            if child := node.get("right_child"):
                q.append(
                    (
                        child,
                        level + 1,
                        f"{FEATURES[node['split_feature']]} > {node['threshold']:.5g}",
                    )
                )
            if child := node.get("left_child"):
                q.append(
                    (
                        child,
                        level + 1,
                        f"{FEATURES[node['split_feature']]} <= {node['threshold']:.5g}",
                    )
                )
        else:
            results.append(
                TreeResult(
                    value=node["leaf_value"],
                    count=node["leaf_count"],
                    path=sorted(path),
                )
            )

    json.dump(
        sorted(
            results,
            key=lambda result: result["value"] * math.sqrt(result["count"]),
            reverse=True,
        ),
        (OUTPUT_DIR / f"{ticker}_{START_DATE.strftime('%Y-%m-%d')}.json").open("w"),
        indent=2,
        ensure_ascii=False,
    )


if __name__ == "__main__":
    print(FEATURES)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for ticker in TICKERS:
        df = append_features(get_records_df(ticker))

        output_tree(ticker, df)


# df["close"].hist([-np.inf] + np.arange(-3.0, 3.0, 0.5).tolist() + [np.inf]).show(limit=None)
# df["simple return"].hist(bin_count=10).show(limit=None)

# INTERVALS = [
#     -0.5,
#     -0.2,
#     -0.1,
#     -0.05,
#     -0.03,
#     -0.02,
#     -0.01,
#     0.0,
#     0.01,
#     0.02,
#     0.03,
#     0.05,
#     0.1,
#     0.2,
#     0.5,
# ]
# df.select(
#     bin=pl.col("simple return").bin_intervals(
#         INTERVALS,
#         labels=[
#             f"(-inf, {INTERVALS[i]})"
#             if i == 0
#             else f"[{INTERVALS[i - 1]}, {INTERVALS[i]})"
#             if i != len(INTERVALS)
#             else f"[{INTERVALS[i - 1]}, inf)"
#             for i in range(len(INTERVALS) + 1)
#         ],
#     ),
# ).group_by("bin").len().sort("bin").show(limit=None)
