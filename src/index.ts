//import express, { Request, Response } from "express";
//import cors from "cors";
//import dotenv from 'dotenv';
const express = require("express");
import { CohereClient } from "cohere-ai";
import dns from "dns";
//const { Request, Response } = require("express");
const axios  = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");
const finnhub = require("finnhub");
//import FinnhubAPI, { FinnhubWS } from '@stoqey/finnhub';

const https = require("https");
import { fetch, Agent } from "undici";
//import yahooFinance from "yahoo-finance2";

import { fetchStockData } from "./services/fetchStocks";
import { analyzeDeals } from "./services/analyzeDeals";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());


dns.setDefaultResultOrder("ipv4first");

// Force IPv4 resolution to avoid Node fetch timeouts
//dns.setDefaultResultOrder("ipv4first");




//const ipv4Agent = new Agent({ connect: { family: 4 } });

console.log('hhhhh');

app.post("/api/daytrading-deals", async (_req: any, res: any) => {
  try {
    // fetch real-time data
    const stocks = await fetchStockData();
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



app.get("/api/test", async (req:any, res:any) => {

https.get("https://finnhub.io/api/v1/quote?symbol=AAPL&token=d3nr05hr01qtm4jdum8gd3nr05hr01qtm4jdum90", {
  agent: new https.Agent({ family: 4 }),
}, (res:any) => {
  let data = "";
  res.on("data", (chunk:any) => (data += chunk));
  res.on("end", () => console.log("✅ Data:", data));
}).on("error", (err:any) => {
  console.error("❌ Error:", err);
});

});



// Helper to fetch JSON via https.get (IPv4 forced)
function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { family: 4 }, // ✅ Force IPv4 to avoid ETIMEDOUT on IPv6
      (res:any) => {
        let data = "";

        res.on("data", (chunk:any) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on("error", (err:any) => reject(err));
    req.end();
  });
}

app.get("/api/stocks/:symbol", async (req:any, res:any) => {
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





// Fetch stock data (you can switch between Finnhub / Yahoo)
/*
app.get("/api/yfstocks/:symbol", async (req: any, res: any) => {

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
app.get("/api/xstocks/:symbol", async (req: any, res: any) => {
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
  } catch (error: any) {
    console.error("Finnhub Error:", error?.code || error?.message || error);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});


// Analyze multiple stocks with Cohere AI
app.post("/api/analyze", async (req: any, res: any) => {
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

