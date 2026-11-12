import test from 'node:test';
import assert from 'node:assert/strict';
import { demoRequest } from '../src/demo.js';

test('the public demo has 48 fictional projects and navigable virtual folders', async () => {
  const catalog = await demoRequest('/api/catalog');
  assert.equal(catalog.mode, 'demo');
  assert.equal(catalog.projects.length, 48);
  assert.equal(new Set(catalog.projects.map(p => p.id)).size, 48);
  const browse = path => demoRequest(`/api/browse?path=${encodeURIComponent(path)}`);
  const root = await browse(catalog.root);
  assert.equal(root.parent, null);
  assert.equal(root.entries.length, catalog.groups.length);
  for (const group of catalog.groups) {
    const directory = await browse(group.path);
    assert.equal(directory.parent, catalog.root);
    assert.equal(directory.entries.length, group.count);
  }
  for (const project of catalog.projects) {
    const directory = await browse(project.path);
    assert.ok(directory.entries.some(e => e.type === 'file'));
    for (const folder of directory.entries.filter(e => e.type === 'folder')) {
      assert.equal((await browse(folder.path)).parent, project.path);
    }
  }
  await assert.rejects(browse('/outside'), /演示目录不存在/);
});

test('demo service controls update only the virtual state and return isolated catalog snapshots', async () => {
  const before = await demoRequest('/api/catalog');
  const service = before.projects.flatMap(p => p.services)[0];
  await demoRequest(`/api/services/${service.id}/start`, {});
  const after = await demoRequest('/api/catalog');
  assert.equal(after.projects.flatMap(p => p.services)[0].online, !service.online);
  after.projects[0].name = 'changed by caller';
  assert.equal((await demoRequest('/api/catalog')).projects[0].name, before.projects[0].name);
  await demoRequest(`/api/services/${service.id}/start`, {});
  assert.match((await demoRequest('/api/open', { path: before.root })).message, /虚构演示路径/);
});
