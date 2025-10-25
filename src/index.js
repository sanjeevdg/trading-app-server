//import express, { Request, Response } from "express";
//import cors from "cors";
//import dotenv from 'dotenv';
const express = require("express");
const { CohereClient } = require("cohere-ai");
const dns = require("dns");
//const { Request, Response } = require("express");
const axios  = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");
const finnhub = require("finnhub");
//import FinnhubAPI, { FinnhubWS } from '@stoqey/finnhub';
const yahooFinance = require("yahoo-finance2").default;
const https = require("https");
const { fetch, Agent } = require("undici");
//import yahooFinance from "yahoo-finance2";

const { fetchStockData } = require("./services/fetchStocks");
const { analyzeDeals } = require("./services/analyzeDeals");

const { screenSymbols } = require("./screener");

const { detectPatterns } = require("./patternUtils2");
const { fetchCandles } = require("./fetchData");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());


dns.setDefaultResultOrder("ipv4first");

// Force IPv4 resolution to avoid Node fetch timeouts
//dns.setDefaultResultOrder("ipv4first");




//const ipv4Agent = new Agent({ connect: { family: 4 } });

console.log('hhhhh');

app.post("/api/daytrading-deals", async (req, res) => {
  try {
    // fetch real-time data
    console.log('request body typeof =====',typeof req.body);
    const {symbols}  = req.body;
console.log('symblsfromclient==',symbols);
    const syms = symbols.split(",").map((s) => s.trim());

console.log('symblsfromclientconverttoarray==',syms);
    const stocks = await fetchStockData(syms);
    // analyze with GPT
    console.log('STOCKSRETURNED=============',stocks);
    //
    const analysis = await analyzeDeals(stocks);
    res.json(analysis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

                     
const FINNHUB_API = "d3nr05hr01qtm4jdum8gd3nr05hr01qtm4jdum90";
const YAHOO_FINANCE_URL = "https://query1.finance.yahoo.com/v7/finance/quote";
const co = new CohereClient({token:"2f7GPvRUHd3oxfBByZRA0oLpoXlFU5rIYYYVA1xM"} );

//const finnhubClient = new finnhub.DefaultApi();
//finnhubClient.apiKey = finnhub.ApiClient.instance.authentications["api_key"];
//finnhubClient.apiKey.apiKey = FINNHUB_API;


//(finnhub.ApiClient.instance?.authentications as any).api_key.apiKey = FINNHUB_API;

//const finnhubClient = api_key;


//const finnhubAPI = new FinnhubAPI(FINNHUB_API);

//const finnhubClient = new finnhub.DefaultApi(FINNHUB_API);



app.get("/api/test", async (req, res) => {

https.get("https://finnhub.io/api/v1/quote?symbol=AAPL&token=d3nr05hr01qtm4jdum8gd3nr05hr01qtm4jdum90", {
  agent: new https.Agent({ family: 4 }),
}, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => console.log("✅ Data:", data));
}).on("error", (err) => {
  console.error("❌ Error:", err);
});

});




app.get("/api/screener", async (req, res) => {

  console.log('req.query',req.query);
  const symbols = req.query.symbols?.split(",").map(s => s.trim().toUpperCase()) || ["AAPL", "MSFT"];
  const from = req.query.from ? new Date(req.query.from) : (() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d; })();
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const typeFilter = req.query.type?.toLowerCase() || "all";
const selectedPatterns = req.query.patterns?.split(",").map(p => p.trim().toLowerCase()) || [];

  const hits = [];

  for (const symbol of symbols) {
    try {
      const candles = await fetchCandles(symbol, from, to);
//console.log(`Fetched ${candles.length} candles for ${symbol} from ${from} to ${to}`);

      const patterns = detectPatterns(candles);
//console.log(`Detected ${patterns?.length || 0} patterns for ${symbol}:`, patterns);

//console.log("Patterns for", symbol, patterns);

      const filtered = patterns.filter(p => {
  const name = (p?.name || "").toLowerCase();
  const type = (p?.type || "").toLowerCase();
  const typeMatch = typeFilter === "all" || type === typeFilter;
  const patternMatch =
    selectedPatterns.length === 0 || selectedPatterns.includes(name);
  return typeMatch && patternMatch;
});
console.log(`After filtering (${symbol}): ${filtered.length} matches`);

      if (filtered.length > 0) hits.push({ symbol, patterns: filtered, candles });
    } catch (err) {
      console.error("Error fetching", symbol, err);
    }
  }

//console.log('SENDINGMYHITS>>>>>>>>',hits);

  res.json(hits);
});

app.post("/api/screen", async (req, res) => {
  try {
    const { symbols, patterns } = req.body;
    if (!symbols?.length) return res.status(400).json({ error: "No symbols provided" });
    const results = await screenSymbols(symbols, patterns);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// Helper to fetch JSON via https.get (IPv4 forced)
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { family: 4 }, // ✅ Force IPv4 to avoid ETIMEDOUT on IPv6
      (res) => {
        let data = "";

        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.end();
  });
}

app.get("/api/stocks/:symbol", async (req, res) => {
  const { symbol } = req.params;

  try {
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API}`;
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API}`;

    const [quoteData, profileData] = await Promise.all([
      fetchJson(quoteUrl),
      fetchJson(profileUrl),
    ]);

    const data = {
      symbol,
      name: profileData.name || symbol,
      price: quoteData.c,
      changePercent: quoteData.dp,
      high: quoteData.h,
      low: quoteData.l,
      open: quoteData.o,
      prevClose: quoteData.pc,
      marketCap: profileData.marketCapitalization,
    };

    res.json(data);
  } catch (err) {
    console.error("Finnhub Error:", err);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});

app.post("/api/cdsstocks", async (req, res) => {
  const { symbols } = req.body;

  if (!symbols || !Array.isArray(symbols)) {
    return res.status(400).json({ error: "symbols must be an array" });
  }

  try {
    const results = [];

    for (const symbol of symbols) {
      console.log(`Fetching data for ${symbol}...`);

      // --- 1️⃣ Latest market info ---
      const quote = await yahooFinance.quote(symbol);

      // --- 2️⃣ Chart data for candles ---
      const period2 = new Date();
      const period1 = new Date();
      period1.setFullYear(period2.getFullYear() - 5);

      const chart = await yahooFinance.chart(symbol, {
        period1,
        period2,
        interval: "1mo", // monthly candles
      });

      const quotes = chart?.quotes || [];

      // --- 3️⃣ Prepare candle data ---
      const candles = quotes.map((q) => ({
        time: q.date.toISOString().split("T")[0],
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
      }));

      // --- 4️⃣ Compute historical dividend yield (real) ---
      const annualDividend =
        quote.trailingAnnualDividendRate || quote.dividendRate || 0;

      const dividendYields = quotes.map((q) => ({
        date: q.date.toISOString().split("T")[0],
        yield:
          q.close && annualDividend
            ? ((annualDividend / q.close) * 100).toFixed(2)
            : 0,
      }));

      // --- 5️⃣ Consolidate all results ---
      results.push({
        symbol,
        price: quote.regularMarketPrice || null,
        peRatio: quote.trailingPE || null,
        eps: quote.epsTrailingTwelveMonths || null,
        dividendYield: quote.trailingAnnualDividendYield
          ? (quote.trailingAnnualDividendYield * 100).toFixed(2)
          : 0,
        marketCap: quote.marketCap || null,
        candles,
        dividendYields,
      });
    }

    res.json(results);
  } catch (err) {
    console.error("Yahoo Finance API error:", err);
    res.status(500).json({ error: "Error fetching stock data" });
  }
});
// Fetch summary + dividend history
app.post("/api/sdhstocks", async (req, res) => {

console.log('entereds sdh stockse',req.body);
console.log('entereds sdh stockse222222',typeof req.body);


  const { symbols } = req.body;
  if (!symbols || !Array.isArray(symbols)) {
    return res.status(400).json({ error: "Symbols must be an array" });
  }


console.log('symbols',symbols);
console.log('symbols222222',typeof symbols);


  try {
    const results = [];

    for (const symbol of symbols) {
      const quote = await yahooFinance.quote(symbol);
     
      // Fetch chart data (replaces historical)
        const chart = await yahooFinance.chart(symbol, {
          period1: "2025-01-01", // monthly data points
          period2: "2025-10-10", // monthly data points
          interval: "1wk",     // last 5 years
        });

        // Format chart data for line charts
        const dividendYields = chart.quotes
          .filter((q) => q.dividendsPerShare !== undefined)
          .map((q) => ({
            date: q.date,
            yield: q.dividendsPerShare,
          }));

        results.push({
          symbol,
          price: quote.regularMarketPrice || null,
          peRatio: quote.trailingPE || null,
          eps: quote.epsTrailingTwelveMonths || null,
          dividendYield: quote.trailingAnnualDividendYield
            ? (quote.trailingAnnualDividendYield * 100).toFixed(2)
            : 0,
          marketCap: quote.marketCap || null,
          dividendYields,
        });
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});

// Fetch stock data (you can switch between Finnhub / Yahoo)

app.get("/api/yfstocks/:symbol", async (req, res) => {

console.log('stocks endpoint called w params',req.params);




  const { symbol } = req.params;
  try {
 //   const response = await axios.get(`${YAHOO_FINANCE_URL}?symbols=${symbol}`);
   // const quote = response.data.quoteResponse.result[0];
     const quote = await yahooFinance.quote(symbol);
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});



/*


app.get("/api/stocks/:symbol", async (req: any, res: any) => {
const { symbol } = req.params;
try {

 // Retrieve the API key authentication object from the Finnhub API client
        const api_key = finnhub?.ApiClient?.instance?.authentications['api_key'];
        
        // Set the API key from the environment variable
        api_key.apiKey = FINNHUB_API;

        // Create a new instance of the Finnhub client
        const finnhubClient = new finnhub.DefaultApi();

        // Fetch the quote for the given symbol and handle the response
        finnhubClient.quote(symbol, (err: any, data: any, response: any) => {
            // Log the response data to the console
            console.log(data);
        });
}
catch(e) {
  console.log('error caught=====',e);
}



});

app.get("/api/xstocks/:symbol", async (req: any, res: any) => {
  const { symbol } = req.params;

  try {
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API}`;
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API}`;

    // Use fetch with HTTPS agent
    const [quoteRes, profileRes] = await Promise.all([
      fetch(quoteUrl, {
  dispatcher: ipv4Agent, // <-- use dispatcher instead of agent
}),
      fetch(profileUrl,{
  dispatcher: ipv4Agent, // <-- use dispatcher instead of agent
}),
    ]);

    if (!quoteRes.ok || !profileRes.ok) {
      const quoteText = await quoteRes.text();
      const profileText = await profileRes.text();
      console.error("Finnhub fetch failed:", quoteText, profileText);
      return res.status(500).json({ error: "Failed to fetch stock data" });
    }

    const quoteData = await quoteRes.json();
    const profileData = await profileRes.json();

    const data = {
      symbol,
      name: profileData.name || symbol,
      price: quoteData.c,
      changePercent: quoteData.dp,
      high: quoteData.h,
      low: quoteData.l,
      open: quoteData.o,
      prevClose: quoteData.pc,
      marketCap: profileData.marketCapitalization,
    };

    res.json(data);
  } catch (error: any) {
    console.error("Finnhub fetch error:", error);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});
*/
app.get("/api/xstocks/:symbol", async (req, res) => {
  const { symbol } = req.params;

  try {
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API}`;
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API}`;


console.log('quoteUrl=======',quoteUrl);
console.log('profileUrl============',profileUrl);


    // Add timeout + retry-friendly config
    const axiosConfig = { timeout: 10000 };

    const [quoteRes, profileRes] = await Promise.all([
      axios.get(quoteUrl, axiosConfig),
      axios.get(profileUrl, axiosConfig),
    ]);

    const data = {
      symbol,
      name: profileRes.data.name || symbol,
      price: quoteRes.data.c,
      changePercent: quoteRes.data.dp,
      high: quoteRes.data.h,
      low: quoteRes.data.l,
      open: quoteRes.data.o,
      prevClose: quoteRes.data.pc,
      marketCap: profileRes.data.marketCapitalization,
    };

    res.json(data);
  } catch (error) {
    console.error("Finnhub Error:", error?.code || error?.message || error);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});


// Analyze multiple stocks with Cohere AI
app.post("/api/analyze", async (req, res) => {
  const { stocks } = req.body; // array of {symbol, price, change, marketCap, etc}
  try {
    const prompt = `
    Analyze the following stock data and recommend the top 3 best investment options.
    Consider fundamentals, volatility, and market sentiment.
    Return results as JSON with fields: symbol, rating, reason.

    Stocks:
    ${JSON.stringify(stocks, null, 2)}
    `;

    const response = await co.chat({
      model: 'command-a-03-2025',
      message: prompt,
      
    });

    const text = response.text;
    res.json({ analysis: text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI analysis failed" });
  }
});








app.listen(process.env.PORT || 4000, () =>
  console.log(`✅ Server running on port ${process.env.PORT || 4000}`)
);

