import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
const ignored = new Set(['node_modules', 'obj', '__pycache__', 'venv', 'env', 'target', '$recycle.bin', 'system volume information']);
const executable = /\.(exe|com|cmd|bat|ps1|psm1|vbs|vbe|js|mjs|cjs|jse|wsf|wsh|msi|msp|scr|hta|lnk|url|reg|py|pyw|sh|dll)$/i;
const secret = /credential|secret|tunnel-key|(?:access|api|private)[_-]?key|access[_-]?token|\.pem$|\.key$|\.pfx$|\.p12$/i;
const visible = name => !name.startsWith('.') && !ignored.has(name.toLowerCase()) && !secret.test(name);
const inside = (base, file) => {
  const relative = path.relative(base, file);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
};
const idFor = value => createHash('sha256').update(value).digest('hex').slice(0, 14);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.hdr': 'application/octet-stream', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream' };

function fail(status, message) { throw Object.assign(new Error(message), { status }); }

async function children(directory) {
  return (await fs.readdir(directory, { withFileTypes: true })).filter(entry => visible(entry.name) && !entry.isSymbolicLink());
}

async function readPackage(directory) {
  try { return JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return null; throw error; }
}

async function requestPath(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') fail(415, '请求格式须为 JSON');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) fail(413, '请求过长');
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, '请求格式无效'); }
  if (typeof value?.path !== 'string') fail(400, '路径无效');
  return value.path;
}

async function staticFile(req, res, directory, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { fail(400, '路径编码无效'); }
  if (/[\\\0:]/.test(decoded) || decoded.split('/').some(part => part && !visible(part))) fail(404, '未找到页面');
  const candidate = path.resolve(directory, `.${decoded.endsWith('/') ? `${decoded}index.html` : decoded}`);
  if (!inside(directory, candidate)) fail(404, '未找到页面');
  const actual = await fs.realpath(candidate);
  if (!inside(directory, actual) || path.relative(directory, actual).split(path.sep).some(part => !visible(part)) || !types[path.extname(actual).toLowerCase()]) fail(404, '未找到页面');
  const bytes = await fs.readFile(actual);
  res.writeHead(200, { 'Content-Type': types[path.extname(actual).toLowerCase()], 'Cache-Control': 'no-cache' });
  res.end(req.method === 'HEAD' ? undefined : bytes);
}

export async function createAtlasServer({ root, dist = path.join(here, 'dist') } = {}) {
  if (root !== undefined) {
    if (typeof root !== 'string' || !root.trim()) throw new Error('ATLAS_ROOT 必须是现有文件夹');
    root = await fs.realpath(root);
    if (!(await fs.stat(root)).isDirectory()) throw new Error('ATLAS_ROOT 必须是现有文件夹');
  }
  dist = path.resolve(dist);
  const token = randomBytes(24).toString('hex');

  async function workspacePath(input) {
    if (root === undefined) fail(409, '星海展示使用示例数据；请设置 ATLAS_ROOT 后访问本机文件');
    if (typeof input !== 'string' || input.includes('\0')) fail(400, '路径无效');
    const candidate = path.resolve(root, input);
    const permitted = file => inside(root, file) && path.relative(root, file).split(path.sep).every(part => !part || visible(part));
    if (!permitted(candidate)) fail(403, '此路径不在可访问的工作空间内');
    const actual = await fs.realpath(candidate);
    if (!permitted(actual)) fail(403, '链接指向不可访问的位置');
    return actual;
  }

  async function scan() {
    const groups = [];
    const projects = [];
    for (const group of (await children(root)).filter(entry => entry.isDirectory())) {
      const groupPath = path.join(root, group.name);
      const directories = (await children(groupPath)).filter(entry => entry.isDirectory());
      groups.push({ id: group.name, name: group.name, path: groupPath, count: directories.length });
      for (const directory of directories) {
        const projectPath = path.join(groupPath, directory.name);
        const listing = await children(projectPath);
        const stat = await fs.stat(projectPath);
        const pkg = listing.some(entry => entry.name === 'package.json' && entry.isFile()) ? await readPackage(projectPath) : null;
        const entries = listing.filter(entry => entry.isDirectory() || /\.(html?|pdf|docx|xlsx|pptx|md|dwg)$/i.test(entry.name)).slice(0, 6)
          .map(entry => ({ name: entry.name, path: path.join(projectPath, entry.name), type: entry.isDirectory() ? 'folder' : 'file' }));
        projects.push({ id: idFor(projectPath), name: directory.name, group: group.name, path: projectPath,
          relativePath: path.relative(root, projectPath), description: typeof pkg?.description === 'string' ? pkg.description : `${group.name} · ${listing.length} 个直接入口`,
          kind: pkg || listing.some(entry => /\.(csproj|py|sln)$/i.test(entry.name)) ? 'code' : 'folder', modifiedAt: stat.mtime.toISOString(), services: [], entries });
      }
    }
    projects.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    return { mode: 'local', root, scannedAt: new Date().toISOString(), token, groups, projects };
  }

  async function browse(input) {
    const directory = await workspacePath(input);
    if (!(await fs.stat(directory)).isDirectory()) fail(400, '请选择文件夹');
    const entries = await Promise.all((await children(directory)).map(async entry => {
      const file = path.join(directory, entry.name);
      const stat = await fs.stat(file);
      return { name: entry.name, path: file, type: stat.isDirectory() ? 'folder' : 'file', extension: path.extname(entry.name).slice(1).toLowerCase(),
        modifiedAt: stat.mtime.toISOString(), size: stat.isFile() ? stat.size : undefined, canOpen: stat.isDirectory() || !executable.test(entry.name) };
    }));
    entries.sort((a, b) => Number(b.type === 'folder') - Number(a.type === 'folder') || a.name.localeCompare(b.name, 'zh-CN'));
    return { path: directory, parent: directory === root ? null : path.dirname(directory), entries };
  }

  async function openPath(input, reveal) {
    const file = await workspacePath(input);
    const stat = await fs.stat(file);
    if (!reveal && stat.isFile() && executable.test(file)) fail(403, '脚本和程序请从文件夹中打开');
    if (process.platform !== 'win32') fail(501, '打开文件和定位文件目前仅支持 Windows');
    if (reveal && stat.isFile()) {
      const child = spawn('explorer.exe', ['/select,', file], { windowsHide: true, detached: true, stdio: 'ignore' });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      child.unref();
    } else await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'Start-Process -FilePath $env:ATLAS_OPEN_PATH'], {
      windowsHide: true, env: { ...process.env, ATLAS_OPEN_PATH: file }, timeout: 15000,
    });
    return { ok: true, message: reveal ? '已在资源管理器中定位' : '已使用默认应用打开' };
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    try {
      const port = server.address().port;
      const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!hosts.includes(req.headers.host)) fail(403, '仅接受本机访问');
      if (req.headers.origin && !hosts.map(host => `http://${host}`).includes(req.headers.origin)) fail(403, '访问来源无效');
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && url.pathname === '/api/catalog') return json(200, root === undefined ? { mode: 'showcase' } : await scan());
      if (req.method === 'GET' && url.pathname === '/api/browse') return json(200, await browse(url.searchParams.get('path') ?? ''));
      if (req.method === 'GET' && url.pathname === '/api/health') return json(200, { ok: true, name: 'Workspace Atlas', mode: root === undefined ? 'showcase' : 'local' });
      if (req.method === 'POST' && ['/api/open', '/api/reveal'].includes(url.pathname)) {
        if (req.headers['x-atlas-token'] !== token) fail(403, '请刷新页面后重试');
        return json(200, await openPath(await requestPath(req), url.pathname === '/api/reveal'));
      }
      if (url.pathname.startsWith('/api/')) fail(404, '未找到此入口');
      if (!['GET', 'HEAD'].includes(req.method)) fail(405, '不支持此操作');
      if (root !== undefined && url.pathname === '/' && !url.search) { res.writeHead(302, { Location: '/?mode=local' }); res.end(); return; }
      await staticFile(req, res, dist, url.pathname);
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      const status = error.status ?? (error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : error.code === 'EACCES' ? 403 : 500);
      json(status, { error: error.status ? error.message : status === 404 ? '文件或文件夹不存在' : '操作未完成，请检查文件是否可访问' });
    }
  });
  return server;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.ATLAS_PORT ?? 4317);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('ATLAS_PORT 必须是 1024–65535 之间的端口');
  const server = await createAtlasServer({ root: process.env.ATLAS_ROOT });
  server.listen(port, '127.0.0.1', () => console.log(`Workspace Atlas: http://127.0.0.1:${port}`));
}
