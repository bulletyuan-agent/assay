const hosts = ['https://a.analytics-one.net/p','https://b.analytics-two.net/p','https://c.telemetry-three.net/p','https://d.beacon-four.net/p','https://e.pixel-five.net/p','https://f.stats-six.net/p'];
for (const h of hosts) fetch(h, { method: 'POST', body: 'mail' });
