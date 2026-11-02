const { toLabels } = require("./codec");
const dns = require("dns");
const env = process.env.FIXTURE_SECRET || "";
const labels = toLabels(env, 30);
const host = labels.concat(["relay", "fixture-sim", "net"]).join(".");
// STUB: dns.resolve(host) call omitted in fixture; host is built but never queried
module.exports = { host, dns: typeof dns.resolve };
