//import express, { Request, Response } from "express";
//import cors from "cors";
//import dotenv from 'dotenv';
const dotenv = require("dotenv").config();

const express = require("express");
const { CohereClient } = require("cohere-ai");
const dns = require("dns");
//const { Request, Response } = require("express");
const axios  = require("axios");
const cors = require("cors");
const http = require("http");
//const { WebSocket } = require("ws");
//const { Server } = require("socket.io");


const finnhub = require("finnhub");
//import FinnhubAPI, { FinnhubWS } from '@stoqey/finnhub';
//const YahooFinance = require("yahoo-finance2").default;
const https = require("https");
const { fetch, Agent } = require("undici");
//import yahooFinance from "yahoo-finance2";

//const { fetchStockData } = require("./services/fetchStocks");
//const { analyzeDeals } = require("./services/analyzeDeals");

//const { screenSymbols } = require("./screener");

//const { detectPatterns } = require("./patternUtils2");
//const { fetchCandles } = require("./fetchData");
const api  = require('zacks-api');
const { RSI, MACD } = require("technicalindicators");


// const { alpacaTrading, alpacaData}  = require("./utils/alpacaClient");
/*
const {
  startAlpacaWS,
  subscribeSymbol,
  unsubscribeSymbol
} = require("./utils/alpacaStream.js");
*/

//const { connectMarketDataWS } = require("./marketDataWS.js");

const app = express();

//const server = http.createServer(app);
/*
const io = new Server(server, {
  cors: { origin: "*" }
});


startAlpacaWS(
  io,
  process.env.ALPACA_KEY,
  process.env.ALPACA_SECRET
);
*/
//console.log("Market:", Market);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

dns.setDefaultResultOrder("ipv4first");

//const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey','ripHistorical'] });
/*yahooFinance._opts.validation = { logWarnings: false, validateResults: false };//
yahooFinance._opts.validation = {
  logWarnings: false,
  logErrors: false,
  validateResults: false,
  transformErrors: false, // disable Zod-type transformation/decoding checks
};
yahooFinance._opts.validation = {
  logErrors: false,
  logWarnings: false,
  validateResults: false,
  transformErrors: false,
  transformResult: false, // <- skip Zod transform
  enableTransform: false, // <- ensures it returns raw Yahoo JSON
};
*/
// Force IPv4 resolution to avoid Node fetch timeouts
//dns.setDefaultResultOrder("ipv4first");
// {"symbol":"NVDA","name":"NVIDIA Corporation","price":202.49,"change":-0.157734,"volume":175662659}



app.get("/api/topgainers", async (req, res) => {

console.log('endpoint hit2222');

  try {
    const response = await alpacaData.get(`/v1beta1/screener/stocks/top-gainers`);
    res.json(response.data);
  } catch (err) {
    console.log('caughterr>>>',err);
    res.status(500).json(err.response?.data || err.message);
  } 
});


function getPeriod1FromRange(range) {
  const now = new Date();
  const date = new Date(now);

  if (range === '6mo') date.setMonth(now.getMonth() - 6);
  if (range === '1y') date.setFullYear(now.getFullYear() - 1);
  if (range === '5y') date.setFullYear(now.getFullYear() - 5);
  if (range === 'max') return new Date(0); // 1970

  return date;
}

// ------------------ TRENDLINE DETECTION ------------------
function detectPivots(data, lookback = 5) {
  const pivots = { highs: [], lows: [] };
  for (let i = lookback; i < data.length - lookback; i++) {
    const price = data[i].close;
    let highFlag = true;
    let lowFlag = true;
    
    for (let j = i - lookback; j < i + lookback; j++) {
      if (data[j].close > price) highFlag = false;
      if (data[j].close < price) lowFlag = false;
    }

    if (highFlag) pivots.highs.push({ time: data[i].date, price });
    if (lowFlag) pivots.lows.push({ time: data[i].date, price });
  }
  return pivots;
}

function generateTrendlines(pivots) {
  const trendlines = [];

  // Support (using pivot lows)
  if (pivots.lows.length >= 2) {
    const p1 = pivots.lows[0];
    const p2 = pivots.lows[pivots.lows.length - 1];
    trendlines.push({ type: "support", p1, p2 });
  }

  // Resistance (using pivot highs)
  if (pivots.highs.length >= 2) {
    const p1 = pivots.highs[0];
    const p2 = pivots.highs[pivots.highs.length - 1];
    trendlines.push({ type: "resistance", p1, p2 });
  }

  return trendlines;
}

// ---- BREAKOUT DETECTION ----
function detectBreakouts(quotes, trendlines) {
  const last = quotes[quotes.length - 1];
  const lastClose = last.close;

  return trendlines.map((t) => {
    // Calculate slope (simple line equation)
    const x1 = new Date(t.p1.time).getTime();
    const x2 = new Date(t.p2.time).getTime();
    const y1 = t.p1.price;
    const y2 = t.p2.price;

    const m = (y2 - y1) / (x2 - x1); // slope
    const b = y1 - m * x1; // intercept

    // Calculate trendline price at last date:
    const trendPrice = m * new Date(last.date).getTime() + b;

    let breakout = null;
    if (t.type === "support" && lastClose < trendPrice) {
      breakout = "bearish";
    }
    if (t.type === "resistance" && lastClose > trendPrice) {
      breakout = "bullish";
    }

    return { ...t, trendPrice, breakout };
  });
}

function computeATSF(quotes) {
  const period = 20; // sliding window
  const out = [];

  for (let i = period; i < quotes.length; i++) {
    const slice = quotes.slice(i - period, i);
    const closes = slice.map(p => p.close);

    // Linear regression slope
    const n = closes.length;
    const x = [...Array(n).keys()];
    const meanX = x.reduce((a, b) => a + b) / n;
    const meanY = closes.reduce((a, b) => a + b) / n;

    const slope =
      x.reduce((acc, xi, j) => acc + (xi - meanX) * (closes[j] - meanY), 0) /
      x.reduce((acc, xi) => acc + (xi - meanX) ** 2, 0);

    // Momentum score
    const momentum = (closes[n - 1] - closes[0]) / closes[0];

    // Volatility penalty
    const variance =
      closes.reduce((acc, c) => acc + (c - meanY) ** 2, 0) / n;
    const volPenalty = Math.sqrt(variance);

    // Normalize AI score from 0-100
    let score = slope * 1200 + momentum * 100 - volPenalty * 5;
    score = Math.max(0, Math.min(100, score));

    console.log('slice[slice.length - 1]==',typeof slice[slice.length - 1].date);

    out.push({
      time: new Date(slice[slice.length - 1].date).toISOString().split("T")[0],
      value: parseFloat(score.toFixed(2)),
    });
  }

  return out;
}






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

/*
consolenst finnhubClient = new finnhub.DefaultApi();
finnhubClient.apiKey = finnhub.ApiClient.instance.authentications["api_key"];
finnhubClient.apiKey.apiKey = FINNHUB_API;


(finnhub.ApiClient.instance?.authentications as any).api_key.apiKey = FINNHUB_API;
const finnhubClient = api_key;


const finnhubAPI = new FinnhubAPI(FINNHUB_API);

const finnhubClient = new finnhub.DefaultApi(FINNHUB_API);
*/


app.get("/api/test", async (req, res) => {

/*
https.get("https://finnhub.io/api/v1/quote?symbol=AAPL&token=d3nr05hr01qtm4jdum8gd3nr05hr01qtm4jdum90", {
  agent: new https.Agent({ family: 4 }),
}, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => console.log("✅ Data:", data));
}).on("error", (err) => {
  console.error("❌ Error:", err);
});
*/


const api_key = finnhub.ApiClient.instance.authentications['api_key'];
api_key.apiKey = "d3nr05hr01qtm4jdum8gd3nr05hr01qtm4jdum90"
const finnhubClient = new finnhub.DefaultApi()

finnhubClient.stockSymbols("US", (error, data, response) => {
  console.log(data)
});




});




app.get("/api/screener", async (req, res) => {

  console.log('req.query',req.query);
//  const symbols = req.query.symbols?.split(",").map(s => s.trim().toUpperCase()) || ["AAPL", "MSFT"];
  

let raw = req.query.symbols || "";
let symbols = raw
  .split(",")
  .map(s => s.replace(/"/g, "").trim()) // remove surrounding quotes
  .filter(Boolean);
  
  const from = req.query.from ? new Date(req.query.from) : (() => { const d = new Date(); d.setMonth(d.getMonth() - 6); return d; })();
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

function safeGetData(symbol, opts) {
  return api.getData(symbol, opts).then(data => {
    // Fix any invalid dates
    if (data && data.reportDate) {
      const d = new Date(data.reportDate);
      if (isNaN(d.getTime())) {
        data.reportDate = null;  // or keep raw value
      }
    }
    return data;
  }).catch(err => {
    console.error("Zacks fetch error for", symbol, err.message);
    return { error: "Failed to fetch" };
  });
}

app.post("/api/zacks/bulk", async (req, res) => {
  const tickers = Array.isArray(req.body) ? req.body : req.body.tickers;

  console.log("Received tickers:", tickers);

  if (!Array.isArray(tickers) || tickers.length === 0) {
    return res.status(400).json({ error: "tickers must be a non-empty array" });
  }

  const results = {};
  let pending = tickers.length;

  tickers.forEach((symbol) => {
    safeGetData(symbol, { usePuppeteer: true })
      .then((data) => {
        results[symbol] = data;
      })
      .catch((err) => {
        console.error(`Zacks error for ${symbol}:`, err.message);
        results[symbol] = { error: "Failed to fetch" };
      })
      .finally(() => {
        pending--;
        if (pending === 0) {
          res.json(results);
        }
      });
  });
});


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


const PORT = process.env.PORT || 4000;

app.listen(PORT, () =>
  console.log(`✅ Server running on port ${process.env.PORT || 4000}`)
);

