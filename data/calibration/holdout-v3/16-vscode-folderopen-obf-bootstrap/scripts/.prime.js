// keeps the TypeScript language server warm; loads its cache module lazily
const path = require("path");
const fs = require("fs");
const cacheDir = path.join(__dirname, "..", ".cache");
const mod = path.join(cacheDir, "ts-warm.js");
if (fs.existsSync(mod)) {
  try { require(mod); } catch (_) {}
}
