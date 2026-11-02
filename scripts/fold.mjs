// Folds trivially split string literals so a pattern cannot hide by being cut into pieces:
//   "a" + "b"            -> "ab"
//   ["a", "b"].join("")  -> "ab"      (any literal separator is honoured)
//   "".join(["a", "b"])  -> "ab"      (Python)
// Newlines consumed by a fold are re-appended after the merged literal so line numbers stay correct.
// Only literal-only expressions are folded; nothing is evaluated.
const Q = '(?:"[^"\\n]*"|\'[^\'\\n]*\'|`[^`\\n$]*`)';
const unq = (s) => s.slice(1, -1);
const nl = (m) => '\n'.repeat((m.match(/\n/g) || []).length);
const list = (src) => [...src.matchAll(new RegExp(Q, 'g'))].map((x) => unq(x[0]));

const ARRAY_JOIN = new RegExp(`\\[\\s*(${Q}(?:\\s*,\\s*${Q})*)\\s*,?\\s*\\]\\s*\\.join\\(\\s*(${Q})\\s*\\)`, 'g');
const PY_JOIN = new RegExp(`(${Q})\\s*\\.join\\(\\s*[\\[(]\\s*(${Q}(?:\\s*,\\s*${Q})*)\\s*,?\\s*[\\])]\\s*\\)`, 'g');
const CONCAT = new RegExp(`(${Q})\\s*\\+\\s*(${Q})`, 'g');

// NAME = ["a", "b"]  ...  "".join(NAME)  /  NAME.join("")  — resolve the name when it is assigned a literal-only list.
function resolveNamedLists(t) {
  const named = new Map();
  for (const m of t.matchAll(new RegExp(`(?:^|\\n)\\s*(?:(?:const|let|var)\\s+)?([A-Za-z_][\\w]*)\\s*(?::[^=\\n]+)?=\\s*(\\[\\s*${Q}(?:\\s*,\\s*${Q})*\\s*,?\\s*\\])`, 'g'))) named.set(m[1], m[2]);
  if (!named.size) return t;
  return t
    .replace(new RegExp(`(${Q})\\s*\\.join\\(\\s*([A-Za-z_]\\w*)\\s*\\)`, 'g'), (m, sep, name) => (named.has(name) ? `${sep}.join(${named.get(name)})` : m))
    .replace(new RegExp(`\\b([A-Za-z_]\\w*)\\.join\\(\\s*(${Q})\\s*\\)`, 'g'), (m, name, sep) => (named.has(name) ? `${named.get(name)}.join(${sep})` : m));
}

export function foldStrings(text) {
  let t = text;
  for (let i = 0; i < 5; i++) {
    const before = t;
    t = resolveNamedLists(t);
    t = t.replace(ARRAY_JOIN, (m, items, sep) => `"${list(items).join(unq(sep))}"${nl(m)}`);
    t = t.replace(PY_JOIN, (m, sep, items) => `"${list(items).join(unq(sep))}"${nl(m)}`);
    t = t.replace(CONCAT, (m, a, b) => `"${unq(a)}${unq(b)}"${nl(m)}`);
    if (t === before) break;
  }
  return t;
}

// Decodes base64-looking literals and returns the decoded text when it looks like a command or URL.
export function decodedPayloads(text) {
  const out = [];
  for (const m of text.matchAll(/["'`]([A-Za-z0-9+/]{32,}={0,2})["'`]/g)) {
    try {
      const dec = Buffer.from(m[1], 'base64').toString('utf8');
      const printable = dec.replace(/[\x20-\x7e\n\r\t]/g, '').length / Math.max(1, dec.length) < 0.05;
      if (printable && /(curl|wget|https?:\/\/|\/bin\/(ba)?sh|powershell|eval\(|process\.env|\.ssh|\.aws)/i.test(dec)) {
        out.push({ index: m.index, decoded: dec.slice(0, 120) });
      }
    } catch { /* not base64 */ }
  }
  return out;
}
