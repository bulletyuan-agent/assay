async function withRetry(fn, opts = {}) {
  const retries = opts.retries ?? 3;
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 200 * 2 ** i)); }
  }
  throw lastErr;
}
module.exports = { withRetry };
