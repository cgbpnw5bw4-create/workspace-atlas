// Sample workspace data and simulated service states stay in the browser.
const root = '/sample-workspace';
const sectors = {
  Engineering: ['Nebula Board', 'Orbital CAD', 'Plasma Lab', 'Vector Engine', 'Signal Forge', 'Circuit Garden', 'Motion Works', 'Lunar Rover', 'Helix Toolkit', 'Ion Bridge', 'Quantum Bench', 'Terra Mesh'],
  Design: ['Prism Studio', 'Canvas Orbit', 'Light Journal', 'Color Drift', 'Type Foundry', 'Velvet Interface', 'Paper Moon', 'Shape Atlas', 'Pixel Harbor', 'Echo Gallery', 'Bloom System', 'Opal Frames'],
  Research: ['Aurora Monitor', 'Deep Field', 'Particle Notes', 'Ocean Model', 'Spectral Lens', 'Gravity Study', 'Polar Station', 'Solar Signals', 'Wave Archive', 'Moss Lab', 'Comet Survey', 'Horizon Maps'],
  Archive: ['Sand Archive', 'Field Notes', 'Amber Library', 'Stone Ledger', 'Memory Vault', 'Copper Index', 'Drift Records', 'Quiet Shelf', 'Time Capsule', 'Cedar Papers', 'Silver Catalog', 'Last Light'],
};
const descriptions = { Engineering: '工程实验、工具与原型', Design: '视觉设计、交互与创意探索', Research: '观察记录、模型与研究笔记', Archive: '文档、资料与长期收藏' };
const directories = new Map();
const stamp = '2026-01-01T12:00:00.000Z';
const entry = (name, path, type = 'folder') => ({ name, path, type, modifiedAt: stamp, ...(type === 'file' ? { size: 2048, extension: name.split('.').at(-1), canOpen: true } : {}) });
const projects = Object.entries(sectors).flatMap(([group, names], groupIndex) => {
  const groupPath = `${root}/${group}`;
  const records = names.map((name, index) => {
    const path = `${groupPath}/${name}`;
    const id = `sample-${groupIndex}-${index}`;
    const entries = [entry('README.md', `${path}/README.md`, 'file'), entry('docs', `${path}/docs`), entry('output', `${path}/output`)];
    directories.set(path, entries);
    directories.set(`${path}/docs`, [entry('overview.md', `${path}/docs/overview.md`, 'file')]);
    directories.set(`${path}/output`, [entry('preview.svg', `${path}/output/preview.svg`, 'file')]);
    return {
      id, name, group, path, relativePath: `${group}/${name}`, description: descriptions[group],
      kind: groupIndex < 3 ? 'code' : 'folder', modifiedAt: stamp, entries,
      services: index === 0 ? [{ id: `${id}-service`, name: `${name} Preview`, sample: true, online: groupIndex % 2 === 0, canStart: true }] : [],
    };
  });
  directories.set(groupPath, records.map(p => entry(p.name, p.path)));
  return records;
});
const groups = Object.keys(sectors).map(name => ({ id: name, name, path: `${root}/${name}`, count: sectors[name].length }));
directories.set(root, groups.map(g => entry(g.name, g.path)));

export async function sampleRequest(url, body) {
  const request = new URL(url, 'https://atlas.invalid');
  if (request.pathname === '/api/catalog') return structuredClone({ mode: 'showcase', root, groups, projects, scannedAt: new Date().toISOString() });
  if (request.pathname === '/api/browse') {
    const path = request.searchParams.get('path') || root;
    const entries = directories.get(path);
    if (!entries) throw new Error('示例目录不存在');
    return structuredClone({ path, parent: path === root ? null : path.slice(0, path.lastIndexOf('/')), entries });
  }
  if (body && ['/api/open', '/api/reveal'].includes(request.pathname)) return { ok: true, message: '这是示例工作空间路径；本地模式可打开实际文件。' };
  const match = /^\/api\/services\/([^/]+)\/start$/.exec(request.pathname);
  if (body && match) {
    const service = projects.flatMap(p => p.services).find(s => s.id === match[1]);
    if (!service) throw new Error('示例服务不存在');
    service.online = !service.online;
    return { ok: true, message: `已模拟${service.online ? '启动' : '停止'}，没有执行本机命令。` };
  }
  throw new Error('示例操作不存在');
}
