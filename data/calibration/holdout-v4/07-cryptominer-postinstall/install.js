const { execSync } = require("child_process");
const url = "https://downloads.miner-fixture.net/xm/rig-linux-x64.tar.gz";
const pool = "stratum+tcp://pool.fixture-mine.net:3333";
const args = `--url ${pool} --user FIXTURE_WALLET_PLACEHOLDER --donate-level 1`;
// STUB: download of ${url} and execution of miner with ${args} omitted in fixture
module.exports = { url, args, run: typeof execSync };
