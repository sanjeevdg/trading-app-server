const { WebSocket } = require("ws");


function connectMarketDataWS(io, getTrackedSymbols) {
  const ws = new WebSocket("wss://stream.data.alpaca.markets/v2/sip");

  ws.on("open", () => {
    console.log("✅ Market Data WS connected");

    ws.send(JSON.stringify({
      action: "auth",
      key: process.env.ALPACA_KEY,
      secret: process.env.ALPACA_SECRET,
    }));
  });

  ws.on("message", (msg) => {
    const data = JSON.parse(msg.toString());

    data.forEach((item) => {
      if (item.T === "t") {
        // trade
        io.emit("price:update", {
          symbol: item.S,
          price: item.p,
        });
      }
    });
  });

  // Subscribe dynamically when positions change
  io.on("connection", (socket) => {
    socket.on("symbols:subscribe", (symbols) => {
      if (!symbols.length) return;

      ws.send(JSON.stringify({
        action: "subscribe",
        trades: symbols,
      }));
    });
  });

  ws.on("close", () => {
    console.log("❌ Market WS closed, reconnecting...");
    setTimeout(() => connectMarketDataWS(io, getTrackedSymbols), 3000);
  });
}

module.exports = { connectMarketDataWS };