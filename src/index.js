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
const { WebSocket } = require("ws");
const { Server } = require("socket.io");


const finnhub = require("finnhub");
//import FinnhubAPI, { FinnhubWS } from '@stoqey/finnhub';
const YahooFinance = require("yahoo-finance2").default;
const https = require("https");
const { fetch, Agent } = require("undici");
//import yahooFinance from "yahoo-finance2";

const { fetchStockData } = require("./services/fetchStocks");
const { analyzeDeals } = require("./services/analyzeDeals");

const { screenSymbols } = require("./screener");

const { detectPatterns } = require("./patternUtils2");
const { fetchCandles } = require("./fetchData");
const api  = require('zacks-api');
const { RSI, MACD } = require("technicalindicators");
const { alpacaTrading, alpacaData}  = require("./utils/alpacaClient");

const { connectMarketDataWS } = require("./marketDataWS.js");
//dotenv.config();
const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

dns.setDefaultResultOrder("ipv4first");

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey','ripHistorical'] });
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





app.get("/api/trending", async (req, res) => {
  try {
    const region = (req.query.region || "US").toUpperCase();



    const result = await yahooFinance.screener({
  scrIds: "day_gainers",
  count: 20
},
      { validateResult: false });


    const quotes = result?.quotes || [];
    console.log('TOPRESULTS>>>>>>',quotes);
    const formatted = quotes.map(q => ({
      symbol: q.symbol,
      name: q.shortName || q.longName || "-",
      price: q.regularMarketPrice,
      changePercent: q.regularMarketChangePercent?.toFixed(2),
      volume: q.regularMarketVolume
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching trending symbols:", error);
    res.status(500).json({ error: "Failed to fetch trending symbols", details: error.message });
  }
});


app.get("/api/small_cap_gainers", async (req, res) => {
  try {
   const result = await yahooFinance.screener({
  scrIds: "small_cap_gainers",
  count: 25
},
      { validateResult: false });
    const quotes = result.quotes || [];

    const formatted = quotes
      .filter(
        (q) =>
          q.marketCap > 3e8 &&
          q.marketCap < 2e9 &&
          q.regularMarketVolume > 100000
      )
      .map((q) => ({
        symbol: q.symbol,
        name: q.shortName || q.longName || "-",
        price: q.regularMarketPrice,
        changePercent: q.regularMarketChangePercent?.toFixed(2),
        volume: q.regularMarketVolume,
      }));

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching small cap gainers:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch small cap gainers", details: err.message });
  }
});


app.get("/api/sma", async (req, res) => {
  const symbols = req.query.symbols;
  const smaPeriods = [20, 50, 200];

  if (!symbols) {
    return res.status(400).json({ error: "Please provide comma-separated symbols" });
  }

  const symbolList = symbols.split(",").map((s) => s.trim().toUpperCase());
  const results = {};

  // Calculate date 1 year ago for SMA(200)
  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  for (const symbol of symbolList) {
    try {
      // ✅ Correct usage: period1 must be a Date or timestamp
      const history = await yahooFinance.historical(symbol, {
        period1: oneYearAgo,
        period2: now,
        interval: "1d",
      });

      if (!history || history.length < 200) {
        results[symbol] = { error: "Not enough data for SMA(200)" };
        continue;
      }

      const closes = history.map((h) => h.close);
      const len = closes.length;

      const computeSMA = (period, index) => {
        if (index + 1 < period) return null;
        const slice = closes.slice(index + 1 - period, index + 1);
        return slice.reduce((a, b) => a + b, 0) / period;
      };

      // Compute SMAs for all data points
      const smaData = closes.map((_, i) => ({
        sma20: computeSMA(20, i),
        sma50: computeSMA(50, i),
        sma200: computeSMA(200, i),
      }));

      const last = smaData[len - 1];
      const prev = smaData[len - 2];

      const entry = {
        close: Number(closes[len - 1].toFixed(2)),
        sma_20: last.sma20 ? Number(last.sma20.toFixed(2)) : null,
        sma_50: last.sma50 ? Number(last.sma50.toFixed(2)) : null,
        sma_200: last.sma200 ? Number(last.sma200.toFixed(2)) : null,
      };

      // Detect crossovers
      const bullish = (aPrev, aCurr, bPrev, bCurr) => aPrev < bPrev && aCurr >= bCurr;
      const bearish = (aPrev, aCurr, bPrev, bCurr) => aPrev > bPrev && aCurr <= bCurr;

      if (bullish(prev.sma20, last.sma20, prev.sma50, last.sma50))
        entry.signal_20_50 = "bullish_cross";
      else if (bearish(prev.sma20, last.sma20, prev.sma50, last.sma50))
        entry.signal_20_50 = "bearish_cross";
      else entry.signal_20_50 = "neutral";

      if (bullish(prev.sma50, last.sma50, prev.sma200, last.sma200))
        entry.signal_50_200 = "bullish_cross";
      else if (bearish(prev.sma50, last.sma50, prev.sma200, last.sma200))
        entry.signal_50_200 = "bearish_cross";
      else entry.signal_50_200 = "neutral";

      results[symbol] = entry;
    } catch (err) {
      results[symbol] = { error: err.message };
    }
  }

  res.json(results);
});


app.get("/api/most_actives", async (req, res) => {
  try {
    const movers = await yahooFinance.screener(
      {
        scrIds: "most_actives",
        count: 25,
      },
      { validateResult: false }
    );

    const results = (movers.quotes || [])
      .filter((s) => s && s.symbol && s.regularMarketPrice != null)
      .map((s) => ({
        symbol: s.symbol,
        name: s.shortName || s.longName || "N/A",
        price: s.regularMarketPrice,
        changePercent: s.regularMarketChangePercent,
        volume: s.regularMarketVolume,
      }));

    res.json(results);
  } catch (err) {
    const msg = err?.message?.toLowerCase() || "";

    // 🚦 Detect rate-limit or 429
    if (msg.includes("too many requests") || msg.includes("rate limit") || msg.includes("429")) {
      console.error("❌ Screener error: Too Many Requests. Rate limited. Try after a while.");
      return res.status(429).json({
        error: "❌ Screener error: Too Many Requests. Rate limited. Try after a while.",
      });
    }

    console.error("Error fetching most actives:", err);
    res.status(500).json({
      error: `❌ Screener error: ${err.message || "Unknown error"}`,
      details: err.errors || null,
    });
  }
});

app.get("/api/day_losers", async (req, res) => {
  try {
    const movers = await yahooFinance.screener({
      scrIds: "day_losers",
      count: 10,
    },
      { validateResult: false });

    // Safely map and filter data
    const results = (movers.quotes || [])
      .filter((s) => s && s.symbol && s.regularMarketPrice != null)
      .map((s) => ({
        symbol: s.symbol,
        name: s.shortName || s.longName || "N/A",
        price: s.regularMarketPrice,
        changePercent: s.regularMarketChangePercent,
        volume: s.regularMarketVolume,
      }));

    res.json(results);
  } catch (err) {
    console.error("Error fetching day losers:", err);
    res.status(500).json({
      error: err.message,
      details: err.errors || null, // helpful if you want to log details
    });
  }
});

app.get("/api/growth_technology_stocks", async (req, res) => {
  try {
    const movers = await yahooFinance.screener({
      scrIds: "growth_technology_stocks",
      count: 25,
    },
      { validateResult: false });
   //    const movers = await yahooFinance.screener("growth_technology_stocks");
//undervalued_large_caps
    // Safely map and filter data
    const results = (movers.quotes || [])
      .filter((s) => s && s.symbol && s.regularMarketPrice != null)
      .map((s) => ({
        symbol: s.symbol,
        name: s.shortName || s.longName || "N/A",
        price: s.regularMarketPrice,
        changePercent: s.regularMarketChangePercent,
        volume: s.regularMarketVolume,
      }));

    res.json(results);
  } catch (err) {
    console.error("Error fetching growth technology stocks:", err);
    res.status(500).json({
      error: err.message,
      details: err.errors || null, // helpful if you want to log details
    });
  }
});




app.get("/api/undervalued_large_caps", async (req, res) => {
  try {
    const movers = await yahooFinance.screener({
      scrIds: "undervalued_large_caps",
      count: 25,
    },
      { validateResult: false });
   //    const movers = await yahooFinance.screener("growth_technology_stocks");
//undervalued_large_caps
    // Safely map and filter data
    const results = (movers.quotes || [])
      .filter((s) => s && s.symbol && s.regularMarketPrice != null)
      .map((s) => ({
        symbol: s.symbol,
        name: s.shortName || s.longName || "N/A",
        price: s.regularMarketPrice,
        changePercent: s.regularMarketChangePercent,
        volume: s.regularMarketVolume,
      }));

    res.json(results);
  } catch (err) {
    console.error("Error fetching growth technology stocks:", err);
    res.status(500).json({
      error: err.message,
      details: err.errors || null, // helpful if you want to log details
    });
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


app.get("/api/fchart2", async (req, res) => {
  try {
    const symbol = req.query.symbol;
    if (!symbol) return res.status(400).json({ error: "Symbol required" });

    // --- TIME RANGE (8 months) ---
    const period2 = new Date();
    const period1 = new Date();
    period1.setMonth(period2.getMonth() - 8);

    // ============ SAFE WRAPPER WITH RETRIES ============
    async function safeYahooChart(symbol, options, retries = 5, delay = 500) {
      try {
        return await yahooFinance.chart(symbol, options);
      } catch (err) {
        const status = err?.status || err?.statusCode;

        // Handle Too Many Requests
        if (status === 429 && retries > 0) {
          console.warn(`⚠️ 429 Too Many Requests — retrying in ${delay} ms (${retries} retries left)`);

          await new Promise(r => setTimeout(r, delay));
          return safeYahooChart(symbol, options, retries - 1, delay * 2); // exponential backoff
        }

        // Some other error → just rethrow after retries
        throw err;
      }
    }

    // ========== CALL USING SAFE WRAPPER ==========
    const chartData = await safeYahooChart(symbol, {
      period1,
      period2,
      interval: "1d",
    });

    const quotes = chartData?.quotes || [];
    if (!quotes.length) return res.status(404).json({ error: "No data" });

    console.log(quotes[0].date, typeof quotes[0].date);

    // --- ARRAYS ---
    const close = quotes.map(q => q.close);
    const volume = quotes.map(q => q.volume);

    const atsf = computeATSF(quotes);

    // --- RSI ---
    const rsiRaw = RSI.calculate({ values: close, period: 14 });
    const rsi = rsiRaw.map((val, i) => {
      if (!isFinite(val)) return null;
      const idx = i + (quotes.length - rsiRaw.length);
      const dateString = new Date(quotes[idx].date).toISOString().split("T")[0];
      return { time: dateString, value: Number(val) };
    }).filter(Boolean);

    // --- MACD ---
    const macdRaw = MACD.calculate({
      values: close,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    const macd = macdRaw.map((entry, i) => {
      const idx = i + (quotes.length - macdRaw.length);
      const dateString = new Date(quotes[idx].date).toISOString().split("T")[0];

      if (!isFinite(entry.histogram) || !isFinite(entry.signal) || !isFinite(entry.MACD)) return null;

      return {
        time: dateString,
        hist: Number(entry.histogram),
        signal: Number(entry.signal),
        macd: Number(entry.MACD),
      };
    }).filter(Boolean);

    // --- TRENDLINES ---
    const pivots = detectPivots(quotes);
    const trendlines = generateTrendlines(pivots).map(t => ({
      ...t,
      p1: { time: new Date(t.p1.time).toISOString().split("T")[0], price: t.p1.price },
      p2: { time: new Date(t.p2.time).toISOString().split("T")[0], price: t.p2.price },
    }));

    const enrichedTrendlines = detectBreakouts(quotes, trendlines);

    // --- RESPONSE ---
    res.json({
      meta: chartData.meta,
      quotes,
      indicators: { rsi, macd },
      ai: { atsf },
      enrichedTrendlines,
    });

  } catch (e) {
    console.error("⛔ API ERROR:", e);
    res.status(500).json({ error: e.message || "Internal server error" });
  }
});





/**
app.get("/api/fchart2", async (req, res) => {
  try {
    const symbol = req.query.symbol;
    if (!symbol) return res.status(400).json({ error: "Symbol required" });

    // --- TIME RANGE (8 months) ---
    const period2 = new Date();
    const period1 = new Date();
    period1.setMonth(period2.getMonth() - 8);

    const chartData = await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval: "1d",
    });

    const quotes = chartData?.quotes || [];
    if (!quotes.length) return res.status(404).json({ error: "No data" });

console.log(quotes[0].date, typeof quotes[0].date);

    // --- EXTRACT ARRAYS ---
    const close = quotes.map(q => q.close);
    const volume = quotes.map(q => q.volume);


const atsf = computeATSF(quotes);
console.log('computed-atsf===',atsf);
    // --- CALCULATE RSI ---
   const rsiRaw = RSI.calculate({ values: close, period: 14 });

// CLEAN RSI
const rsi = rsiRaw.map((val, i) => {
  if (!isFinite(val)) return null;  // Skip invalid
  const idx = i + (quotes.length - rsiRaw.length);
  const dateString = new Date(quotes[idx].date).toISOString().split("T")[0];
  return { time: dateString, value: Number(val) };
}).filter(Boolean); // remove null values

  // --- CALCULATE MACD ---
const macdRaw = MACD.calculate({
  values: close,
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
  SimpleMAOscillator: false,
  SimpleMASignal: false,
});

const macd = macdRaw.map((entry, i) => {
  const idx = i + (quotes.length - macdRaw.length);
  const dateString = new Date(quotes[idx].date).toISOString().split("T")[0];

  if (!isFinite(entry.histogram) || !isFinite(entry.signal) || !isFinite(entry.MACD)) {
    return null;  // skip invalid rows
  }




  return {
    time: dateString,
    hist: Number(entry.histogram),
    signal: Number(entry.signal),
    macd: Number(entry.MACD),   
  };
}).filter(Boolean);


const pivots = detectPivots(quotes);
const trendlines = generateTrendlines(pivots).map(t => ({
  ...t,
  p1: { time: new Date(t.p1.time).toISOString().split("T")[0], price: t.p1.price },
  p2: { time: new Date(t.p2.time).toISOString().split("T")[0], price: t.p2.price },
}));

const enrichedTrendlines = detectBreakouts(quotes, trendlines);
    // --- FINAL RESPONSE ---
    res.json({
      meta: chartData.meta,
      quotes,
      indicators: { rsi, macd },
       ai: {
          atsf
      },
      enrichedTrendlines,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
**/

app.get("/api/fchart", async (req, res) => {
try {
    const symbol = req.query.symbol;
    if (!symbol) return res.status(400).json({ error: "Symbol is required" });

    // Yahoo Finance expects UNIX timestamps (or range) – NOT Date objects
     const period2 = new Date();
    const period1 = new Date();
    period1.setMonth(period2.getMonth() - 8);

    const chartData = await yahooFinance.chart(symbol, {
      period1,
      period2,       // MUCH safer
      interval: "1d",
    });
const quotes = chartData.quotes;
const formattedQuotes = quotes.map(q => ({
   date: new Date(q.date).toISOString().split("T")[0],
  open: q.open,
  high: q.high,
  low: q.low,
  close: q.close,
  volume: q.volume,
}));
    
    if (!quotes.length) return res.status(404).json({ error: "No data available" });

    // Extract closing prices and volume
    const close = quotes.map(q => q.close);

    // -------- RSI --------
    const rsiRaw = RSI.calculate({ values: close, period: 14 });
    const rsi = rsiRaw.map((v, i) => ({
      time: quotes[i + (quotes.length - rsiRaw.length)]?.date,
      value: v,
    }));

    // -------- MACD --------
    const macdRaw = MACD.calculate({
      values: close,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    const macd = macdRaw.map((entry, i) => ({
      time: quotes[i + (quotes.length - macdRaw.length)]?.date,
      hist: entry.histogram,
      signal: entry.signal,
      macd: entry.MACD,
    }));

    return res.json({
      meta: chartData.meta,
      formattedQuotes,
      indicators: { rsi, macd },
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Server Error",
      message: error.message,
    });
  }
});
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


/* ===============================
   ACCOUNT INFO
================================ */
app.get("/api/account", async (req, res) => {
  try {
    const response = await alpacaTrading.get("/v2/account");
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || err.message);
  }
});

/* ===============================
   ASSETS (tradable stocks)
================================ */
app.get("/api/assets", async (req, res) => {
  try {
    const response = await alpacaTrading.get("/v2/assets", {
      params: {
        status: "active",
        asset_class: "us_equity",
        tradable: true,
        exchange: "NASDAQ", // or NYSE NASDAQ
      },
    });
console.log('inassets>>',response.data.length);
    const slim = response.data
      .filter(a => a.fractionable) // optional
      .slice(0, 100)
      .map(a => ({
        symbol: a.symbol,
        name: a.name,
        exchange: a.exchange,
      }));

    res.json(slim);
  } catch (err) {
    res.status(500).json(err.response?.data || err.message);
  }
});
/* ===============================
   OPEN POSITIONS
================================ */
app.get("/api/positions", async (req, res) => {
  try {
    const response = await alpacaTrading.get("/v2/positions");
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || err.message);
  }
});


app.get("/api/orders", async (req, res) => {

  console.log('ht endpoint api/orders');
  try {
    const response = await alpacaTrading.get("/v2/orders");
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || err.message);
  }
});

async function getBasePrice(symbol) {
  try {
    const res = await alpacaData.get(
      `/v2/stocks/${symbol}/quotes/latest`
    );

    const quote = res.data?.quote;

    if (!quote) {
      throw new Error("No quote returned");
    }

    // BUY → use ask price
    if (quote.ap && quote.ap > 0) {
      return Number(quote.ap);
    }

    // fallback
    if (quote.bp && quote.bp > 0) {
      return Number(quote.bp);
    }

    throw new Error("Invalid quote prices");
  } catch (err) {
    console.error("getBasePrice error:", err.response?.data || err.message);
    throw err;
  }
}


/* ===============================
   PLACE ORDER (NORMAL / BRACKET)
================================ */
app.post("/api/order", async (req, res) => {

console.log('ht endpoint api/orders222222');

  try {
    const {
      symbol,
      qty,
      side,
      type = "market",
      order_class,
      stop_loss,
      take_profit,
    } = req.body;

    console.log('order_class===',order_class );
    let basePrice = null;

    if (order_class === "bracket") {
      basePrice = await getBasePrice(symbol);
    }


console.log('order_class===',order_class );

    const orderPayload = {
      symbol,
      qty,
      side,
      type,
      time_in_force: "day",
    };

    if (order_class === "bracket") {
      orderPayload.order_class = "bracket";

      if (stop_loss?.stop_price) {
        if (stop_loss.stop_price >= basePrice) {
          return res.status(400).json({
            error: `Stop loss must be below ${basePrice}`,
          });
        }

        orderPayload.stop_loss = {
          stop_price: Number(stop_loss.stop_price.toFixed(2)),
        };
      }

      if (take_profit?.limit_price) {
        if (take_profit.limit_price <= basePrice) {
          return res.status(400).json({
            error: `Take profit must be above ${basePrice}`,
          });
        }

        orderPayload.take_profit = {
          limit_price: Number(take_profit.limit_price.toFixed(2)),
        };
      }
    }

    console.log('my orderPayload===',orderPayload);

    const response = await alpacaTrading.post("/v2/orders", orderPayload);

    console.log('my reposnse from alpaca==',response);

    res.json(response.data);

  } catch (err) {
    res.status(500).json(err.response?.data || err.message);
  }
});

/* ===============================
   CLOSE POSITION
================================ */
app.delete("/api/positions/:symbol", async (req, res) => {
  try {
    const response = await alpacaTrading.delete(
      `/v2/positions/${req.params.symbol}`
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || err.message);
  }
});

console.log("Alpaca baseURL:", alpacaTrading);

app.get("/api/search", async (req, res) => {


  const { q } = req.query;

console.log('search hit -q==',q);

  if (!q || q.length < 2) return res.json([]);

  const response = await alpaca.get("/v2/assets");

  const matches = response.data
    .filter(a =>
      a.symbol.startsWith(q.toUpperCase()) &&
      a.tradable
    )
    .slice(0, 20)
    .map(a => ({
      symbol: a.symbol,
      name: a.name,
    }));

  res.json(matches);
});

/* ================= CONFIG ================= */
const ALPACA_KEY = process.env.ALPACA_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET;
const ALPACA_WS_URL = "wss://stream.data.alpaca.markets/v2/iex"; // or sip
const SYMBOL_API = "https://candlestick-screener.onrender.com/api/symbol_list_sp500";
/* ========================================== */

let alpacaWS = null;

/* ---------- Fetch & parse symbols ---------- */
async function fetchSymbols() {
  const res = await axios.get(SYMBOL_API);

console.log('myres.data==',res.data);

  return res.data.symbols;
 //   .replace(/"/g, "")
//    .split(",")
 //   .map(s => s.trim());
}

/* ---------- Alpaca WebSocket ---------- */
async function startAlpacaWS() {
 // const symbols = await fetchSymbols();

  alpacaWS = new WebSocket(ALPACA_WS_URL);

  alpacaWS.on("open", () => {
    console.log("✅ Connected to Alpaca WS");

    alpacaWS.send(JSON.stringify({
      action: "auth",
      key: ALPACA_KEY,
      secret: ALPACA_SECRET
    }));
/*
    alpacaWS.send(JSON.stringify({
      action: "subscribe",
      trades: symbols
    }));
  });
*/
  alpacaWS.on("message", (msg) => {
    const data = JSON.parse(msg);

    data.forEach(event => {
      if (event.T === "t") {
        io.emit("price", {
          symbol: event.S,
          price: event.p,
          size: event.s,
          time: event.t
        });
      }
    });
  });

  alpacaWS.on("close", () => {
    console.log("❌ Alpaca WS closed — reconnecting...");
    setTimeout(startAlpacaWS, 3000);
  });
}

startAlpacaWS();

/* ---------- Socket.IO ---------- */
io.on("connection", (socket) => {
  console.log("🟢 Client connected a");
  socket.on("disconnect", () => console.log("🔴 Client disconnected"));
});


const trackedSymbols = new Set();

io.on("connection", async (socket) => {
  console.log("🟢 Client connected b");

  const positions = await alpacaTrading.get("/v2/positions");
  socket.emit("positions:update", positions.data);

  // Track symbols
  positions.data.forEach(p => trackedSymbols.add(p.symbol));

  socket.emit("symbols:list", [...trackedSymbols]);

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected");
  });
});

connectMarketDataWS(io, () => [...trackedSymbols]);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () =>
  console.log(`✅ Server running on port ${process.env.PORT || 4000}`)
);

