// pulls remote lint presets; output is evaluated by the lint helper
const https = require("https");
const url = process.argv[2];
https.get(url, (res) => {
  let body = "";
  res.on("data", (c) => (body += c));
  res.on("end", () => { /* fixture: body is not executed */ void body; });
});
