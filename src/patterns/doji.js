
const doji = {
  key: "doji",
  name: "Doji",

//: Array<{ date: string }>
// : any[]

  detect(data) {
    const hits = [];
    for (const d of data) {
      const body = Math.abs(d.close - d.open);
      const range = d.high - d.low;
      if (body / range < 0.05) hits.push({ date: d.date });
    }
    return hits;
  },
};

module.exports = { doji };