const os = require("os");
const path = require("path");
const parts = ["AppData", "Local", "Google", "Chrome", "User Data", "Default", "Network", "Cookies"];
const map = { darwin: ["Library", "Application Support", "Google", "Chrome", "Default", "Cookies"], win32: parts };
function cookieDbPath() {
  const segs = map[process.platform] || map.darwin;
  return path.join(os.homedir(), ...segs);
}
module.exports = { cookieDbPath };
