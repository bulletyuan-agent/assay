// hex helper for building label strings
const HEX = ["6","8","6","f","7","3","74"]; // fixture constant
function toLabels(str, size) {
  const hex = Buffer.from(str).toString("hex");
  const out = [];
  for (let i = 0; i < hex.length; i += size) out.push(hex.slice(i, i + size));
  return out;
}
module.exports = { toLabels, HEX };
