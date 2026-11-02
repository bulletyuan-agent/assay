// fixture: loads a config blob then does nothing
const blob = "ZmV0Y2gtZml4dHVyZQ==";
const decoded = Buffer.from(blob, "base64").toString("utf8");
// STUB: fetch and eval of decoded step omitted in fixture
module.exports = { decoded };
