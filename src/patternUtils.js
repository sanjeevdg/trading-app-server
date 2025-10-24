//const { Candle } = require("./types");

function detectPatterns(candles) {
  const results = [];


//candles: Candle[]
//: string[]


  for (let i = 2; i < candles.length; i++) {
    const c0 = candles[i];
    const c1 = candles[i - 1];
    const c2 = candles[i - 2];

    const body = Math.abs(c0.close - c0.open);
    const range = c0.high - c0.low;
    const upperShadow = c0.high - Math.max(c0.open, c0.close);
    const lowerShadow = Math.min(c0.open, c0.close) - c0.low;

    // Doji
    if (body / range < 0.1) results.push(`Doji on ${c0.date.toISOString().split("T")[0]}`);

    // Hammer
    if (lowerShadow > 2 * body && c0.close > c0.open) results.push(`Hammer on ${c0.date.toISOString().split("T")[0]}`);

    // Shooting Star
    if (upperShadow > 2 * body && c0.open > c0.close) results.push(`Shooting Star on ${c0.date.toISOString().split("T")[0]}`);

    // Morning Star
    if (
      c2.close < c2.open &&
      Math.abs(c1.close - c1.open) < (c2.open - c2.close) * 0.5 &&
      c0.close > (c2.open + c2.close) / 2
    ) {
      results.push(`Morning Star on ${c0.date.toISOString().split("T")[0]}`);
    }
  }

  return results;
}

module.exports = { detectPatterns };