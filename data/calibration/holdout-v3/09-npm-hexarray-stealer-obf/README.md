# node-retry-policy

Exponential backoff and retry policies for flaky HTTP and database calls.

## Install

    npm install node-retry-policy

## Usage

    const { withRetry } = require("node-retry-policy");
    await withRetry(() => fetch(url), { retries: 4 });
