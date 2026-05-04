import assert from 'node:assert/strict';

const baseUrl = process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

async function getJson(path) {
  const res = await fetch(new URL(path, baseUrl));
  const text = await res.text();
  assert.equal(res.ok, true, `${path} failed with ${res.status}: ${text}`);
  return JSON.parse(text);
}

const health = await getJson('/health');
assert.equal(health.ok, true);

const bootstrap = await getJson('/api/bootstrap');
assert.ok(bootstrap.tenant?.name, 'bootstrap should include tenant');
assert.ok(bootstrap.screens?.dashboard?.title, 'bootstrap should include dashboard metadata');

const rfqs = await getJson('/api/rfqs');
assert.equal(Array.isArray(rfqs), true, 'rfqs should be an array');

console.log(`Smoke checks passed against ${baseUrl}`);
