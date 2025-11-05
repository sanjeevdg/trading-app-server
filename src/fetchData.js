const YahooFinance = require("yahoo-finance2").default;


//: string
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey','ripHistorical'] });

async function fetchCandles(symbol) {
  const period1 = new Date();
  period1.setMonth(period1.getMonth() - 3);
  const period2 = new Date();

  const result = await yahooFinance.chart(symbol, {
    period1,
    period2,
    interval: "1d",
  });

  const quotes = result.quotes || [];
  return quotes.map((q) => ({
    date: q.date,
    open: q.open,
    high: q.high,
    low: q.low,
    close: q.close,
  }));
}

module.exports = { fetchCandles };