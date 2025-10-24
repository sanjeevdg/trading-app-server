const shootingStar = {
  key: "shootingStar",
  name: "Shooting Star",


// : any[]
// : Array<{ date: string }>


  detect(data) {
    const hits = [];
    for (const d of data) {
      const body = Math.abs(d.close - d.open);
      const range = d.high - d.low;
      const upperShadow = d.high - Math.max(d.open, d.close);
      if (upperShadow > 2 * body && body < range * 0.3) hits.push({ date: d.date });
    }
    return hits;
  },
};

module.exports = { shootingStar };