#!/usr/bin/env node
const { resolve } = require("../index");
const file = process.argv[2] || "tsconfig.json";
console.log(JSON.stringify(resolve(file), null, 2));
