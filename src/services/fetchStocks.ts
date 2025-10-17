//const yahooFinance = require("yahoo-finance2");
import yahooFinance from "yahoo-finance2";
import type { Quote } from "yahoo-finance2/dist/esm/src/modules/quote";

const symbols2 = [
  "AAPL", "TSLA", "NVDA", "AMZN", "META",
  "NFLX", "MSFT", "AMD", "GOOG", "INTC"
];

type StockData = {
  symbol: string;
  price: number;
  change_pct: string;
  volume: string | undefined;
  marketState: string;
};

export async function fetchStockData(symbols: any[]): Promise<StockData[]> {


console.log('gotsymbols===',symbols);

  const results: StockData[] = [];
  for (const symbol of symbols) {
    try {
   
      const quote = await yahooFinance.quote(symbol) as any;

      //console.log('quote typeof', typeof quote);
    //  console.log('quote', quote.regularMarketPrice);
      

      //results.push(quote);
      
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

