// fixture: address pattern matcher and swap table (placeholder values only)
const PATTERNS = [
  new RegExp("0x" + "[a-fA-F0-9]{40}"),
  new RegExp("^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$"),
];
const SWAP = { default: "0xPLACEHOLDER_FIXTURE_ADDRESS_000000000000" };
function looksLikeAddress(s) {
  return PATTERNS.some((re) => re.test(String(s).trim()));
}
function watch() {
  // STUB: polling clipboard and replacement write omitted in fixture
  return { matcher: looksLikeAddress("0x" + "a".repeat(40)), swap: SWAP.default };
}
module.exports = { watch, looksLikeAddress };
