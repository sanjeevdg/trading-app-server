
import { CohereClient } from "cohere-ai";

export async function analyzeDeals(stocks: any[]) {
  /* const prompt = `
You are a financial market analyst. From the following stock data, identify the best 5 day trading opportunities:

${JSON.stringify(stocks, null, 2)}

Criteria:
- High intraday volatility or strong trend
- Large trading volume
- Momentum signals (breakout, RSI, MACD)
- Exclude low liquidity or low price stocks

Return a JSON array:
[
  { "symbol": "TSLA", "price": 259.4, "change_pct": "+3.5%", "volume": "54M", "pattern": "Bullish breakout", "reason": "High volume rally after earnings" }
]

Then include a short summary paragraph of top 3 trades and market sentiment.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: "You are an expert day-trading analyst." },
      { role: "user", content: prompt },
    ],
  });

  const text = completion.choices[0].message?.content || "";
  const jsonMatch = text.match(/\[.*\]/s);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  const summary = text.replace(/\[.*\]/s, "").trim();

  return { deals: parsed, summary };
  */
//process.env.COHERE_API_KEY
const co = new CohereClient({token:"2f7GPvRUHd3oxfBByZRA0oLpoXlFU5rIYYYVA1xM"} );

const prompt = `
You are a financial market analyst. From the following stock data, identify the best 5 day trading opportunities:

${JSON.stringify(stocks, null, 2)}

Criteria:
- High intraday volatility or strong trend
- Large trading volume
- Momentum signals (breakout, RSI, MACD)
- Exclude low liquidity or low price stocks

Return a JSON array:
[
  { "symbol": "TSLA", "price": 259.4, "change_pct": "+3.5%", "volume": "54M", "pattern": "Bullish breakout", "reason": "High volume rally after earnings" }
]

Then include a short summary paragraph of top 3 trades and market sentiment.
`; 
   



const response = await co.chat({
 // model: "command-xlarge-nightly",
  model: 'command-a-03-2025',
  //prompt: "Analyze stock deals and rank best opportunities",
 // maxTokens: 150,
   message: prompt,
      
});

const jsonMatch = response.text.match(/\[.*\]/s);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  const summary = response.text.replace(/\[.*\]/s, "").trim();

console.log('RESPONSE-parsed=================',parsed);
console.log('RESPONSE-summary2=================',summary);


console.log('RESPONSE-teXT=================',response.text);
return { deals: parsed,summary: summary };



}

//analyzeDeals();

