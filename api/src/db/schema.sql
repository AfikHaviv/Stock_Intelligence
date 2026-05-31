-- One row per ticker we have data for
CREATE TABLE stocks (
    id         SERIAL PRIMARY KEY,
    ticker     VARCHAR(10)  NOT NULL UNIQUE,
    name       VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Daily OHLCV bars
CREATE TABLE price_history (
    id       SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
    date     DATE NOT NULL,
    open     DECIMAL(12, 4),
    high     DECIMAL(12, 4),
    low      DECIMAL(12, 4),
    close    DECIMAL(12, 4),
    volume   BIGINT,
    UNIQUE(stock_id, date)
);

CREATE INDEX idx_price_history_stock_date
    ON price_history(stock_id, date DESC);
