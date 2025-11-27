// ------------------------------------------
// IMPORTS
// ------------------------------------------
const YahooFinance = require("yahoo-finance2").default;

// ------------------------------------------
// 1️⃣ Create Single Instance with Rate Limit
// ------------------------------------------
const yahoo = new YahooFinance({
  queue: {
    concurrency: 1,   // Only 1 request at a time
    interval: 1200,   // 1.2s delay to avoid 429
  },
});

// ------------------------------------------
// 2️⃣ SIMPLE IN-MEMORY CACHE (per symbol)
// ------------------------------------------
const cache = {};  // { symbol: { data, expiry } }
const CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

function getFromCache(symbol) {
  const item = cache[symbol];
  if (!item) return null;
  if (Date.now() > item.expiry) {
    delete cache[symbol]; // clean up
    return null;
  }
  return item.data;
}

function setCache(symbol, data) {
  cache[symbol] = {
    data,
    expiry: Date.now() + CACHE_TTL_MS,
  };
}

// ------------------------------------------
// 3️⃣ FETCH FUNCTION (SAFE)
// ------------------------------------------
async function fetchCandles(symbol) {
  // 1. Try cache first
  const cached = getFromCache(symbol);
  if (cached) {
    console.log(`CACHE HIT for ${symbol}`);
    return cached;
  }

  console.log(`CACHE MISS → Fetching ${symbol} from Yahoo...`);

  try {
    const period2 = new Date();
    const period1 = new Date();
    period1.setMonth(period2.getMonth() - 8);

    const result = await yahoo.chart(symbol, {
      interval: "1d",
      period1,
      period2,
    });

    const quotes = result?.quotes || [];
    const formatted = quotes.map((q) => ({
      date: q.date?.toISOString().split("T")[0],
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume ?? 0,
    }));

    setCache(symbol, formatted); // ← save to cache
    return formatted;
  } catch (err) {
    console.error(`ERROR fetching ${symbol}:`, err);
    throw err;
  }
}

module.exports = { fetchCandles };
