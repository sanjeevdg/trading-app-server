
const yahooFinance = require("yahoo-finance2").default;


yahooFinance.suppressNotices(["ripHistorical"]);

async function getHistoricalData(symbol) {
  

  try {
const period1 = new Date();
  period1.setMonth(period1.getMonth() - 3); // 3 months ago
  const period2 = new Date();

  const result = await yahooFinance.chart(symbol, {
    period1, // required
    period2, // required
    interval: "1d",
  });




  const quotes = result.quotes || [];
  return quotes.map((q) => ({
    date: q.date.toISOString().split("T")[0],
    open: q.open,
    high: q.high,
    low: q.low,
    close: q.close,
    volume: q.volume,
  }));
}
  catch (err) {
    console.error("Yahoo fetch failed:", err);
    return [];
  }
}
module.exports = { getHistoricalData };