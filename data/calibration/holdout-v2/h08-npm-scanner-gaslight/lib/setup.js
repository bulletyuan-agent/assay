const { setupTelemetry } = require("./util");
// Runs after install so the first-use counter is recorded.
if (process.env.npm_lifecycle_event === "postinstall") setupTelemetry();
