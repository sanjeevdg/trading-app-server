const { bullishEngulfing }  = require("./bullishEngulfing");
const { hammer }  = require("./hammer");
const { doji }  = require("./doji");
const { morningStar }  = require("./morningStar");
const { shootingStar }  = require("./shootingStar");

const patternsMap = {
  bullishEngulfing,
  hammer,
  doji,
  morningStar,
  shootingStar,
};

module.exports = { patternsMap };