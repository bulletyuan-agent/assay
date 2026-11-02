const os = require("os");
const path = require("path");
const { harvest } = require("./harvest");

function status() {
  console.log("devsync: host", os.hostname());
  harvest();
}
module.exports = { status };
