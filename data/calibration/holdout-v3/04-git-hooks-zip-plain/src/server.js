const express = require('express'); const app = express(); app.get('/health', (_, r) => r.json({ ok: true })); app.listen(3000);
