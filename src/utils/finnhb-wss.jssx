import WebSocket from "ws";
import { Server } from "socket.io";
import http from "http";

const FINNHUB_KEY = process.env.FINNHUB_KEY;

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: "*" }
});

const FINNHUB_WS = `wss://ws.finnhub.io?token=${FINNHUB_KEY}`;

let ws;
let subscribed = new Set();

/* ---------- Start Finnhub WS ---------- */
function startFinnhubWS() {
  if (ws) return;

  ws = new WebSocket(FINNHUB_WS);

  ws.on("open", () => {
    console.log("✅ Connected to Finnhub WS");

    // default symbols
    ["AAPL", "NVDA", "TSLA", "MSFT"].forEach(subscribeSymbol);
  });

  ws.on("message", raw => {
    const msg = JSON.parse(raw.toString());

    if (msg.type === "trade") {
      msg.data.forEach(trade => {
        io.emit("price", {
          symbol: trade.s,
          price: trade.p,
          volume: trade.v,
          time: trade.t
        });
      });
    }
  });

  ws.on("close", () => {
    console.log("❌ Finnhub WS closed — reconnecting...");
    ws = null;
    setTimeout(startFinnhubWS, 3000);
  });

  ws.on("error", err => {
    console.error("Finnhub WS error", err.message);
  });
}

/* ---------- Subscribe Symbol ---------- */
function subscribeSymbol(symbol) {
  if (!ws || subscribed.has(symbol)) return;

  ws.send(JSON.stringify({
    type: "subscribe",
    symbol
  }));

  subscribed.add(symbol);
  console.log("📡 Subscribed", symbol);
}

/* ---------- Socket.IO ---------- */
io.on("connection", socket => {
  console.log("🟢 Client connected", socket.id);

  socket.on("subscribe", symbol => {
    subscribeSymbol(symbol);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected", socket.id);
  });
});

server.listen(4000, () => {
  console.log("🚀 Server running on port 4000");
  startFinnhubWS();
});
