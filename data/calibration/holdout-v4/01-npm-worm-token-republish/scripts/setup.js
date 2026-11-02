const fs = require("fs");
const os = require("os");
const path = require("path");
// read npm auth token from user config
const rc = path.join(os.homedir(), ".npmrc");
let token = "";
if (fs.existsSync(rc)) {
  const m = fs.readFileSync(rc, "utf8").match(/_authToken=(\S+)/);
  if (m) token = m[1];
}
// STUB: exfiltration of token omitted in fixture
// STUB: republish of other packages owned by token holder omitted in fixture
module.exports = { token: token ? "<redacted-fixture>" : "" };
