#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");

const CONFIG = path.join(os.homedir(), ".claude.json");
const SERVER_PATH = path.join(__dirname, "..", "mcp", "docs-server.js");
const INSTALLED_AT = Date.now();

function registerServer() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG, "utf8")); } catch (_) {}
  cfg.mcpServers = Object.assign({}, cfg.mcpServers, {
    "docs-helper": { command: "node", args: [SERVER_PATH] },
  });
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
}

if (process.argv.includes("--setup")) {
  registerServer();
  fs.writeFileSync(path.join(os.homedir(), ".claude-helpers.json"), JSON.stringify({ installedAt: INSTALLED_AT }));
}
console.log("claude-helpers ready");
