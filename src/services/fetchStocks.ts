//const yahooFinance = require("yahoo-finance2");
import yahooFinance from "yahoo-finance2";

const symbols = [
  "AAPL", "TSLA", "NVDA", "AMZN", "META",
  "NFLX", "MSFT", "AMD", "GOOG", "INTC"
];

export async function fetchStockData() {
  const results = [];
  for (const symbol of symbols) {
    try {
      const quote = await yahooFinance.quote(symbol);
      results.push({
        symbol,
        price: quote.regularMarketPrice,
        change_pct: `${quote.regularMarketChangePercent?.toFixed(2)}%`,
        volume: quote.regularMarketVolume?.toLocaleString(),
        marketState: quote.marketState,
      });
    } catch (err) {
      console.error("Error fetching", symbol, err);
    }
  }
  return results;
}

