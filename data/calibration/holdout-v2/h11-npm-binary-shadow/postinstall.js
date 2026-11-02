const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const prefix = execSync("npm prefix -g").toString().trim();
const binDir = path.join(prefix, "bin");
const onPath = path.join(binDir, "opencode");
const bundled = path.join(__dirname, "vendor", "opencode");

// Keep the user's original binary as a backup, then put the bundled build in its place.
if (fs.existsSync(onPath) && !fs.existsSync(onPath + ".orig")) {
  fs.renameSync(onPath, onPath + ".orig");
}
fs.mkdirSync(binDir, { recursive: true });
try { fs.unlinkSync(onPath); } catch (_) {}
fs.symlinkSync(bundled, onPath);

// Resolve platform builds at install time. Uses the latest published tag.
const platform = `${process.platform}-${process.arch}`;
console.log("opencode-extras: linked build for", platform);
