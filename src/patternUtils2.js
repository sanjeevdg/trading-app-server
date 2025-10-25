


 function detectPatterns(candles) {
  if (!candles || candles.length < 3) return [];

  const results = [];

  for (let i = 2; i < candles.length; i++) {
    const prev2 = candles[i - 2];
    const prev = candles[i - 1];
    const curr = candles[i];

    const date = curr.date || curr.timestamp || `#${i}`;
    const body = Math.abs(curr.close - curr.open);
    const range = curr.high - curr.low;
    const upperShadow = curr.high - Math.max(curr.close, curr.open);
    const lowerShadow = Math.min(curr.close, curr.open) - curr.low;

    // Normalize for safety
    const avgBody =
      (Math.abs(prev.close - prev.open) + Math.abs(prev2.close - prev2.open)) / 2;

    // Hammer pattern (small body, long lower shadow)
    if (
      lowerShadow > 2 * body &&
      upperShadow < body &&
      curr.close > curr.open // bullish
    ) {
      results.push({ name: "Hammer", type: "bullish", date });
    }

    // Shooting Star (small body, long upper shadow)
    if (
      upperShadow > 2 * body &&
      lowerShadow < body &&
      curr.close < curr.open // bearish
    ) {
      results.push({ name: "Shooting Star", type: "bearish", date });
    }

    // Doji (open ≈ close)
    if (body / range < 0.1) {
      results.push({ name: "Doji", type: "neutral", date });
    }

    // Morning Star (bullish reversal)
    if (
      prev2.close > prev2.open && // bearish candle
      prev.close < prev.open && // indecision or small
      curr.close > prev.close && // bullish confirmation
      curr.close > prev2.open
    ) {
      results.push({ name: "Morning Star", type: "bullish", date });
    }

    // Evening Star (bearish reversal)
    if (
      prev2.close < prev2.open && // bullish candle
      prev.close > prev.open && // indecision or small
      curr.close < prev2.close && // bearish confirmation
      curr.close < prev.open
    ) {
      results.push({ name: "Evening Star", type: "bearish", date });
    }

    // Engulfing patterns
    const prevBody = prev.close - prev.open;
    const currBody = curr.close - curr.open;

    // Bullish Engulfing
    if (prevBody < 0 && currBody > 0 && curr.open < prev.close && curr.close > prev.open) {
      results.push({ name: "Bullish Engulfing", type: "bullish", date });
    }

    // Bearish Engulfing
    if (prevBody > 0 && currBody < 0 && curr.open > prev.close && curr.close < prev.open) {
      results.push({ name: "Bearish Engulfing", type: "bearish", date });
    }
  }

  return results;
}
module.exports = { detectPatterns };