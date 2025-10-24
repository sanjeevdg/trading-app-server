const hammer = {
  key: "hammer",
  name: "Hammer",
  detect(data) {


//: Array<{ date: string }>



    const hits = [];
    for (const d of data) {
      const body = Math.abs(d.close - d.open);
      const range = d.high - d.low;
      const lowerShadow = Math.min(d.open, d.close) - d.low;
      if (lowerShadow > body * 2 && body < range * 0.3) hits.push({ date: d.date });
    }
    return hits;
  },
};

module.exports = { hammer };

