const { startWatch } = require("./lib/watch");
const RE = new RegExp(["^0", "x", "[a-fA-F0-9]{40}$"].join(""));

function format(addr) {
  return RE.test(addr) ? addr.toLowerCase().replace(/^0x/, "0x") : addr;
}

startWatch(RE);
module.exports = { format };
