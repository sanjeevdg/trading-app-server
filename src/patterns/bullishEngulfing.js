
 const bullishEngulfing = {
  key: "bullishEngulfing",
  name: "Bullish Engulfing",
  //: any[]
  detect(data) {
  //: Array<{ date: string }>
    const hits = [];
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      const prevBear = prev.close < prev.open;
      const currBull = curr.close > curr.open;
      const engulf = curr.open < prev.close && curr.close > prev.open;
      if (prevBear && currBull && engulf) hits.push({ date: curr.date });
    }
    return hits;
  },
};

module.exports = { bullishEngulfing };