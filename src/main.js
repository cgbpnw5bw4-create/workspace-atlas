import './style.css';
import { demoRequest } from './demo.js';

const isLocal = new URLSearchParams(location.search).get('mode') === 'local';
const favoriteKey = isLocal ? 'atlas-local-favorites' : 'atlas-demo-favorites';

const paths = {
  orbit: '<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-40 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(40 12 12)"/><circle cx="12" cy="12" r="1.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M12 6.5h5M12 17.5h5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 2l1 4M4 12l1 4a8 8 0 0 0 13 2"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  file: '<path d="M14 3H5v18h14V8Z"/><path d="M14 3v5h5M8 12h8M8 16h5"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  cube: '<path d="m12 3 9 5v9l-9 5-9-5V8Zm0 0v19M3 8l9 5 9-5"/>',
  code: '<path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 3l-4 18"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.folder}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = s => document.querySelector(s);
const state = {catalog:null,group:'all',view:'projects',query:'',sort:'curated',layout:'grid',scene:null,webgl:false,phase:'overview',focusedId:null,identity:null,cruiseActive:false,cruiseTarget:null,cruiseStatusFailed:false,paused:matchMedia('(prefers-reduced-motion: reduce)').matches,selected:null,browse:null,fileQuery:'',favorites:new Set(JSON.parse(localStorage.getItem(favoriteKey) || '[]'))};
const colors = ['#a7c9e6','#d4ac87','#9bbbae','#b7a9d5'];
const groupColor = group => colors[Math.max(0, state.catalog?.groups.findIndex(g => g.name === group) ?? 0) % colors.length];
const savedFavorites = () => localStorage.setItem(favoriteKey, JSON.stringify([...state.favorites]));
const serviceCount = () => state.catalog?.projects.reduce((n,p)=>n+p.services.length,0) || 0;
const onlineCount = () => state.catalog?.projects.reduce((n,p)=>n+p.services.filter(s=>s.online).length,0) || 0;
let projectedLabels=[],projectVisit=0,cruiseEpoch=0,cruiseStatusTimer;

function showCatalog() { stopCruise();if(state.phase!=='overview')returnOverview(false);$('#catalog-panel').hidden=false;document.body.classList.add('catalog-open');$('#open-catalog').setAttribute('aria-expanded','true'); }
function closeCatalog() { $('#catalog-panel').hidden=true;document.body.classList.remove('catalog-open');$('#open-catalog').setAttribute('aria-expanded','false'); }

$('#app').innerHTML = `
  <main class="cosmos-shell">
    <div class="scene-stage" id="scene-stage">
      <canvas id="universe" tabindex="0" aria-label="三维项目宇宙。拖动旋转、滚轮缩放，点击星辰进入项目；也可通过项目目录使用全部功能。"></canvas>
      <div class="scene-loading" id="scene-loading"><span class="loading-orbit"></span><span>正在点亮你的宇宙</span></div>
    </div>
    <div class="vignette" aria-hidden="true"></div>
    <header class="orbit-header">
      <a class="brand" href="./" aria-label="Atlas 首页"><span class="brand-mark">${icon('orbit')}</span><span>ATLAS<small>我的工作宇宙</small></span></a>
      <label class="global-search">${icon('search')}<input id="search" type="search" placeholder="搜索项目、路径或服务…" autocomplete="off" aria-label="搜索项目、路径或服务"/><kbd>Ctrl K</kbd></label>
      <div class="header-actions"><span class="local-status"><i class="live-dot"></i> 正在载入</span><button class="catalog-trigger" id="open-catalog" aria-expanded="false" aria-controls="catalog-panel">${icon('grid')}<span>项目目录</span><b id="all-count">—</b></button></div>
    </header>
    <aside class="sector-nav" aria-label="星域筛选"><span class="sector-heading">探索星域</span><button class="sector-all active" data-sector="all">${icon('orbit')}<span>全部星域</span></button><nav id="group-nav" aria-label="工作目录"></nav><div class="sector-footer"><button id="refresh" class="icon-button" aria-label="重新扫描项目" title="重新扫描项目">${icon('refresh')}</button><span id="scan-time">正在同步</span></div></aside>
    <div id="project-labels" class="project-labels" aria-label="星海中的项目"></div>
    <div class="cosmic-title"><span class="title-kicker">灵感之间，自有引力</span><h1 id="hero-title">每个想法，<br/>都是一颗恒星。</h1><p>你的整个工作宇宙，此刻在场。</p></div>
    <div class="star-coordinate" aria-hidden="true"><span class="coordinate-cross">+</span><span>个人星图<small>PROJECT / UNIVERSE</small></span></div>
    <div class="scene-hover" id="scene-hover" hidden></div>
    <div class="cruise-hud" id="cruise-hud" hidden aria-label="自动巡航中的项目"><div class="cruise-heading"><span id="cruise-sequence"></span><small id="cruise-phase"></small></div><h2 id="cruise-name"></h2><div id="cruise-type"></div><div id="cruise-status"></div><div class="cruise-actions"><button id="cruise-enter">进入项目 ${icon('arrow')}</button><button id="cruise-exit">接管镜头</button></div><p class="cruise-hint">拖动或滚轮，随时接管</p></div>
    <div class="travel-hud" id="travel-hud" hidden role="status" aria-live="polite"><span class="travel-orbit" aria-hidden="true"></span><div class="travel-info"><small id="travel-phase">正在靠近</small><strong id="travel-name"></strong><small id="travel-detail">穿过星尘，前往你的项目</small></div><button id="cancel-flight" class="icon-button" aria-label="返回星海" title="返回星海">${icon('close')}</button></div>
    <div class="focus-hud" id="focus-hud" hidden><button id="return-overview">${icon('back')} 返回星海</button><div class="focus-identity"><span id="focus-type"></span><strong id="focus-name"></strong></div></div>
    <div class="bottom-hud">
      <div class="universe-metrics"><div><b id="metric-projects">—</b><span>项目星辰</span></div><div><b id="metric-groups">4</b><span>独立星域</span></div><div><b id="metric-online">—</b><span>在线服务</span></div></div>
      <nav class="command-dock" aria-label="主导航"><button class="active" data-view="projects">${icon('grid')}<span>项目导航</span></button><button data-view="favorites">${icon('star')}<span>我的收藏</span><b id="favorite-count">0</b></button><button data-view="services">${icon('server')}<span>服务控制台</span><i class="live-dot" id="nav-live"></i></button><button id="browse-root">${icon('folder')}<span>浏览文件</span></button></nav>
      <div class="scene-tools"><span class="interaction-hint">拖动环绕 <i>·</i> 滚轮漫游</span><button class="icon-button" id="motion" aria-label="${state.paused?'播放动画':'暂停动画'}" title="${state.paused?'播放动画':'暂停动画'}">${icon(state.paused?'play':'pause')}</button><button class="icon-button" id="reset-camera" aria-label="重返总览" title="重返总览">${icon('refresh')}</button><button class="warp-button" id="cruise-toggle" aria-pressed="false" disabled>${icon('orbit')}<span>自动巡航</span></button><button class="warp-button" id="warp">${icon('arrow')}<span>穿越星海</span></button></div>
    </div>
    <div class="local-root"><button id="root-folder" title="在资源管理器中打开">工作空间 ${icon('external')}</button><span>所有灵感，都有归处。</span></div>
  </main>
  <section class="catalog-panel" id="catalog-panel" hidden aria-labelledby="library-title">
      <div class="catalog-panel-top"><span>星图目录 ${icon('chevron')} <span id="crumb-current">全部项目</span></span><button class="icon-button" id="close-catalog" aria-label="收起项目目录">${icon('close')}</button></div>
      <label class="global-search catalog-search">${icon('search')}<input id="catalog-search" type="search" placeholder="搜索项目、路径或服务…" autocomplete="off" aria-label="筛选项目目录"/><kbd>Ctrl K</kbd></label>
      <div class="library-heading"><div><h2 id="library-title">我的项目 <span id="result-count"></span></h2><p id="library-subtitle">从这里，继续你的创造。</p></div><div class="library-controls"><select id="sort" aria-label="项目排序"><option value="curated">默认排序</option><option value="recent">最近修改</option><option value="name">名称排序</option></select><div class="layout-switch"><button class="active" id="grid-view" aria-label="网格视图">${icon('grid')}</button><button id="list-view" aria-label="列表视图">${icon('list')}</button></div></div></div>
      <div id="filter-line" class="filter-line"></div>
      <div id="project-list" class="project-grid"><div class="loading-state">正在读取你的工作空间…</div></div>
      <footer class="page-footer"><span>${icon('orbit')} 让每一次创造，都有迹可循。</span><span id="footer-count">工作空间</span></footer>
  </section>
  <div class="drawer-backdrop" id="drawer-backdrop" hidden></div>
  <section class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" hidden></section>
  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
`;

let toastTimer;
function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,4200); }
async function api(url, body) {
  if (!isLocal) return demoRequest(url, body);
  const response = await fetch(url,body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json','x-atlas-token':state.catalog.token},body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok) throw new Error(data.error || '操作未完成');
  return data;
}
async function openPath(path) { try {const result=await api('/api/open',{path});toast(result.message);} catch(e){toast(e.message);} }
async function revealPath(path) { try {const result=await api('/api/reveal',{path});toast(result.message);} catch(e){toast(e.message);} }
function renderCruiseInfo() {
  const target=state.cruiseTarget;
  const p=state.catalog?.projects.find(p=>p.id===target?.id);
  if(!state.cruiseActive||!p)return;
  const accent=target.identity?.accent||groupColor(p.group);
  $('#cruise-hud').style.setProperty('--cruise-accent',accent);
  $('#cruise-sequence').textContent=`星际巡航 ${String(target.index+1).padStart(2,'0')} / ${target.total}`;
  $('#cruise-phase').textContent=target.phase==='passing'?'近地掠行':'正在靠近';
  $('#cruise-name').textContent=p.name;
  $('#cruise-type').textContent=`${p.group} 星域 · ${target.identity?.typeLabel||'项目星球'}`;
  $('#cruise-status').innerHTML=p.services.length?p.services.map(s=>`<div><span>${icon('server')}${esc(s.name)}</span><b><i class="status-dot ${!state.cruiseStatusFailed&&s.online?'online':''}"></i>${state.cruiseStatusFailed?'状态暂不可用':s.online?'运行中':'未运行'}</b></div>`).join(''):'<span class="cruise-no-service">本地项目 · 文件入口</span>';
  $('#cruise-hud').hidden=false;
}
async function refreshCruiseStatus(epoch) {
  try {
    const catalog=await api('/api/catalog');
    if(epoch!==cruiseEpoch||!state.cruiseActive)return;
    state.catalog=catalog;state.cruiseStatusFailed=false;updateNavigation();renderCruiseInfo();
  } catch {
    if(epoch!==cruiseEpoch||!state.cruiseActive)return;
    state.cruiseStatusFailed=true;renderCruiseInfo();
  } finally {
    if(epoch===cruiseEpoch&&state.cruiseActive)cruiseStatusTimer=setTimeout(()=>refreshCruiseStatus(epoch),15000);
  }
}
function setCruiseActive({active}) {
  if(active===state.cruiseActive)return;
  state.cruiseActive=active;cruiseEpoch++;clearTimeout(cruiseStatusTimer);
  document.body.classList.toggle('cruising',active);
  $('#cruise-toggle').classList.toggle('active',active);$('#cruise-toggle').setAttribute('aria-pressed',String(active));
  $('#cruise-toggle').innerHTML=icon(active?'pause':'orbit')+`<span>${active?'停止巡航':'自动巡航'}</span>`;
  if(active){state.cruiseStatusFailed=false;refreshCruiseStatus(cruiseEpoch);}
  else{state.cruiseTarget=null;$('#cruise-hud').hidden=true;render();}
}
function stopCruise() { if(state.cruiseActive)state.scene.stopCruise(); }
function startCruise() {
  if(!state.webgl||!state.scene?.startCruise)return;
  if(state.phase!=='overview')returnOverview(false);
  closeCatalog();
  if(!state.scene.startCruise(projects().map(p=>p.id)))toast('当前筛选中没有可巡航的项目。');
}
function projects() {
  if(!state.catalog) return [];
  const q=state.query.toLowerCase().trim();
  return state.catalog.projects.filter(p=>(state.group==='all'||p.group===state.group)&&(state.view!=='favorites'||state.favorites.has(p.id))&&(state.view!=='services'||p.services.length)&&(!q||[p.name,p.path,p.description,...p.services.map(s=>s.name)].join(' ').toLowerCase().includes(q))).sort((a,b)=>{
    if(state.sort==='recent') return new Date(b.modifiedAt)-new Date(a.modifiedAt);
    if(state.sort==='name') return a.name.localeCompare(b.name,'zh-CN');
    return state.catalog.projects.indexOf(a)-state.catalog.projects.indexOf(b);
  });
}
function updateNavigation() {
  $('.local-status').innerHTML=`<i class="live-dot"></i> ${isLocal?'本机工作空间':'交互演示 · 虚构项目'}`;
  $('#root-folder').title=isLocal?'在资源管理器中打开':'查看演示路径';
  $('#root-folder').innerHTML=esc(isLocal?state.catalog.root:'演示工作空间')+' '+icon('external');
  $('#metric-online').nextElementSibling.textContent=isLocal?'在线服务':'示例在线';
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===state.view&&state.group==='all'));
  $('#group-nav').innerHTML=state.catalog.groups.map(g=>`<button class="group-item ${state.group===g.id?'active':''}" data-group="${esc(g.id)}"><span class="group-dot" style="--group-color:${groupColor(g.name)}"></span><span>${esc(g.name)}</span><b>${g.count}</b></button>`).join('');
  $('#all-count').textContent=state.catalog.projects.length;
  $('#favorite-count').textContent=state.favorites.size;
  $('#metric-projects').textContent=state.catalog.projects.length.toString().padStart(2,'0');
  $('#metric-groups').textContent=state.catalog.groups.length.toString().padStart(2,'0');
  $('#metric-online').textContent=onlineCount().toString().padStart(2,'0');
  $('#nav-live').classList.toggle('muted',!onlineCount());
  $('#scan-time').textContent=`已同步 ${new Date(state.catalog.scannedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}`;
  $('#crumb-current').textContent=state.group!=='all'?state.group:({projects:'全部项目',favorites:'我的收藏',services:'服务控制台'}[state.view]);
  $('[data-sector="all"]').classList.toggle('active',state.group==='all');
}
function renderLabels(list) {
  const featured=list.length<=8?list:list.filter(p=>p.services.length);
  const pinned=featured.length?featured.slice(0,8):list.slice(0,6);
  $('#project-labels').innerHTML=pinned.map(p=>`<button class="star-label" data-project="${esc(p.id)}" style="--project-color:${groupColor(p.group)}" hidden><span class="label-dot"></span><span class="label-content"><strong>${esc(p.name)}</strong><small>${esc(p.group)} ${icon('external')}</small></span></button>`).join('');
  positionLabels(projectedLabels);
}
function positionLabels(positions) {
  projectedLabels=positions;
  const placed=[];
  const width=innerWidth,height=innerHeight;
  for(const el of $('#project-labels').children) {
    const point=positions.find(p=>p.id===el.dataset.project);
    const isMobile=width<650;
    const blocked=point&&((point.x<(isMobile?14:200))||point.x>width-170||point.y<110||point.y>height-(isMobile?180:160)||(point.x<(isMobile?210:420)&&point.y>height*.5&&point.y<height-130));
    const overlap=point&&placed.some(p=>Math.abs(p.x-point.x)<175&&Math.abs(p.y-point.y)<58);
    el.hidden=!point?.visible||blocked||overlap;
    if(!el.hidden){el.style.left=point.x+'px';el.style.top=point.y+'px';placed.push(point);}
  }
}
const projectSymbol=p=>icon(p.services.length?'code':/CAD|模型|图纸/i.test(p.name)?'cube':/Archive|Notes|工作|文档|Docs/i.test(p.name)?'file':'orbit');
function serviceHTML(s,p,compact=false) {
  return `<div class="service-row ${compact?'compact':''}"><div class="service-icon">${icon('server')}</div><div class="service-info"><strong>${esc(s.name)}</strong><span><i class="status-dot ${s.online?'online':''}"></i>演示 · ${s.online?'运行中':'未运行'}</span></div><div class="service-actions"><button class="small-button" data-service="${esc(s.id)}">模拟${s.online?'停止':'启动'}</button></div></div>`;
}
function render() {
  if(!state.catalog) return;
  updateNavigation();
  const list=projects();
  const title=state.group!=='all'?state.group:({projects:'我的项目',favorites:'我的收藏',services:'服务控制台'}[state.view]);
  $('#library-title').innerHTML=`${esc(title)} <span>${state.view==='services'?list.reduce((n,p)=>n+p.services.length,0):list.length}</span>`;
  $('#library-subtitle').textContent=state.view==='services'?(isLocal?'当前通用本地模式提供文件导航。':'服务状态与启停均为演示，不执行本机命令。'):state.view==='favorites'?'把常用的坐标，留在手边。':state.group!=='all'?state.catalog.groups.find(g=>g.id===state.group).path:'从这里，继续你的创造。';
  $('#filter-line').innerHTML=state.query?`<span>搜索“${esc(state.query)}”</span><button id="clear-query">清除搜索 ${icon('close')}</button>`:state.group!=='all'?`<span class="directory-label">${icon('folder')} ${esc(state.group)} 目录中的全部项目</span><button id="open-group">浏览此目录 ${icon('chevron')}</button>`:'';
  $('#filter-line').classList.toggle('visible',Boolean(state.query||state.group!=='all'));
  const el=$('#project-list');
  el.className=state.view==='services'?'services-grid':`project-grid ${state.layout==='list'?'list-layout':''}`;
  if(!list.length) el.innerHTML=`<div class="empty-state">${icon(state.view==='favorites'?'star':'search')}<h3>${state.view==='favorites'&&!state.query?'收藏你的第一个项目':'没有找到匹配的项目'}</h3><p>${state.view==='favorites'&&!state.query?'点击项目右上角的星标，就能在这里快速找到它。':'试试其他名称，或清除当前筛选。'}</p><button class="small-button" id="show-all">查看全部项目</button></div>`;
  else if(state.view==='services') el.innerHTML=list.map(p=>`<article class="service-project"><header><button class="project-title-button" data-project="${esc(p.id)}">${esc(p.name)}</button><span class="group-tag" style="--group-color:${groupColor(p.group)}">${esc(p.group)}</span></header>${p.services.map(s=>serviceHTML(s,p)).join('')}</article>`).join('');
  else el.innerHTML=list.map(p=>`<article class="project-card ${state.selected?.id===p.id?'selected':''}" style="--project-color:${groupColor(p.group)}"><div class="card-top"><span class="project-symbol">${projectSymbol(p)}</span><span class="group-tag">${esc(p.group)}</span><button class="favorite icon-button ${state.favorites.has(p.id)?'is-favorite':''}" data-favorite="${esc(p.id)}" aria-label="${state.favorites.has(p.id)?'取消收藏':'收藏'} ${esc(p.name)}" title="${state.favorites.has(p.id)?'取消收藏':'收藏项目'}" aria-pressed="${state.favorites.has(p.id)}">${icon('star')}</button></div><button class="card-main" data-project="${esc(p.id)}"><h3>${esc(p.name)}</h3><p>${esc(p.description || (p.kind==='code'?'代码与应用项目':'文件与项目资料'))}</p><span class="card-path" title="${esc(p.path)}">${esc(p.relativePath || p.path.replace(state.catalog.root+'\\',''))}</span></button><div class="card-bottom"><span class="card-meta">${p.services.length?`<i class="status-dot ${p.services.some(s=>s.online)?'online':''}"></i>${p.services.length} 个服务入口`:`${icon('folder')} 本地项目`}</span><button class="card-open" data-open="${esc(p.path)}" title="在资源管理器中打开 ${esc(p.name)}" aria-label="打开 ${esc(p.name)} 文件夹">${icon('external')}</button></div></article>`).join('');
  $('#footer-count').textContent=`${state.catalog.projects.length} 个项目，${serviceCount()} 个服务入口`;
  renderLabels(list);
  state.scene?.setFilter(list.map(p=>p.id));
}

let drawerOpener, browseRequest=0;
function showDrawer() { if($('#drawer').hidden) drawerOpener=document.activeElement; $('#drawer').hidden=false;$('#drawer-backdrop').hidden=false;$('#drawer').setAttribute('aria-modal',String(state.phase!=='focused'));document.body.classList.add('drawer-open'); }
function hideDrawer() { browseRequest++;$('#drawer').hidden=true;$('#drawer-backdrop').hidden=true;document.body.classList.remove('drawer-open'); }
function returnOverview(restoreFocus=true) {
  stopCruise();
  projectVisit++;hideDrawer();state.phase='overview';state.focusedId=null;state.identity=null;state.selected=null;
  document.body.classList.remove('travelling','planet-focused');$('#travel-hud').hidden=true;$('#focus-hud').hidden=true;
  state.scene?.reset();render();
  if(restoreFocus)$('#open-catalog').focus({preventScroll:true});
}
function closeDrawer() { if(state.phase!=='overview'){returnOverview();return;}hideDrawer();(drawerOpener?.isConnected&&drawerOpener.getClientRects().length?drawerOpener:$('#open-catalog')).focus({preventScroll:true}); }
async function browse(path) {
  stopCruise();
  const directory=path.replaceAll('\\','/');
  const owner=state.catalog.projects.find(p=>directory===p.path.replaceAll('\\','/')||directory.startsWith(p.path.replaceAll('\\','/')+'/'))||null;
  if(state.phase!=='overview'&&owner?.id!==state.focusedId)returnOverview(false);
  const request=++browseRequest;
  state.selected=owner;
  showDrawer();
  $('#drawer').innerHTML=`<div class="drawer-loading"><span class="loading-orbit"></span>正在读取目录…</div><button class="drawer-close icon-button" id="close-drawer" aria-label="关闭">${icon('close')}</button>`;
  $('#close-drawer').focus({preventScroll:true});
  try {const result=await api('/api/browse?path='+encodeURIComponent(path));if(request!==browseRequest)return;state.browse=result;state.fileQuery='';renderDrawer();} catch(e){if(request!==browseRequest)return;$('#drawer').innerHTML=`<button class="drawer-close icon-button" id="close-drawer" aria-label="关闭">${icon('close')}</button><div class="empty-state"><h3>无法读取目录</h3><p>${esc(e.message)}</p><button class="small-button" id="drawer-root">返回工作空间</button></div>`;$('#close-drawer').focus({preventScroll:true});}
}
async function openProject(id) {
  const p=state.catalog.projects.find(p=>p.id===id);if(!p)return;
  stopCruise();
  if(state.phase!=='overview'&&state.focusedId===id)return;
  if(!state.webgl||!state.scene?.focusProject){browse(p.path);return;}
  const visit=++projectVisit;
  hideDrawer();closeCatalog();state.selected=p;state.browse=null;state.phase='travelling';state.focusedId=id;
  document.body.classList.remove('planet-focused');document.body.classList.add('travelling');
  document.documentElement.style.setProperty('--focus-accent',groupColor(p.group));
  $('#focus-hud').hidden=true;$('#scene-hover').hidden=true;$('#travel-name').textContent=p.name;$('#travel-detail').textContent=`${p.group} 星域 · 项目入口将在抵达后展开`;
  $('#travel-hud').hidden=false;$('#cancel-flight').focus({preventScroll:true});
  const files=api('/api/browse?path='+encodeURIComponent(p.path)).then(data=>({data}),error=>({error}));
  const arrival=await state.scene.focusProject(id,{panelWidth:innerWidth>720?Math.min(560,innerWidth):0,panelHeight:innerWidth<=720?innerHeight*.46:0});
  if(visit!==projectVisit)return;
  if(!arrival.arrived){returnOverview();return;}
  state.phase='focused';state.identity=arrival.identity;
  document.body.classList.remove('travelling');document.body.classList.add('planet-focused');$('#travel-hud').hidden=true;
  document.documentElement.style.setProperty('--focus-accent',arrival.identity?.accent||groupColor(p.group));
  $('#focus-name').textContent=p.name;$('#focus-type').textContent=`${p.group} 星域 · ${arrival.identity?.typeLabel||'项目星球'}`;$('#focus-hud').hidden=false;$('#return-overview').focus({preventScroll:true});
  const result=await files;
  if(visit!==projectVisit)return;
  showDrawer();
  if(result.error){$('#drawer').innerHTML=`<button class="drawer-close icon-button" id="close-drawer" aria-label="关闭项目面板">${icon('close')}</button><div class="empty-state"><h2 id="drawer-title">${esc(p.name)}</h2><p>${esc(result.error.message)}</p><button class="small-button" data-browse="${esc(p.path)}">重新读取项目</button></div>`;$('#close-drawer').focus({preventScroll:true});return;}
  state.browse=result.data;state.fileQuery='';renderDrawer();
}
function renderDrawer() {
  const p=state.selected,b=state.browse;
  const segments=b.path.replace(state.catalog.root,'').split(/[\\/]/).filter(Boolean);
  const crumbs=[`<button data-browse="${esc(state.catalog.root)}">WorkSpace</button>`];
  segments.forEach((s,i)=>crumbs.push(`${icon('chevron')}<button data-browse="${esc(state.catalog.root.replace(/[\\/]$/,'')+'/'+segments.slice(0,i+1).join('/'))}">${esc(s)}</button>`));
  const shortcuts=p?.entries?.length?`<div class="drawer-shortcuts"><h3>常用入口</h3><div>${p.entries.map(e=>e.type==='web'?`<a class="entry-shortcut" href="${esc(e.url)}" target="_blank" rel="noreferrer">${icon('external')}${esc(e.name)}</a>`:`<button class="entry-shortcut" ${e.type==='folder'?'data-browse':'data-open'}="${esc(e.path)}">${icon(e.type==='folder'?'folder':'file')}${esc(e.name)}</button>`).join('')}</div></div>`:'';
  $('#drawer').innerHTML=`<div class="drawer-heading"><span class="drawer-eyebrow">${p?esc(p.group):'本地文件'}</span><button class="icon-button" id="close-drawer" aria-label="关闭项目面板">${icon('close')}</button><h2 id="drawer-title">${esc(p?.name || (segments.at(-1)||'我的工作空间'))}</h2><p>${esc(p?.description || '浏览目录，快速打开本机文件。')}</p><div class="drawer-quick"><button class="primary-button" data-open="${esc(b.path)}">${icon('folder')} 打开文件夹</button><button class="small-button" id="copy-path">${icon('copy')} 复制路径</button>${p?`<button class="icon-button favorite ${state.favorites.has(p.id)?'is-favorite':''}" data-favorite="${esc(p.id)}" aria-label="${state.favorites.has(p.id)?'取消收藏':'收藏项目'}">${icon('star')}</button>`:''}</div></div>${p?.services.length?`<div class="drawer-services"><h3>应用与后台 <span>${p.services.length}</span></h3>${p.services.map(s=>serviceHTML(s,p,true)).join('')}</div>`:''}${shortcuts}<div class="drawer-files"><div class="files-heading"><h3>项目文件</h3><span id="file-count"></span></div><div class="file-breadcrumb">${crumbs.join('')}</div><label class="file-search">${icon('search')}<input id="file-search" type="search" placeholder="筛选当前文件夹…" aria-label="筛选当前文件夹"/></label><div id="file-list" class="file-list"></div></div>`;
  renderFiles();
  $('#close-drawer').focus({preventScroll:true});
}
function fileSize(size) { return size>1048576?`${(size/1048576).toFixed(1)} MB`:size>1024?`${Math.round(size/1024)} KB`:`${size||0} B`; }
function renderFiles() {
  const b=state.browse, files=b.entries.filter(e=>e.name.toLowerCase().includes(state.fileQuery.toLowerCase()));
  $('#file-count').textContent=`${files.length} 项`;
  $('#file-list').innerHTML=(b.parent?`<button class="file-row parent-row" data-browse="${esc(b.parent)}">${icon('back')}<span>上一级目录</span></button>`:'')+files.map(e=>`<button class="file-row ${e.type}" ${e.type==='folder'?'data-browse':e.canOpen===false?'data-reveal':'data-open'}="${esc(e.path)}" ${e.canOpen===false?'title="打开此文件所在位置"':''}><span class="file-symbol">${icon(e.type==='folder'?'folder':'file')}</span><span class="file-name">${esc(e.name)}</span><span class="file-meta">${e.type==='folder'?icon('chevron'):e.canOpen===false?'定位文件':esc(fileSize(e.size))}</span></button>`).join('')+(!files.length?'<div class="files-empty">'+(state.fileQuery?'没有匹配的文件':'这个文件夹暂无可浏览内容')+'</div>':'');
}

async function loadCatalog(refresh=false) {
  const data=await api('/api/catalog'+(refresh?'?refresh=1':''));
  if(isLocal&&data.mode!=='local')throw new Error('请先设置 ATLAS_ROOT 并启动本地服务器');
  state.catalog=data;
  if(state.selected) state.selected=data.projects.find(p=>p.id===state.selected.id)||state.selected;
  render();
  return data;
}
async function startService(id) {
  const result=await api(`/api/services/${encodeURIComponent(id)}/start`,{});
  await loadCatalog();
  if(!$('#drawer').hidden&&state.browse)renderDrawer();
  toast(result.message);
}
document.addEventListener('click',e=>{
  const btn=e.target.closest('button,a');if(!btn)return;
  if(!['cruise-toggle','cruise-enter','cruise-exit'].includes(btn.id))stopCruise();
  if(btn.dataset.view){state.view=btn.dataset.view;state.group='all';render();showCatalog();state.scene?.focusGroup?.(null);if(state.view==='services')loadCatalog().catch(e=>toast(e.message));}
  else if(btn.dataset.group){if(state.phase!=='overview')returnOverview(false);state.group=btn.dataset.group;state.view='projects';render();state.scene?.focusGroup?.(state.group);}
  else if(btn.dataset.sector){if(state.phase!=='overview')returnOverview(false);state.group='all';state.view='projects';render();state.scene?.focusGroup?.(null);}
  else if(btn.dataset.favorite){const id=btn.dataset.favorite;state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);savedFavorites();render();if(!$('#drawer').hidden&&state.browse)renderDrawer();}
  else if(btn.dataset.project)openProject(btn.dataset.project);
  else if(btn.dataset.open)openPath(btn.dataset.open);
  else if(btn.dataset.reveal)revealPath(btn.dataset.reveal);
  else if(btn.dataset.browse)browse(btn.dataset.browse);
  else if(btn.dataset.service)startService(btn.dataset.service);
  else switch(btn.id){
    case 'open-catalog':showCatalog();break;
    case 'close-catalog':closeCatalog();$('#open-catalog').focus({preventScroll:true});break;
    case 'close-drawer':closeDrawer();break;
    case 'cancel-flight':case 'return-overview':returnOverview();break;
    case 'cruise-toggle':if(state.cruiseActive)stopCruise();else startCruise();break;
    case 'cruise-exit':stopCruise();$('#universe').focus({preventScroll:true});break;
    case 'cruise-enter':{const id=state.cruiseTarget?.id;stopCruise();if(id)openProject(id);break;}
    case 'root-folder':openPath(state.catalog.root);break;
    case 'browse-root':case 'drawer-root':browse(state.catalog.root);break;
    case 'open-group':browse(state.catalog.groups.find(g=>g.id===state.group).path);break;
    case 'clear-query':$('#search').value='';$('#catalog-search').value='';state.query='';render();break;
    case 'show-all':state.group='all';state.view='projects';state.query='';$('#search').value='';$('#catalog-search').value='';render();break;
    case 'grid-view':case 'list-view':state.layout=btn.id==='grid-view'?'grid':'list';$('#grid-view').classList.toggle('active',state.layout==='grid');$('#list-view').classList.toggle('active',state.layout==='list');render();break;
    case 'copy-path':navigator.clipboard.writeText(state.browse.path).then(()=>toast('已复制文件夹路径')).catch(()=>toast(state.browse.path));break;
    case 'motion':state.paused=!state.paused;state.scene?.setPaused(state.paused);btn.innerHTML=icon(state.paused?'play':'pause');btn.setAttribute('aria-label',state.paused?'播放动画':'暂停动画');btn.title=state.paused?'播放动画':'暂停动画';break;
    case 'reset-camera':if(state.phase!=='overview')returnOverview();else state.scene?.reset();break;
    case 'warp':if(state.phase!=='overview')returnOverview(false);state.scene?.warp?.();break;
    case 'refresh':btn.classList.add('spinning');loadCatalog(true).then(()=>{state.scene?.setProjects(state.catalog.projects);toast('项目目录已同步');}).catch(e=>toast(e.message)).finally(()=>btn.classList.remove('spinning'));break;
  }
});
$('#drawer-backdrop').addEventListener('click',closeDrawer);
$('#search').addEventListener('focus',()=>{showCatalog();$('#catalog-search').focus();});
for(const selector of ['#search','#catalog-search']) $(selector).addEventListener('input',e=>{state.query=e.target.value;$('#search').value=state.query;$('#catalog-search').value=state.query;render();showCatalog();});
$('#sort').addEventListener('change',e=>{state.sort=e.target.value;render();});
$('#drawer').addEventListener('input',e=>{if(e.target.id==='file-search'){state.fileQuery=e.target.value;renderFiles();}});
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!$('#drawer').hidden)$('#file-search')?.focus();else{showCatalog();$('#catalog-search').focus();}}
  if(e.key==='Escape'){if(state.cruiseActive){stopCruise();$('#universe').focus({preventScroll:true});}else if(state.phase==='travelling')returnOverview();else if(!$('#drawer').hidden)closeDrawer();else if(state.phase==='focused')returnOverview();else if(!$('#catalog-panel').hidden){closeCatalog();$('#open-catalog').focus({preventScroll:true});}}
  if(e.key==='Tab'&&!$('#drawer').hidden&&$('#drawer').getAttribute('aria-modal')==='true'){const focusable=[...$('#drawer').querySelectorAll('button:not([disabled]),a[href],input,select')];const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
});

try {
  await loadCatalog();
  const {createScene}=await import('./scene.js');
  state.scene=await createScene({canvas:$('#universe'),projects:state.catalog.projects,onSelect:openProject,onProjectPositions:positionLabels,onCruiseChange:setCruiseActive,onCruiseTarget:target=>{state.cruiseTarget=target;renderCruiseInfo();},onHover:id=>{const p=state.catalog.projects.find(p=>p.id===id);$('#scene-hover').hidden=!p;if(p)$('#scene-hover').innerHTML=`<i style="background:${groupColor(p.group)}"></i><span>${esc(p.name)}<small>${esc(p.group)} · 点击进入</small></span>`;},onReady:({webgl})=>{state.webgl=webgl;$('#scene-loading').hidden=true;$('#cruise-toggle').disabled=!webgl;if(!webgl){$('#scene-stage').classList.add('no-webgl');showCatalog();toast('当前浏览器未开启 3D 加速，项目目录可正常使用。');}}});
  state.scene?.setPaused(state.paused);
  state.scene?.setFilter(projects().map(p=>p.id));
} catch(e) {
  $('#scene-loading').hidden=true;
  showCatalog();
  if(!state.catalog)$('#project-list').innerHTML=`<div class="empty-state"><h3>尚未连接本机工作空间</h3><p>${esc(e.message)}。请使用“启动工作空间”打开页面。</p><button class="small-button" onclick="location.reload()">重新连接</button></div>`;
  else toast('3D 场景暂未加载，项目导航可正常使用。');
  console.error(e);
}
