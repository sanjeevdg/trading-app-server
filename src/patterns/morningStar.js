const morningStar = {
  key: "morningStar",
  name: "Morning Star",


//: any[]
  // : Array<{ date: string }>



  detect(data) {
    const hits = [];
    for (let i = 2; i < data.length; i++) {
      const a = data[i - 2];
      const b = data[i - 1];
      const c = data[i];
      const isBearish1 = a.close < a.open;
      const smallBody2 = Math.abs(b.close - b.open) < (a.open - a.close) * 0.5;
      const isBullish3 = c.close > c.open;
      const closesAboveMid = c.close > (a.open + a.close) / 2;
      if (isBearish1 && smallBody2 && isBullish3 && closesAboveMid) {
        hits.push({ date: c.date });
      }
    }
    return hits;
  },
};

module.exports = { morningStar };