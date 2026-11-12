import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createProjectPlanet, updateProjectPlanet, disposeProjectPlanet } from './planets.js';
import { createNebulaBackground } from './nebula.js';

const TAU = Math.PI * 2;
const COLORS = ['#a7c9e6', '#d4ac87', '#9bbbae', '#b7a9d5'];
const noiseGLSL = `
  float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float n=0.,a=.5;mat2 m=mat2(.8,.6,-.6,.8);for(int i=0;i<4;i++){n+=a*noise(p);p=m*p*2.1+7.3;a*=.5;}return n;}
`;

export async function createScene({ canvas, projects = [], onSelect = () => {}, onHover = () => {}, onReady = () => {}, onProjectPositions = () => {}, onFocusChange = () => {}, onCruiseChange = () => {}, onCruiseTarget = () => {} }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch {
    onReady({ webgl: false });
    return { setProjects() {}, setSelected() {}, setFilter() {}, setPaused() {}, reset() {}, focusGroup() {}, warp() {}, startCruise() { return false; }, stopCruise() {}, focusProject(id) { return Promise.resolve({ arrived: true, id, identity: { typeLabel: '项目空间', accent: COLORS[0] } }); }, destroy() {} };
  }
  const pixelRatio = Math.min(devicePixelRatio, 1.4);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x02030b, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 180);
  const baseCamera = new THREE.Vector3(0, 6.1, 14.8);
  const initialCamera = baseCamera.clone();
  camera.position.copy(initialCamera);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.35, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 43;
  controls.minPolarAngle = 0.13;
  controls.maxPolarAngle = Math.PI - 0.13;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.65;

  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motionQuery.matches;
  let elapsed = 0;
  let orbitTime = 0;
  let seed = 17481;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };

  const nebula = createNebulaBackground();
  scene.add(nebula);

  const starPositions = [], starSizes = [], starPhases = [], starColors = [];
  for (let i = 0; i < 14000; i++) {
    const radius = 23 + random() * 57;
    const angle = random() * TAU;
    const cosPhi = random() * 2 - 1;
    const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
    starPositions.push(Math.cos(angle) * sinPhi * radius, cosPhi * radius, Math.sin(angle) * sinPhi * radius);
    const bright = random();
    starSizes.push(bright > 0.996 ? 6 + random() * 5 : bright > 0.95 ? 2.5 + random() * 2.5 : 0.65 + random() * 1.5);
    starPhases.push(random() * TAU);
    const tint = new THREE.Color(i % 13 === 0 ? 0xf5bd87 : i % 7 === 0 ? 0x9dcaff : 0xc2d2e8);
    tint.multiplyScalar(0.55 + random() * 1.8);
    starColors.push(tint.r, tint.g, tint.b);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(starSizes, 1));
  starGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(starPhases, 1));
  starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
  const starMaterial = new THREE.ShaderMaterial({
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, pixelRatio: { value: pixelRatio } },
    vertexShader: `attribute float aSize;attribute float aPhase;uniform float time;uniform float pixelRatio;varying vec3 vColor;varying float vBright;
      void main(){vColor=color;vBright=.8+.2*sin(time*.5+aPhase);vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*pixelRatio*(40./-p.z),1.,18.);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `varying vec3 vColor;varying float vBright;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);float core=exp(-d*d*35.);float rays=exp(-abs(p.x)*80.)*exp(-abs(p.y)*7.)+exp(-abs(p.y)*80.)*exp(-abs(p.x)*7.);gl_FragColor=vec4(vColor*(core+rays*.35)*vBright,1.);}`
  });
  scene.add(new THREE.Points(starGeometry, starMaterial));

  const galaxy = new THREE.Group();
  galaxy.rotation.set(0.06, 0, -0.13);
  scene.add(galaxy);

  const diskMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, strength: { value: 1 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `${noiseGLSL}
      uniform float time;uniform float strength;varying vec2 vUv;
      void main(){
        vec2 p=(vUv-.5)*22.;float r=length(p);float a=atan(p.y,p.x);
        float twist=a+log(max(r,.1))*2.2-time*.035;
        vec2 flow=vec2(cos(twist),sin(twist))*r;
        float n=fbm(flow*2.3);
        float coarse=fbm(flow*.55);
        float filament=pow(fbm(vec2(r*15.+coarse*8.,sin(a)*2.7+cos(a)*1.9+n*2.-time*.04)),2.1);
        float grain=fbm(flow*15.+vec2(n*5.));
        float broad=.25+.75*fbm(flow*.8+vec2(n*3.));
        float spiral=pow(.5+.5*sin(a*2.+log(max(r,.1))*4.4+coarse*3.),2.);
        float inner=smoothstep(1.32,1.9,r);
        float outer=1.-smoothstep(5.2,10.5,r);
        float hot=exp(-pow((r-1.95)*1.55,2.));
        float density=(.045+filament*.85+grain*.055)*broad*inner*outer*(.45+spiral*.7);
        density+=hot*(.12+filament*.25)*inner;
        vec3 warm=mix(vec3(1.,.19,.035),vec3(1.,.59,.2),1.-smoothstep(2.2,8.,r));
        warm=mix(warm,vec3(1.,.91,.68),hot*.95);
        gl_FragColor=vec4(warm*density*strength*2.,density);
      }`
  });
  const disk = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), diskMaterial);
  disk.rotation.x = -Math.PI / 2;
  galaxy.add(disk);
  const diskVeil = disk.clone();
  diskVeil.material = diskMaterial.clone();
  diskVeil.material.uniforms.strength.value = 0.26;
  diskVeil.position.y = 0.16;
  diskVeil.rotation.z = 0.12;
  galaxy.add(diskVeil);

  const diskPositions = [], diskRandom = [], diskSizes = [];
  for (let i = 0; i < 46000; i++) {
    const r = 1.48 + Math.pow(random(), 1.35) * 8.9;
    const angle = random() * TAU;
    const thickness = (random() + random() + random() - 1.5) * (0.035 + r * 0.018);
    diskPositions.push(r, angle, thickness);
    diskRandom.push(random());
    diskSizes.push(0.7 + random() * 2.5);
  }
  for (let i = 0; i < 6500; i++) {
    const r = 8 + random() * 11;
    const angle = random() * TAU;
    diskPositions.push(r, angle, (random() - 0.5) * 0.65);
    diskRandom.push(random());
    diskSizes.push(0.5 + random() * 1.5);
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(diskPositions, 3));
  particleGeometry.setAttribute('aRandom', new THREE.Float32BufferAttribute(diskRandom, 1));
  particleGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(diskSizes, 1));
  const particleMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, pixelRatio: { value: pixelRatio } },
    vertexShader: `attribute float aRandom;attribute float aSize;uniform float time;uniform float pixelRatio;varying vec3 vColor;varying float vOpacity;
      void main(){
        float r=position.x;float a=position.y+time*.16/pow(r,.8);
        a+=sin(r*2.1+aRandom*3.)*.06;
        vec3 p=vec3(cos(a)*r,position.z+sin(a*3.+r)*.015*r,sin(a)*r);
        float hot=exp(-pow((r-2.1)*.8,2.));
        vColor=mix(vec3(1.,.26,.055),vec3(1.,.83,.5),hot);
        vColor=mix(vColor,vec3(.48,.69,1.),smoothstep(9.,17.,r)*.65);
        float arms=.35+.65*pow(.5+.5*sin(position.y*3.+log(r)*8.),2.);
        vOpacity=(.12+aRandom*.62)*arms*(1.-smoothstep(8.,19.,r));
        vec4 viewPosition=modelViewMatrix*vec4(p,1.);
        gl_PointSize=clamp(aSize*pixelRatio*(13./-viewPosition.z),.5,5.);
        gl_Position=projectionMatrix*viewPosition;
      }`,
    fragmentShader: 'varying vec3 vColor;varying float vOpacity;void main(){float d=length(gl_PointCoord-.5);float glow=exp(-d*d*22.);gl_FragColor=vec4(vColor*1.35,glow*vOpacity);}'
  });
  const accretion = new THREE.Points(particleGeometry, particleMaterial);
  accretion.frustumCulled = false;
  galaxy.add(accretion);

  const blackCore = new THREE.Mesh(new THREE.SphereGeometry(1.26, 64, 48), new THREE.MeshBasicMaterial({ color: 0x010108 }));
  galaxy.add(blackCore);
  const photonRing = new THREE.Group();
  photonRing.rotation.x = -0.43;
  photonRing.rotation.z = 0.13;
  const hotMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.65, 0.7), toneMapped: false });
  photonRing.add(new THREE.Mesh(new THREE.TorusGeometry(1.37, 0.022, 10, 220), hotMaterial));
  photonRing.add(new THREE.Mesh(new THREE.TorusGeometry(1.46, 0.008, 6, 220), new THREE.MeshBasicMaterial({ color: 0xe8a15e, transparent: true, opacity: 0.7 })));
  galaxy.add(photonRing);
  const coreGlow = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;void main(){float r=length(vUv-.5)*8.;float a=exp(-pow((r-1.45)*2.8,2.))*.11*smoothstep(1.27,1.4,r);gl_FragColor=vec4(vec3(1.,.45,.12),a);}'
  }));
  scene.add(coreGlow);

  const laneRoot = new THREE.Group();
  laneRoot.rotation.z = -0.13;
  scene.add(laneRoot);
  const lanes = [];
  for (let i = 0; i < 4; i++) {
    const lane = new THREE.Group();
    lane.rotation.set(0.03 + i * 0.13, i * 0.42, -0.07 + i * 0.065);
    const radius = 7.5 + i * 0.83;
    const points = [];
    for (let step = 0; step <= 360; step++) {
      const a = step / 360 * TAU;
      points.push(new THREE.Vector3(Math.cos(a) * radius, 0.36 + i * 0.14, Math.sin(a) * radius));
    }
    lane.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: COLORS[i], transparent: true, opacity: 0.25 })));
    laneRoot.add(lane);
    lanes.push({ lane, radius, height: 0.36 + i * 0.14 });
  }

  const hemisphere = new THREE.HemisphereLight(0x8295ce, 0x08040d, 1.25);
  scene.add(hemisphere);
  const sunLight = new THREE.PointLight(0xffddb1, 110, 40, 1.5);
  sunLight.position.set(0, 1.8, 0);
  scene.add(sunLight);
  const blueLight = new THREE.DirectionalLight(0x7b9fe6, 2.5);
  blueLight.position.set(-7, 6, 9);
  scene.add(blueLight, blueLight.target);

  let satellites = [];
  let groupNames = [];
  let pickMesh, beacons;
  let filtered = null, focusedGroup = null, selected = null, hovered = null;
  let focusState = null, pendingFlight = null;
  let cruise = null, manualAnchor = null;
  let focusLightingBlend = 0;
  const viewOffset = new THREE.Vector2();
  const focusView = new THREE.Vector3();
  const focusRight = new THREE.Vector3();
  const focusUp = new THREE.Vector3();
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const world = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const selection = new THREE.Group();
  const haloRingMaterial = new THREE.MeshBasicMaterial({ color: 0xe9c699, transparent: true, opacity: 0.85, toneMapped: false });
  selection.add(new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.009, 6, 72), haloRingMaterial));
  const selectionOuter = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.004, 5, 72), new THREE.MeshBasicMaterial({ color: 0xadc9e6, transparent: true, opacity: 0.4 }));
  selection.add(selectionOuter);
  selection.visible = false;
  scene.add(selection);

  const inspectionLight = new THREE.DirectionalLight(0xe3edff, 0);
  scene.add(inspectionLight, inspectionLight.target);

  function setProjects(next) {
    stopCruise({ takeover: false });
    manualAnchor = null;
    const returnFromFocus = Boolean(focusState) || viewOffset.lengthSq() > 0;
    cancelFlight();
    focusState = null;
    selected = null;
    for (const satellite of satellites) {
      scene.remove(satellite.planet);
      disposeProjectPlanet(satellite.planet);
    }
    projects = next;
    for (const object of [pickMesh, beacons]) {
      if (!object) continue;
      scene.remove(object);
      object.geometry.dispose();
      object.material.dispose();
    }
    groupNames = [...new Set(next.map(project => project.group))];
    const groupLanes = new Map(groupNames.map((name, index) => [name, index % lanes.length]));
    const laneProjects = lanes.map((_, index) => next.filter(project => groupLanes.get(project.group) === index));
    satellites = next.map((project, index) => {
      const laneIndex = groupLanes.get(project.group);
      const members = laneProjects[laneIndex];
      const slot = members.findIndex(member => member.id === project.id);
      const planet = createProjectPlanet(project);
      scene.add(planet);
      return { id: project.id, name: project.name, group: project.group, color: planet.userData.identity.accent, laneIndex, angle: slot / Math.max(1, members.length) * TAU + laneIndex * 0.72 - 0.5, position: new THREE.Vector3(), index, size: planet.userData.radius, planet };
    });
    pickMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.33, 10, 8), new THREE.MeshBasicMaterial({ visible: false }), Math.max(1, next.length));
    pickMesh.count = next.length;
    pickMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const beaconGeometry = new THREE.BufferGeometry();
    beaconGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(next.length * 3), 3));
    beaconGeometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(next.length * 3), 3));
    beaconGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(new Float32Array(next.length), 1));
    beacons = new THREE.Points(beaconGeometry, new THREE.ShaderMaterial({
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { pixelRatio: { value: pixelRatio } },
      vertexShader: 'attribute float aSize;uniform float pixelRatio;varying vec3 vColor;void main(){vColor=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*pixelRatio*(15./-p.z),5.,80.);gl_Position=projectionMatrix*p;}',
      fragmentShader: 'varying vec3 vColor;void main(){float r=length(gl_PointCoord-.5);float glow=exp(-r*r*16.);float rim=exp(-pow((r-.13)*15.,2.))*.35;gl_FragColor=vec4(vColor,(glow*.13+rim*.2)*(1.-smoothstep(.4,.5,r)));}'
    }));
    beacons.frustumCulled = false;
    scene.add(pickMesh, beacons);
    if (returnFromFocus) {
      camera.position.copy(initialCamera);
      controls.target.set(0, 0.35, 0);
      viewOffset.set(0, 0);
      camera.clearViewOffset();
      restoreOverviewLimits();
      onFocusChange({ phase: 'overview', id: null });
    }
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.48, 0.5, 1.0));
  const coreMask = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, center: { value: new THREE.Vector2(0.5, 0.5) }, radius: { value: 0 }, aspect: { value: 1 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D tDiffuse;uniform vec2 center;uniform float radius;uniform float aspect;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 p=vUv-center;p.x*=aspect;float d=length(p)/max(radius,.00001);float mask=(1.-smoothstep(.67,.99,d))*.994;gl_FragColor=vec4(mix(c.rgb,vec3(.00025,.00035,.0008),mask),c.a);}'
  });
  composer.addPass(coreMask);
  composer.addPass(new OutputPass());

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(5, 5);
  let downPoint = null, isDragging = false, cameraMove = null;
  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  }
  function pick() {
    if (!pickMesh) return null;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(pickMesh, false);
    for (const hit of hits) {
      const satellite = satellites[hit.instanceId];
      if (satellite && (!filtered || filtered.has(satellite.id)) && (!focusedGroup || focusedGroup === satellite.group)) return satellite.id;
    }
    return null;
  }
  function handleMove(event) {
    if (pendingFlight || cameraMove?.locked) return;
    updatePointer(event);
    if (downPoint && Math.hypot(event.clientX - downPoint.x, event.clientY - downPoint.y) > 5) isDragging = true;
    const id = isDragging ? null : pick();
    if (id !== hovered) { hovered = id; onHover(id); }
    canvas.style.cursor = isDragging ? 'grabbing' : id ? 'pointer' : 'grab';
  }
  function handleDown(event) {
    if (pendingFlight || cameraMove?.locked) return;
    downPoint = { x: event.clientX, y: event.clientY };
    isDragging = false;
    cameraMove = null;
  }
  function handleUp(event) {
    if (pendingFlight || cameraMove?.locked || !downPoint) return;
    updatePointer(event);
    if (!isDragging) { const id = pick(); if (id) onSelect(id); }
    downPoint = null;
    isDragging = false;
  }
  function handleLeave() { downPoint = null; isDragging = false; hovered = null; onHover(null); }
  function takeOverCruise() { if (cruise) stopCruise(); }
  canvas.addEventListener('pointerdown', takeOverCruise, true);
  canvas.addEventListener('wheel', takeOverCruise, { capture: true, passive: true });
  canvas.addEventListener('pointermove', handleMove);
  canvas.addEventListener('pointerdown', handleDown);
  canvas.addEventListener('pointerup', handleUp);
  canvas.addEventListener('pointerleave', handleLeave);
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';

  let width = 1, height = 1, hasSized = false;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (hasSized && width === rect.width && height === rect.height) return;
    width = rect.width;
    height = rect.height;
    camera.aspect = width / height;
    initialCamera.copy(baseCamera).multiplyScalar(Math.max(1, Math.min(1.85, 1.5 / camera.aspect)));
    if (!hasSized) { camera.position.copy(initialCamera); hasSized = true; }
    if (focusState) {
      const framing = focusFraming(focusState.size, width > 720 ? Math.min(560, width) : 0, width <= 720 ? height * 0.46 : 0);
      if (pendingFlight && cameraMove) {
        const direction = cameraMove.to.clone().sub(focusState.position).normalize();
        cameraMove.to.copy(focusState.position).addScaledVector(direction, framing.distance);
        cameraMove.toOffset.copy(framing.offset);
        const t = Math.min(1, (performance.now() - cameraMove.start) / cameraMove.duration);
        const ease = t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
        viewOffset.lerpVectors(cameraMove.fromOffset, cameraMove.toOffset, ease);
      } else {
        const zoom = camera.position.distanceTo(focusState.position) / focusState.frameDistance;
        camera.position.sub(focusState.position).normalize().multiplyScalar(framing.distance * zoom).add(focusState.position);
        controls.target.copy(focusState.position);
        viewOffset.copy(framing.offset);
        camera.lookAt(controls.target);
      }
      focusState.frameDistance = framing.distance;
      controls.maxDistance = Math.max(focusState.size * 30, framing.distance * 2.5);
    }
    camera.updateProjectionMatrix();
    applyViewOffset();
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  setProjects(projects);

  const overviewTarget = new THREE.Vector3(0, 0.35, 0);
  function applyViewOffset() {
    if (viewOffset.lengthSq() > 0.01) camera.setViewOffset(width, height, viewOffset.x, viewOffset.y, width, height);
    else camera.clearViewOffset();
  }
  function restoreOverviewLimits() {
    controls.minDistance = 4.5;
    controls.maxDistance = 43;
    camera.near = 0.1;
    camera.updateProjectionMatrix();
  }
  function cancelFlight() {
    cameraMove = null;
    controls.enabled = true;
    if (!pendingFlight) return;
    const previousFlight = pendingFlight;
    pendingFlight = null;
    previousFlight.resolve({ arrived: false, id: previousFlight.id });
  }
  function moveCamera(destination, duration = 1200, isWarp = false, { target = overviewTarget, offset = new THREE.Vector2(), arc = false, complete = restoreOverviewLimits } = {}) {
    if (motionQuery.matches) {
      camera.position.copy(destination);
      controls.target.copy(target);
      viewOffset.copy(offset);
      applyViewOffset();
      camera.lookAt(target);
      complete();
      return;
    }
    const from = camera.position.clone();
    const control = from.clone().lerp(destination, 0.5);
    if (arc) {
      const direction = destination.clone().sub(from);
      const side = new THREE.Vector3().crossVectors(direction, camera.up).normalize();
      control.addScaledVector(side, Math.min(2.2, direction.length() * 0.16));
      control.y += Math.min(1.8, direction.length() * 0.12);
    }
    cameraMove = { from, to: destination.clone(), fromTarget: controls.target.clone(), toTarget: target.clone(), fromOffset: viewOffset.clone(), toOffset: offset.clone(), control: arc ? control : null, start: performance.now(), duration, warp: isWarp, complete };
  }
  function returnToOverview(destination = initialCamera, isWarp = false) {
    stopCruise({ takeover: false });
    manualAnchor = null;
    cancelFlight();
    focusState = null;
    selected = null;
    hovered = null;
    onHover(null);
    onFocusChange({ phase: 'overview', id: null });
    controls.enabled = false;
    moveCamera(destination, isWarp ? 1900 : 1250, isWarp, {
      complete() { restoreOverviewLimits(); controls.enabled = true; }
    });
    if (cameraMove) cameraMove.locked = true;
  }
  function cruisePosition(leg, progress, output = new THREE.Vector3()) {
    const angle = leg.heading - 0.32 + progress * 0.64;
    output.set(Math.sin(angle), leg.elevation + Math.sin(progress * Math.PI) * 0.08, Math.cos(angle)).normalize();
    return output.multiplyScalar(leg.distance).add(leg.target.position);
  }
  function clearCruisePosition(position) {
    if (position.length() < 2.2) return false;
    return satellites.every(satellite => position.distanceTo(satellite.position) > satellite.size * 2.3 + 0.2);
  }
  function announceCruiseTarget(phase) {
    onCruiseTarget({ id: cruise.target.id, index: cruise.index, total: cruise.ids.length, phase, identity: cruise.target.planet.userData.identity });
  }
  function beginCruiseLeg(index) {
    const target = satellites.find(satellite => satellite.id === cruise.ids[index]);
    cruise.index = index;
    cruise.target = target;
    cruise.heading = Math.atan2(target.position.x, target.position.z);
    cruise.elevation = 0.5;
    const diameter = Math.min(height * 0.31, width * 0.58);
    cruise.distance = target.size / (diameter / height * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    for (let attempt = 0; attempt < 4; attempt++) {
      let clear = true;
      for (let sample = 0; sample <= 16; sample++) {
        if (!clearCruisePosition(cruisePosition(cruise, sample / 16))) { clear = false; break; }
      }
      if (clear) break;
      cruise.elevation += 0.4;
      cruise.distance *= 1.12;
    }
    const from = camera.position.clone();
    const destination = cruisePosition(cruise, 0);
    const peak = Math.max(9.5, from.y + 3, destination.y + 3);
    const outward = destination.clone().setY(0).normalize();
    const first = from.clone().addScaledVector(from.clone().setY(0).normalize(), 1.6);
    const second = destination.clone().addScaledVector(outward, 2.5);
    first.y = second.y = peak;
    const path = new THREE.CubicBezierCurve3(from, first, second, destination);
    for (let attempt = 0; attempt < 3; attempt++) {
      let clear = true, coreHit = false;
      for (let sample = 1; sample < 40; sample++) {
        const point = path.getPoint(sample / 40);
        if (point.length() < 2.2) { clear = false; coreHit = true; break; }
        if (!clearCruisePosition(point)) { clear = false; break; }
      }
      if (clear) break;
      if (coreHit) {
        const exitDirection = from.clone().setY(0);
        if (exitDirection.lengthSq() < 0.1) exitDirection.copy(outward);
        first.copy(from).addScaledVector(exitDirection.normalize(), 7 + attempt * 3);
        second.y = peak + attempt * 2;
      } else {
        first.y += 4;
        second.y += 4;
      }
    }
    cruise.path = path;
    cruise.fromTarget = controls.target.clone();
    cruise.fromOffset = viewOffset.clone();
    cruise.phase = 'approaching';
    cruise.elapsed = 0;
    cruise.duration = THREE.MathUtils.clamp(from.distanceTo(destination) * 180 + 3300, 4500, 6000);
    selected = target.id;
    controls.minDistance = target.size * 1.5;
    controls.maxDistance = 60;
    camera.near = Math.min(0.025, target.size * 0.08);
    camera.updateProjectionMatrix();
    announceCruiseTarget('approaching');
    if (motionQuery.matches) {
      camera.position.copy(destination);
      controls.target.copy(target.position);
      viewOffset.set(0, 0);
      applyViewOffset();
      camera.lookAt(controls.target);
      cruise.phase = 'passing';
      announceCruiseTarget('passing');
    }
  }
  function startCruise(ids) {
    const available = satellites.filter(satellite => (!filtered || filtered.has(satellite.id)) && (!focusedGroup || focusedGroup === satellite.group));
    const allowed = new Set(available.map(satellite => satellite.id));
    const route = [...new Set(ids || available.map(satellite => satellite.id))].filter(id => allowed.has(id));
    if (!route.length) return false;
    stopCruise({ takeover: false });
    cancelFlight();
    const savedPosition = camera.position.clone();
    const savedTarget = controls.target.clone();
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    camera.position.copy(savedPosition);
    controls.target.copy(savedTarget);
    camera.lookAt(savedTarget);
    focusState = null;
    manualAnchor = null;
    hovered = null;
    onHover(null);
    controls.enabled = false;
    cruise = { ids: route };
    onFocusChange({ phase: 'overview', id: null });
    onCruiseChange({ active: true, reason: motionQuery.matches ? 'reduced-motion' : 'play' });
    beginCruiseLeg(0);
    return true;
  }
  function stopCruise({ takeover = true } = {}) {
    if (!cruise) return;
    const target = cruise.target;
    cruise = null;
    manualAnchor = takeover ? target : null;
    controls.enabled = true;
    const distance = camera.position.distanceTo(controls.target);
    controls.minDistance = Math.min(target.size * 1.5, distance * 0.8);
    controls.maxDistance = Math.max(43, distance * 2);
    camera.near = Math.min(0.025, target.size * 0.08);
    camera.updateProjectionMatrix();
    onCruiseChange({ active: false, reason: takeover ? 'takeover' : 'navigation' });
  }
  function updateCruise(delta) {
    if (motionQuery.matches) return;
    cruise.elapsed += delta * 1000;
    const t = Math.min(1, cruise.elapsed / cruise.duration);
    const ease = t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
    if (cruise.phase === 'approaching') {
      camera.position.copy(cruise.path.getPoint(ease));
      controls.target.lerpVectors(cruise.fromTarget, cruise.target.position, ease);
      viewOffset.copy(cruise.fromOffset).multiplyScalar(1 - ease);
      applyViewOffset();
      if (t === 1) {
        cruise.phase = 'passing';
        cruise.elapsed = 0;
        cruise.duration = 5200;
        announceCruiseTarget('passing');
      }
    } else {
      camera.position.copy(cruisePosition(cruise, ease));
      controls.target.copy(cruise.target.position);
      if (t === 1) beginCruiseLeg((cruise.index + 1) % cruise.ids.length);
    }
    camera.lookAt(controls.target);
  }
  function focusFraming(radius, panelWidth, panelHeight) {
    const drawerWidth = Math.min(panelWidth, width * 0.82);
    const drawerHeight = Math.min(panelHeight, height * 0.6);
    const diameter = Math.min(height * 0.42, (width - drawerWidth) * 0.82, (height - drawerHeight) * 0.78);
    return {
      distance: radius / (diameter / height * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))),
      offset: new THREE.Vector2(drawerWidth / 2, drawerHeight / 2)
    };
  }
  function focusProject(id, { panelWidth = width > 720 ? 560 : 0, panelHeight = width <= 720 ? height * 0.46 : 0 } = {}) {
    const satellite = satellites.find(project => project.id === id);
    if (!satellite) return Promise.resolve({ arrived: false, id });
    stopCruise({ takeover: false });
    manualAnchor = null;
    cancelFlight();
    const currentPosition = camera.position.clone();
    const currentTarget = controls.target.clone();
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    camera.position.copy(currentPosition);
    controls.target.copy(currentTarget);
    camera.lookAt(currentTarget);
    controls.enabled = false;
    focusState = satellite;
    focusedGroup = null;
    selected = id;
    hovered = null;
    const identity = satellite.planet.userData.identity;
    const radius = satellite.size;
    const { distance, offset } = focusFraming(radius, panelWidth, panelHeight);
    satellite.frameDistance = distance;
    const direction = camera.position.clone().sub(satellite.position).normalize();
    direction.y = Math.max(0.15, direction.y);
    direction.normalize();
    const destination = satellite.position.clone().addScaledVector(direction, distance);
    controls.minDistance = radius * 1.6;
    controls.maxDistance = Math.max(radius * 30, distance * 2.5);
    camera.near = Math.min(0.025, radius * 0.08);
    camera.updateProjectionMatrix();
    onFocusChange({ phase: 'travelling', id, identity });
    return new Promise(resolve => {
      pendingFlight = { id, resolve };
      moveCamera(destination, 2100, false, {
        target: satellite.position, offset, arc: true,
        complete() {
          controls.enabled = true;
          const completedFlight = pendingFlight;
          pendingFlight = null;
          onFocusChange({ phase: 'focused', id, identity });
          completedFlight.resolve({ arrived: true, id, identity });
        }
      });
    });
  }
  if (!motionQuery.matches) {
    camera.position.copy(initialCamera).multiplyScalar(1.28);
    moveCamera(initialCamera, 2200);
  }

  let previous = performance.now(), frame, destroyed = false, lastPositionUpdate = 0, hasRendered = false;
  function render(now) {
    if (destroyed) return;
    const delta = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    if (!paused) {
      elapsed += delta;
      if (!focusState && !cruise && !manualAnchor) orbitTime += delta;
    }
    nebula.material.uniforms.time.value = elapsed;
    starMaterial.uniforms.time.value = elapsed;
    diskMaterial.uniforms.time.value = elapsed;
    diskVeil.material.uniforms.time.value = elapsed;
    particleMaterial.uniforms.time.value = elapsed;
    if (cruise) updateCruise(delta);
    else if (cameraMove) {
      const move = cameraMove;
      const t = Math.min(1, (now - move.start) / move.duration);
      const ease = t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
      if (move.control) {
        camera.position.copy(move.from).multiplyScalar((1 - ease) ** 2)
          .addScaledVector(move.control, 2 * (1 - ease) * ease)
          .addScaledVector(move.to, ease ** 2);
      } else camera.position.lerpVectors(move.from, move.to, ease);
      controls.target.lerpVectors(move.fromTarget, move.toTarget, ease);
      viewOffset.lerpVectors(move.fromOffset, move.toOffset, ease);
      applyViewOffset();
      if (move.warp) {
        const swoop = Math.sin(Math.PI * t);
        camera.position.multiplyScalar(1 - swoop * 0.5);
        camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), swoop * 0.8);
      }
      camera.lookAt(controls.target);
      if (t === 1) { cameraMove = null; move.complete(); }
    } else controls.update();
    coreGlow.quaternion.copy(camera.quaternion);
    laneRoot.updateMatrixWorld(true);
    const beaconPosition = beacons.geometry.attributes.position;
    const beaconColor = beacons.geometry.attributes.color;
    const beaconSize = beacons.geometry.attributes.aSize;
    const lightingAnchor = focusState || cruise?.target || manualAnchor;
    for (const satellite of satellites) {
      const { lane, radius, height: laneHeight } = lanes[satellite.laneIndex];
      const angle = satellite.angle + orbitTime * (0.007 + satellite.laneIndex * 0.002);
      world.set(Math.cos(angle) * radius, laneHeight + Math.sin(angle * 2) * 0.16, Math.sin(angle) * radius);
      lane.localToWorld(world);
      satellite.position.copy(world);
      const active = (!filtered || filtered.has(satellite.id)) && (!focusedGroup || focusedGroup === satellite.group);
      const highlighted = satellite.id === selected || satellite.id === hovered;
      satellite.planet.position.copy(world);
      satellite.planet.visible = active || satellite === lightingAnchor;
      updateProjectPlanet(satellite.planet, elapsed);
      transform.position.copy(world);
      transform.rotation.set(0, 0, 0);
      transform.scale.setScalar(Math.max(0.28, satellite.size) / 0.33);
      transform.updateMatrix();
      pickMesh.setMatrixAt(satellite.index, transform.matrix);
      beaconPosition.setXYZ(satellite.index, world.x, world.y, world.z);
      color.set(satellite.color).multiplyScalar(satellite === lightingAnchor ? 0 : active ? highlighted ? 1.8 : 1.1 : 0.08);
      beaconColor.setXYZ(satellite.index, color.r, color.g, color.b);
      beaconSize.setX(satellite.index, satellite.size * (highlighted ? 155 : 120));
    }
    pickMesh.instanceMatrix.needsUpdate = true;
    pickMesh.computeBoundingSphere();
    beaconPosition.needsUpdate = beaconColor.needsUpdate = beaconSize.needsUpdate = true;
    const focus = satellites.find(satellite => satellite.id === (hovered || selected));
    selection.visible = Boolean(focus) && !lightingAnchor;
    if (focus) {
      selection.position.copy(focus.position);
      selection.quaternion.copy(camera.quaternion);
      selectionOuter.rotation.z = elapsed * 0.12;
    }
    focusLightingBlend = motionQuery.matches ? Number(Boolean(lightingAnchor)) : THREE.MathUtils.lerp(focusLightingBlend, Number(Boolean(lightingAnchor)), 1 - Math.exp(-delta * 4));
    hemisphere.intensity = THREE.MathUtils.lerp(1.25, 0.35, focusLightingBlend);
    sunLight.intensity = THREE.MathUtils.lerp(110, 26.4, focusLightingBlend);
    blueLight.intensity = THREE.MathUtils.lerp(2.5, 1.05, focusLightingBlend);
    inspectionLight.intensity = lightingAnchor ? 2.1 * focusLightingBlend : 0;
    if (lightingAnchor) {
      focusView.copy(camera.position).sub(lightingAnchor.position).normalize();
      focusRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
      focusUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
      inspectionLight.position.copy(lightingAnchor.position).addScaledVector(focusView, 6.8).addScaledVector(focusRight, -5.6).addScaledVector(focusUp, 3.6);
      inspectionLight.target.position.copy(lightingAnchor.position);
      blueLight.position.copy(lightingAnchor.position).addScaledVector(focusView, -5).addScaledVector(focusRight, 3).addScaledVector(focusUp, 2);
      blueLight.target.position.copy(lightingAnchor.position);
    } else {
      blueLight.position.set(-7, 6, 9);
      blueLight.target.position.set(0, 0, 0);
    }
    camera.updateMatrixWorld();
    projected.set(0, 0, 0).project(camera);
    world.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
    coreMask.uniforms.center.value.set(projected.x * 0.5 + 0.5, projected.y * 0.5 + 0.5);
    coreMask.uniforms.radius.value = !lightingAnchor && world.z < 0 ? 1.26 / (2 * -world.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) : 0;
    coreMask.uniforms.aspect.value = camera.aspect;
    composer.render();
    if (!hasRendered) { hasRendered = true; onReady({ webgl: true }); }
    if (now - lastPositionUpdate > 80) {
      lastPositionUpdate = now;
      camera.updateMatrixWorld();
      onProjectPositions(satellites.map(satellite => {
        projected.copy(satellite.position).project(camera);
        const visible = !focusState && !cruise && projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && (!filtered || filtered.has(satellite.id)) && (!focusedGroup || focusedGroup === satellite.group);
        return { id: satellite.id, x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height, visible };
      }));
    }
    frame = requestAnimationFrame(render);
  }
  frame = requestAnimationFrame(render);

  return {
    setProjects,
    setSelected(id) { selected = id; },
    setFilter(ids) { filtered = ids ? new Set(ids) : null; },
    setPaused(value) { paused = value; },
    startCruise,
    stopCruise,
    focusProject,
    reset() { focusedGroup = null; returnToOverview(); },
    focusGroup(group) {
      const index = groupNames.indexOf(group);
      const destination = initialCamera.clone();
      if (index >= 0) destination.applyAxisAngle(new THREE.Vector3(0, 1, 0), (index % lanes.length - 1.5) * 0.18);
      returnToOverview(destination);
      focusedGroup = group;
    },
    warp() { focusedGroup = null; returnToOverview(initialCamera, true); },
    destroy() {
      stopCruise({ takeover: false });
      cancelFlight();
      destroyed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      canvas.removeEventListener('pointermove', handleMove);
      canvas.removeEventListener('pointerdown', handleDown);
      canvas.removeEventListener('pointerup', handleUp);
      canvas.removeEventListener('pointerleave', handleLeave);
      canvas.removeEventListener('pointerdown', takeOverCruise, true);
      canvas.removeEventListener('wheel', takeOverCruise, true);
      for (const satellite of satellites) {
        scene.remove(satellite.planet);
        disposeProjectPlanet(satellite.planet);
      }
      const geometries = new Set(), materials = new Set();
      scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      composer.dispose();
      renderer.dispose();
    }
  };
}
