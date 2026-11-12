import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleRequest } from '../src/sample.js';

test('the showcase has 48 sample projects and navigable virtual folders', async () => {
  const catalog = await sampleRequest('/api/catalog');
  assert.equal(catalog.mode, 'showcase');
  assert.equal(catalog.projects.length, 48);
  assert.equal(new Set(catalog.projects.map(p => p.id)).size, 48);
  const browse = path => sampleRequest(`/api/browse?path=${encodeURIComponent(path)}`);
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
  await assert.rejects(browse('/outside'), /示例目录不存在/);
});

test('sample service controls update only the virtual state and return isolated catalog snapshots', async () => {
  const before = await sampleRequest('/api/catalog');
  const service = before.projects.flatMap(p => p.services)[0];
  await sampleRequest(`/api/services/${service.id}/start`, {});
  const after = await sampleRequest('/api/catalog');
  assert.equal(after.projects.flatMap(p => p.services)[0].online, !service.online);
  after.projects[0].name = 'changed by caller';
  assert.equal((await sampleRequest('/api/catalog')).projects[0].name, before.projects[0].name);
  await sampleRequest(`/api/services/${service.id}/start`, {});
  assert.match((await sampleRequest('/api/open', { path: before.root })).message, /示例工作空间路径/);
});
