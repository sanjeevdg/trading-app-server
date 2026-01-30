
const { WebSocket } = require("ws");
const { EventEmitter } = require("events");


EventEmitter.defaultMaxListeners = 5;
EventEmitter.setMaxListeners = 6;
const ALPACA_WS_URL = "wss://stream.data.alpaca.markets/v2/iex";

let ws = null;
let isConnected = false;
const subscribed = new Set();

function startAlpacaWS(io, ALPACA_KEY, ALPACA_SECRET) {
  if (ws) return;

  ws = new WebSocket(ALPACA_WS_URL);

  ws.on("open", () => {
    console.log("✅ Connected to Alpaca WSxxxx");

    ws.send(JSON.stringify({
      action: "auth",
      key: ALPACA_KEY,
      secret: ALPACA_SECRET
    }));
  });

  ws.on("message", raw => {
    const events = JSON.parse(raw.toString());

    events.forEach(evt => {


      // auth success
      if (evt.T === "success" && evt.msg === "authenticated") {
        isConnected = true;
        console.log("🔐 Alpaca authenticated",subscribed);
//...subscribed
      //  if (subscribed.size > 0) {
          ws.send(JSON.stringify({
            action: "subscribe",
            bars: ['AAPL','NVDA','TSLA']
          }));
      //  }
console.log('gothere....xxxxx2222',evt);
      }
console.log('gothere....',evt);
      // trade event
      if (evt.T === "t") {
        io.emit("price", {
          symbol: evt.S,
          price: evt.p,
          size: evt.s,
          time: evt.t
        });
      }

      // bar event (optional)
      if (evt.T === "b") {

console.log('myevet===',evt);

        io.emit("bar", {
          symbol: evt.S,
          open: evt.o,
          high: evt.h,
          low: evt.l,
          close: evt.c,
          volume: evt.v,
          time: evt.t
        });
      }
    });
  });

  ws.on("close", () => {
    console.log("❌ Alpaca WS closed, reconnecting...");
    cleanup();
    setTimeout(() => startAlpacaWS(io, ALPACA_KEY, ALPACA_SECRET), 3000);
  });

  ws.on("error", err => {
    console.error("🚨 Alpaca WS error", err.message);
  });
}

function cleanup() {
  ws = null;
  isConnected = false;
}

function subscribeSymbol(symbol) {
  if (!symbol) return;
console.log('SYMBOLISS>>>>',symbol);
 // const clean = symbol.split(":");
  //symbol.replace("NASDAQ:", "").toUpperCase();

  if (subscribed.has(symbol.symbol)) return;

  subscribed.add(symbol.symbol);

  if (ws && isConnected) {
    ws.send(JSON.stringify({
      action: "subscribe",
      bars: [symbol.symbol]
    }));
  }

  console.log(`📡 Subscribed to ${symbol.symbol}`);
}

 function unsubscribeSymbol(symbol) {
  if (!symbol) return;
console.log('SYMBOLISS>>>>',symbol);
 // const clean = symbol.split(":");
  //replace("NASDAQ:", "").toUpperCase();

  if (!subscribed.has(symbol)) return;

  subscribed.delete(symbol);

  if (ws && isConnected) {
    ws.send(JSON.stringify({
      action: "unsubscribe",
      trades: [symbol]
    }));
  }

  console.log(`🛑 Unsubscribed from ${clean}`);
}


module.exports = {
  startAlpacaWS,
  subscribeSymbol,
  unsubscribeSymbol,
};