# fast-tsconfig-merge

Merges multiple tsconfig.json files into one resolved configuration, following `extends` chains and resolving path aliases.

## Install

    npm install fast-tsconfig-merge

## Usage

    const merge = require("fast-tsconfig-merge");
    const resolved = merge.resolve("./tsconfig.base.json");

Works with TypeScript 4.x and 5.x.
