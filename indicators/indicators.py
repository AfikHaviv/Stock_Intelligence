import pandas as pd
import pandas_ta as ta


def compute_indicators(dates: list[str], closes: list[float]) -> dict:
    df = pd.DataFrame({"date": dates, "close": closes})
    close = df["close"].astype(float)

    df["sma20"]  = ta.sma(close, length=20)
    df["sma50"]  = ta.sma(close, length=50)
    df["sma200"] = ta.sma(close, length=200)
    df["ema12"]  = ta.ema(close, length=12)
    df["ema26"]  = ta.ema(close, length=26)
    df["rsi"]    = ta.rsi(close, length=14)

    macd_df = ta.macd(close, fast=12, slow=26, signal=9)
    if macd_df is not None and not macd_df.empty:
        df["macd_line"]   = macd_df.iloc[:, 0]
        df["macd_signal"] = macd_df.iloc[:, 2]
        df["macd_hist"]   = macd_df.iloc[:, 1]

    def series(col: str) -> list[dict]:
        if col not in df.columns:
            return []
        sub = df[["date", col]].dropna()
        return [
            {"time": str(d), "value": round(float(v), 4)}
            for d, v in zip(sub["date"], sub[col])
        ]

    def macd_series() -> list[dict]:
        cols = ["macd_line", "macd_signal", "macd_hist"]
        if not all(c in df.columns for c in cols):
            return []
        sub = df[["date"] + cols].dropna()
        return [
            {
                "time":      str(d),
                "macd":      round(float(ml), 4),
                "signal":    round(float(ms), 4),
                "histogram": round(float(mh), 4),
            }
            for d, ml, ms, mh in zip(
                sub["date"], sub["macd_line"], sub["macd_signal"], sub["macd_hist"]
            )
        ]

    return {
        "sma20":  series("sma20"),
        "sma50":  series("sma50"),
        "sma200": series("sma200"),
        "ema12":  series("ema12"),
        "ema26":  series("ema26"),
        "rsi":    series("rsi"),
        "macd":   macd_series(),
    }
