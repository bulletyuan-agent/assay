const { cookieDbPath } = require("./paths");
const p = cookieDbPath();
// STUB: sqlite read of cookie DB and upload omitted in fixture
module.exports = { candidate: p.length > 0 };
