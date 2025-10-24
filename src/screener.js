const { getHistoricalData } = require("./utils/yahoo");
const { patternsMap } = require("./patterns");


//: string[]
//: string[]

async function screenSymbols(symbols, patternKeys) {
  const results = [];

//: any[]

  for (const symbol of symbols) {
    const data = await getHistoricalData(symbol);
    for (const pkey of patternKeys) {
      const pattern = patternsMap[pkey];
      if (!pattern) continue;


//: any    : any


      const hits = pattern.detect(data);
      hits.forEach((hit) => {
        results.push({
          symbol,
          pattern: pattern.name,
          date: hit.date,
        });
      });
    }
  }

  return results;
}

module.exports = { screenSymbols };