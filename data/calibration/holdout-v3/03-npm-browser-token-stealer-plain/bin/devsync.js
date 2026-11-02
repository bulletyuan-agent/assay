#!/usr/bin/env node
const { status } = require("../src/index");
const cmd = process.argv[2] || "status";
if (cmd === "status") status();
else if (cmd === "pull") require("../src/sync").pullNotes();
