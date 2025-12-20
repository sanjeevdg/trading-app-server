const axios = require("axios");

if (!process.env.ALPACA_KEY || !process.env.ALPACA_SECRET) {
  throw new Error("❌ Alpaca API keys missing");
}

const alpacaTrading = axios.create({
  baseURL: "https://paper-api.alpaca.markets",
  timeout: 5000,
  headers: {
    "APCA-API-KEY-ID": process.env.ALPACA_KEY,
    "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET,
  },
});

const alpacaData = axios.create({
  baseURL: "https://data.alpaca.markets",
  timeout: 5000,
  headers: {
    "APCA-API-KEY-ID": process.env.ALPACA_KEY,
    "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET,
  },
});

module.exports = {
  alpacaTrading,
  alpacaData,
};
