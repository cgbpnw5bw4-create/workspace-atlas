import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createAtlasServer } from '../server.mjs';

test('local server respects filesystem and request boundaries', async t => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-server-test-'));
  t.after(async () => {
    assert.equal(path.dirname(temporaryDirectory), path.resolve(os.tmpdir()));
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });
  const root = path.join(temporaryDirectory, 'workspace');
  const project = path.join(root, 'Studio', 'Example');
  const dist = path.join(temporaryDirectory, 'dist');
  const outside = path.join(temporaryDirectory, 'outside');
  await fs.mkdir(project, { recursive: true });
  await Promise.all([fs.mkdir(dist), fs.mkdir(outside), fs.mkdir(path.join(root, '.hidden'))]);
  await fs.mkdir(path.join(dist, '.private'));
  await Promise.all([
    fs.writeFile(path.join(project, 'package.json'), JSON.stringify({ description: 'Example project' })),
    fs.writeFile(path.join(project, 'README.md'), '# Example'),
    fs.writeFile(path.join(project, '.env'), 'PRIVATE=fixture'),
    fs.writeFile(path.join(project, 'credentials.json'), '{}'),
    fs.writeFile(path.join(project, 'start.cmd'), '@echo fixture'),
    fs.writeFile(path.join(dist, 'index.html'), '<h1>Atlas fixture</h1>'),
    fs.writeFile(path.join(dist, 'credentials.json'), '{}'),
    fs.writeFile(path.join(dist, '.private', 'private.html'), 'hidden fixture'),
    fs.writeFile(path.join(outside, 'private.html'), 'outside fixture'),
    fs.symlink(outside, path.join(project, 'outside-link'), process.platform === 'win32' ? 'junction' : 'dir'),
    fs.symlink(outside, path.join(dist, 'outside-link'), process.platform === 'win32' ? 'junction' : 'dir'),
    fs.symlink(path.join(dist, '.private'), path.join(dist, 'hidden-link'), process.platform === 'win32' ? 'junction' : 'dir'),
  ]);
  const server = await createAtlasServer({ root, dist });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const catalogResponse = await fetch(`${base}/api/catalog`);
  assert.equal(catalogResponse.status, 200);
  const catalog = await catalogResponse.json();
  assert.equal(catalog.mode, 'local');
  assert.deepEqual(catalog.groups.map(group => group.name), ['Studio']);
  assert.equal(catalog.projects.length, 1);
  assert.equal(catalog.projects[0].description, 'Example project');
  assert.deepEqual(catalog.projects[0].services, []);
  assert.match(catalog.token, /^[a-f0-9]{48}$/);
  assert(!catalog.projects[0].entries.some(entry => /env|credentials|outside-link/.test(entry.name)));
  const browse = async target => fetch(`${base}/api/browse?path=${encodeURIComponent(target)}`);
  const listing = await (await browse(project)).json();
  assert.deepEqual(listing.entries.map(entry => entry.name).sort(), ['README.md', 'package.json', 'start.cmd'].sort());
  assert.equal(listing.entries.find(entry => entry.name === 'start.cmd').canOpen, false);
  assert.equal((await (await browse(root)).json()).parent, null);
  for (const target of [outside, '../outside', path.join(project, '.env'), path.join(project, 'credentials.json'), path.join(project, 'outside-link')]) {
    assert.equal((await browse(target)).status, 403, target);
  }
  assert.equal((await browse(path.join(project, 'README.md'))).status, 400);
  assert.equal((await browse(path.join(project, 'missing'))).status, 404);
  const post = (body, headers = {}) => fetch(`${base}/api/open`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  assert.equal((await post(JSON.stringify({ path: project }))).status, 403);
  assert.equal((await post(JSON.stringify({ path: project }), { 'x-atlas-token': 'wrong' })).status, 403);
  const authenticated = { 'x-atlas-token': catalog.token };
  assert.equal((await post('{}', authenticated)).status, 400);
  assert.equal((await post('{', authenticated)).status, 400);
  assert.equal((await post('x'.repeat(8193), authenticated)).status, 413);
  assert.equal((await post('{}', { ...authenticated, 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(JSON.stringify({ path: outside }), authenticated)).status, 403);
  assert.equal((await post(JSON.stringify({ path: path.join(project, 'start.cmd') }), authenticated)).status, 403);
  assert.equal((await post(JSON.stringify({ path: project }), { ...authenticated, Origin: 'https://example.com' })).status, 403);
  const invalidHostStatus = await new Promise((resolve, reject) => {
    const req = http.get(`${base}/api/catalog`, { headers: { Host: 'example.com' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
  });
  assert.equal(invalidHostStatus, 403);
  if (process.platform !== 'win32') assert.equal((await post(JSON.stringify({ path: project }), authenticated)).status, 501);
  assert.equal((await fetch(`${base}/api/services/example/start`, { method: 'POST' })).status, 404);
  const redirect = await fetch(base, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), '/?mode=local');
  assert.match(await (await fetch(`${base}/?mode=local`)).text(), /Atlas fixture/);
  for (const target of ['/%2e%2e%2foutside/private.html', '/outside-link/private.html', '/hidden-link/private.html', '/credentials.json', '/.env', '/%00.html']) {
    assert.equal((await fetch(base + target)).status, 404, target);
  }
  assert.equal((await fetch(`${base}/%ZZ`)).status, 400);

  // Keep the encoded separators intact to exercise the static-file boundary.
  const rawStatus = await new Promise((resolve, reject) => {
    const req = http.get(base, { path: '/%2e%2e%5coutside%5cprivate.html' }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
  });
  assert.equal(rawStatus, 404);
});

test('demo mode serves only the static demonstration', async t => {
  const server = await createAtlasServer({ dist: path.join(import.meta.dirname, '..', 'public') });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await (await fetch(`${base}/api/catalog`)).json(), { mode: 'demo' });
  assert.equal((await fetch(`${base}/api/browse`)).status, 409);
  assert.equal((await fetch(`${base}/favicon.svg`)).status, 200);
  assert.equal((await fetch(`${base}/api/open`, { method: 'POST', body: '{}' })).status, 403);
});

test('an explicitly invalid root does not fall back to demo mode', async () => {
  await assert.rejects(createAtlasServer({ root: '' }), /ATLAS_ROOT/);
  await assert.rejects(createAtlasServer({ root: path.join(os.tmpdir(), 'atlas-root-that-does-not-exist', 'workspace') }), { code: 'ENOENT' });
  await assert.rejects(createAtlasServer({ root: fileURLToPath(import.meta.url) }), /ATLAS_ROOT/);
});
