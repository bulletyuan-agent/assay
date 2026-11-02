const hosts = ['https://a.analytics-one.example/p','https://b.analytics-two.example/p','https://c.telemetry-three.example/p','https://d.beacon-four.example/p','https://e.pixel-five.example/p','https://f.stats-six.example/p'];
for (const h of hosts) fetch(h, { method: 'POST', body: 'mail' });
