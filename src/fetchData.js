const YahooFinance = require("yahoo-finance2").default;


//: string
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey','ripHistorical'],
 queue: {
    concurrency: 1,   // only 1 outstanding request at a time
    interval: 1100,   // milliseconds between requests (1.1s)
  } });




function formatDate(date) {
  if (!date) return null;
  try {
    return new Date(date).toISOString().split("T")[0];
  } catch {
    return null;
  }
}

async function fetchCandles(symbol) {
  const period1 = new Date();
  period1.setMonth(period1.getMonth() - 8);
  const period2 = new Date();

  const result = await yahooFinance.chart(symbol, {
    period1,
    period2,
    interval: "1d",
  });




  const quotes = result.quotes || [];
  console.log('QUOTE[0]==',quotes[0]);
  return quotes.map((q) => ({
    date: formatDate(q.date),
    open: q.open,
    high: q.high,
    low: q.low,
    close: q.close,
    volume: q.volume ?? 0,
  }));
}

module.exports = { fetchCandles };