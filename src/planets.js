import * as THREE from 'three';

const TAU = Math.PI * 2;
const TYPES = [
  { label: '蔚蓝海洋星', colors: ['#061d39', '#2487b5', '#8c9d69', '#e2d6ab'], accent: '#8dc8e8' },
  { label: '风暴气态星', colors: ['#40325e', '#9b72a3', '#e3c2c7', '#b194e0'], accent: '#ceaff2' },
  { label: '流沙荒漠星', colors: ['#6b3b22', '#be8b52', '#e5c593', '#f5e2b8'], accent: '#e7c49a' },
  { label: '熔岩火山星', colors: ['#16151c', '#48333a', '#ff6c1d', '#ffda7d'], accent: '#ff9b56' },
  { label: '极地冰川星', colors: ['#16476b', '#63a6bd', '#bce0e5', '#edf6f3'], accent: '#b7e6f3' },
  { label: '虹彩晶体星', colors: ['#30254c', '#7466ab', '#b9a2e8', '#c5ecee'], accent: '#c9b4f1' },
  { label: '辉光生态星', colors: ['#052b34', '#126f78', '#55dac5', '#c3f0b2'], accent: '#77e2cb' },
  { label: '钛金工程星', colors: ['#273744', '#6f8692', '#a5bdc6', '#66dbe8'], accent: '#8edbe6' },
];

function hashSeed(value) {
  let seed = 2166136261;
  for (let i = 0; i < value.length; i++) seed = Math.imul(seed ^ value.charCodeAt(i), 16777619);
  return seed >>> 0;
}

function generator(seed) {
  return () => {
    seed += 0x6D2B79F5;
    let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

const noiseGLSL = /* glsl */`
  float phash(vec3 p) {
    p = fract(p * .1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float pnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(mix(phash(i),phash(i+vec3(1,0,0)),f.x),
                   mix(phash(i+vec3(0,1,0)),phash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(phash(i+vec3(0,0,1)),phash(i+vec3(1,0,1)),f.x),
                   mix(phash(i+vec3(0,1,1)),phash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float pfbm(vec3 p) {
    float value = 0., amplitude = .53;
    mat3 turn = mat3(.00,.80,.60,-.80,.36,-.48,-.60,-.48,.64);
    for (int i=0;i<5;i++) {
      value += amplitude * pnoise(p);
      p = turn * p * 2.06 + vec3(7.1,3.7,11.8);
      amplitude *= .48;
    }
    return value;
  }
`;

const surfaceGLSL = /* glsl */`
  uniform float pSeed;
  uniform float pType;
  uniform float pVariation;
  uniform vec3 pColor0;
  uniform vec3 pColor1;
  uniform vec3 pColor2;
  uniform vec3 pColor3;
  varying vec3 vPlanetPoint;
  varying vec3 vPlanetWorld;
  varying vec3 vPlanetNormal;
  ${noiseGLSL}
  void planetSurface(vec3 direction, out vec3 color, out vec3 glow, out float elevation,
                     out float surfaceRoughness, out float surfaceMetalness) {
    vec3 p = normalize(direction);
    vec3 offset = vec3(pSeed * .73, pSeed * .27 + 9.1, pSeed * .41);
    float large = pfbm(p * (2.8 + pVariation * 1.6) + offset);
    float folds = pfbm(p * 9.3 + offset + large * 2.2);
    float micro = pnoise(p * 117. + offset);
    float latitude = abs(p.y);
    float longitude = atan(p.z,p.x);
    float night = 1. - smoothstep(-.18,.25,dot(normalize(vPlanetNormal),normalize(vec3(0.,.15,0.)-vPlanetWorld)));
    glow = vec3(0.);
    elevation = large * .35 + folds * .12 + micro * .025;
    surfaceRoughness = .76;
    surfaceMetalness = .02;
    if (pType < .5) {
      float waterline = .46 + pVariation * .085;
      float land = smoothstep(waterline-.014,waterline+.025,large);
      float coast = smoothstep(waterline-.013,waterline+.007,large)
                  * (1.-smoothstep(waterline+.01,waterline+.04,large));
      vec3 sea = mix(pColor0,pColor1,smoothstep(.22,waterline,large));
      vec3 earth = mix(pColor2,pColor3,smoothstep(.41,.78,folds));
      color = mix(sea,earth,land) + pColor3 * coast * .12;
      float ice = smoothstep(.78,.94,latitude + (folds-.5)*.12);
      color = mix(color,vec3(.74,.86,.89),ice*.82);
      surfaceRoughness = mix(.18,.88,land);
      elevation = land * (large*.48 + folds*.2) + micro*.007;
      float cities = pow(pnoise(p*238.+offset),22.) * land * (1.-ice)
                   * smoothstep(.35,.53,folds) * night;
      glow = pColor3 * cities * .9;
    } else if (pType < 1.5) {
      float flow = pfbm(p*4.3+offset);
      float bands = sin(asin(p.y)*(32.+pVariation*31.) + flow*8.5
                    + sin(longitude*3.+pSeed)*.65)*.5+.5;
      float fineBands = sin(p.y*187.+flow*15.)*.5+.5;
      color = mix(pColor0,pColor1,smoothstep(.05,.8,bands));
      color = mix(color,pColor2,pow(bands,5.)*.7);
      color = mix(color,pColor3,fineBands*.15*flow);
      vec3 stormCenter = normalize(vec3(sin(pSeed),-.25+pVariation*.4,cos(pSeed)));
      float storm = exp(-pow(length((p-stormCenter)*vec3(1.8,4.5,1.8))*3.8,2.));
      float spiral = sin(length(p-stormCenter)*75.-longitude*7.+flow*4.);
      color = mix(color,mix(pColor1,pColor2,spiral*.35+.5),storm*.82);
      elevation = bands*.025 + fineBands*.015;
      surfaceRoughness = .91;
    } else if (pType < 2.5) {
      float dunes = sin(longitude*(93.+pVariation*60.)+p.y*60.+folds*13.)*.5+.5;
      float basins = smoothstep(.31,.46,large);
      color = mix(pColor0,pColor1,smoothstep(.25,.65,large));
      color = mix(color,pColor2,pow(dunes,3.)*.16);
      color = mix(pColor3,color,basins*.86+.14);
      float crater = 0.;
      for(int i=0;i<6;i++) {
        float index=float(i)+pSeed;
        vec3 center=normalize(vec3(phash(vec3(index,2,8)),phash(vec3(index,9,4)),phash(vec3(index,5,1)))*2.-1.);
        float radius=.055+phash(vec3(index,4,6))*.12;
        float dist=length(p-center)/radius;
        crater += exp(-pow((dist-1.)*9.,2.))*.13-exp(-dist*dist*4.)*.09;
      }
      color *= .9 + dunes*.08 + crater;
      elevation = large*.4 + dunes*.045 + crater*.5 + micro*.025;
      surfaceRoughness = .94;
    } else if (pType < 3.5) {
      float crust = pfbm(p*6.4+offset+folds*1.2);
      float fissure = 1.-smoothstep(.018,.073,abs(crust-(.43+pVariation*.08)));
      float core = pow(fissure,5.);
      color = mix(pColor0,pColor1,folds*.68) * (.74+micro*.34);
      color = mix(color,pColor2,fissure*.22);
      glow = mix(pColor2,pColor3,core) * (fissure*.3+core*1.5);
      elevation = crust*.42 - fissure*.14 + micro*.04;
      surfaceRoughness = .82-fissure*.35;
      surfaceMetalness = .16;
    } else if (pType < 4.5) {
      float plates = pfbm(p*5.7+offset);
      float cracks = 1.-smoothstep(.012,.055,abs(plates-.49));
      float frost = pow(folds,.65);
      color = mix(pColor1,pColor3,smoothstep(.22,.7,large));
      color = mix(color,pColor0,cracks*.75);
      color += pColor2 * frost * .1;
      elevation = folds*.25 + micro*.045 - cracks*.1;
      surfaceRoughness = .27 + frost*.32;
      surfaceMetalness = .07;
      glow = pColor1 * cracks * .035;
    } else if (pType < 5.5) {
      float planes = abs(sin(p.x*13.+offset.x)*sin(p.y*11.+offset.y)*sin(p.z*14.+offset.z));
      float crystal = pow(1.-planes,9.);
      float facets = floor(folds*9.)/9.;
      color = mix(pColor0,pColor1,facets);
      color = mix(color,pColor2,crystal*.6);
      color = mix(color,pColor3,pow(large,4.)*1.8);
      elevation = planes*.2 + facets*.22 + micro*.012;
      surfaceRoughness = .22 + facets*.24;
      surfaceMetalness = .24;
      glow = pColor2 * pow(crystal,3.) * .14;
    } else if (pType < 6.5) {
      float flow = pfbm(p*4.7+offset+folds*1.4);
      float veins = pow(1.-abs(sin(flow*26.+p.y*8.+pSeed)),13.);
      float islands = smoothstep(.37,.62,large);
      color = mix(pColor0,pColor1,islands*.85) * (.76+folds*.4);
      color = mix(color,pColor2,veins*.18);
      float bright = veins * smoothstep(.28,.65,folds);
      glow = mix(pColor2,pColor3,pow(folds,3.)) * (bright*.9+pow(micro,24.)*.22);
      elevation = flow*.33+folds*.12+micro*.015;
      surfaceRoughness = .31 + islands*.32;
      surfaceMetalness = .12;
    } else {
      vec2 uv = vec2(longitude/6.2831853+.5,acos(p.y)/3.14159265);
      vec2 cells = uv*vec2(22.+floor(pVariation*10.),15.);
      vec2 grid = abs(fract(cells)-.5);
      float seam = 1.-smoothstep(.013,.033,min(grid.x,grid.y));
      float panel = phash(vec3(floor(cells),pSeed));
      float circuit = (1.-smoothstep(.012,.025,abs(fract(cells.x*3.)-.5)))
                    * step(.66,phash(vec3(floor(cells*vec2(3.,1.)),pSeed)));
      float latitudeBand = 1.-smoothstep(.005,.018,abs(abs(p.y)-(.32+pVariation*.24)));
      color = mix(pColor0,pColor2,panel*.67+.16) * (.9+micro*.12);
      color = mix(color,pColor0,seam*.78);
      color = mix(color,pColor3,circuit*.2+latitudeBand*.25);
      glow = pColor3*(circuit*.55+latitudeBand*.72)*(.35+night*.65);
      elevation = panel*.17-seam*.12+micro*.005;
      surfaceRoughness = .28+panel*.22;
      surfaceMetalness = .84;
    }
  }
`;

function surfaceMaterial(type, palette, seed, variation) {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: .65, metalness: .08,
    clearcoat: [0, 4, 5].includes(type) ? .36 : 0,
    clearcoatRoughness: .25,
    iridescence: type === 5 ? .62 : 0,
    iridescenceIOR: 1.36,
    iridescenceThicknessMinimum: 120,
    iridescenceThicknessMaximum: 390,
  });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      pSeed: { value: seed % 1501 / 19.7 }, pType: { value: type }, pVariation: { value: variation },
      pColor0: { value: palette[0] }, pColor1: { value: palette[1] },
      pColor2: { value: palette[2] }, pColor3: { value: palette[3] },
    });
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 vPlanetPoint; varying vec3 vPlanetWorld; varying vec3 vPlanetNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vPlanetPoint=normalize(position); vPlanetWorld=(modelMatrix*vec4(position,1.)).xyz;
      vPlanetNormal=normalize(mat3(modelMatrix)*normal);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      ${surfaceGLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 planetColor, planetGlow; float planetHeight, planetRoughness, planetMetalness;
      planetSurface(vPlanetPoint,planetColor,planetGlow,planetHeight,planetRoughness,planetMetalness);
      diffuseColor.rgb=planetColor;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=planetRoughness;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor=planetMetalness;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 pdx=normalize(dFdx(-vViewPosition)),pdy=normalize(dFdy(-vViewPosition));
      vec3 pr1=cross(pdy,normal),pr2=cross(normal,pdx);
      float pdet=dot(pdx,pr1)*faceDirection;
      vec3 pgrad=sign(pdet)*(dFdx(planetHeight)*pr1+dFdy(planetHeight)*pr2);
      normal=normalize(abs(pdet)*normal-pgrad*.42);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=planetGlow;');
  };
  material.customProgramCacheKey = () => 'atlas-procedural-planet-3';
  return material;
}

function sphereGeometry(radius, type, seed, moon = false) {
  const geometry = new THREE.SphereGeometry(radius, moon ? 24 : 56, moon ? 16 : 36);
  if (type === 5 || moon) {
    const positions = geometry.attributes.position;
    const direction = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      direction.fromBufferAttribute(positions, i).normalize();
      const detail = Math.sin(direction.x*17+seed)*Math.sin(direction.y*13+seed*.7)*Math.cos(direction.z*19);
      const scale = 1 + (moon ? .035 : .016) * detail;
      positions.setXYZ(i,direction.x*radius*scale,direction.y*radius*scale,direction.z*radius*scale);
    }
    geometry.computeVertexNormals();
  }
  return geometry;
}

function atmosphere(radius, accent, strength) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius*1.055,40,28),new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { tint: { value: accent }, intensity: { value: strength } },
    vertexShader: /* glsl */`
      varying vec3 vWorld,vNormalWorld;
      void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;
        vNormalWorld=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: /* glsl */`
      uniform vec3 tint;uniform float intensity;varying vec3 vWorld,vNormalWorld;
      void main(){vec3 n=normalize(vNormalWorld),v=normalize(cameraPosition-vWorld);
        float rim=pow(1.-abs(dot(n,v)),2.6);
        float day=smoothstep(-.45,.65,dot(n,normalize(vec3(0.,.15,0.)-vWorld)));
        gl_FragColor=vec4(tint*intensity*(.3+day*.7),rim*.54);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
}

function cloudLayer(radius, seed, type) {
  const material = new THREE.MeshStandardMaterial({ color: type === 6 ? 0x92d6d7 : 0xd8e5ec, transparent: true, opacity: .56, roughness: 1, depthWrite: false });
  material.onBeforeCompile = shader => {
    shader.uniforms.cloudSeed = { value: seed % 809 / 13 };
    shader.vertexShader = shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCloudPoint;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvCloudPoint=normalize(position);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',`#include <common>\nuniform float cloudSeed;varying vec3 vCloudPoint;${noiseGLSL}`)
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
        float cloudNoise=pfbm(vCloudPoint*5.2+vec3(cloudSeed));
        float wisps=pfbm(vCloudPoint*18.+vec3(cloudNoise*2.,cloudSeed,0.));
        diffuseColor.a*=smoothstep(.49,.67,cloudNoise+wisps*.12)*.84;`);
  };
  material.customProgramCacheKey = () => 'atlas-planet-clouds-1';
  return new THREE.Mesh(new THREE.SphereGeometry(radius*1.014,48,32),material);
}

function dustRing(radius, seed, tint, random, industrial) {
  const inner = radius*(industrial ? 1.32 : 1.23+random()*.14);
  const outer = radius*(industrial ? 1.74 : 1.67+random()*.28);
  const material = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { tint: { value: tint }, seed: { value: seed % 997 / 11 }, inner: { value: inner }, outer: { value: outer }, planetRadius: { value: radius }, engineered: { value: industrial ? 1 : 0 } },
    vertexShader: /* glsl */`
      varying vec3 vRingLocal,vRingWorld,vCenter,vRingNormal;varying float vScale;
      void main(){vRingLocal=position;vec4 world=modelMatrix*vec4(position,1.);
        vRingWorld=world.xyz;vCenter=(modelMatrix*vec4(0,0,0,1)).xyz;
        vRingNormal=normalize(mat3(modelMatrix)*normal);vScale=length(modelMatrix[0].xyz);
        gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: /* glsl */`
      uniform vec3 tint;uniform float seed,inner,outer,planetRadius,engineered;
      varying vec3 vRingLocal,vRingWorld,vCenter,vRingNormal;varying float vScale;
      void main(){float radius=length(vRingLocal.xy),r=(radius-inner)/(outer-inner);
        float fine=sin(r*630.+seed)*.5+.5;
        float waves=sin(r*71.+sin(r*190.+seed)*1.3+seed)*.5+.5;
        float gap=smoothstep(.012,.028,abs(r-(.37+sin(seed)*.09)));
        float edge=smoothstep(0.,.04,r)*(1.-smoothstep(.92,1.,r));
        float dust=(.28+waves*.42+fine*.23)*gap*edge;
        if(engineered>.5) dust*=smoothstep(.25,.65,waves);
        vec3 light=normalize(vec3(0.,.15,0.)-vCenter),oc=vRingWorld-vCenter;
        float behind=step(dot(oc,light),0.);
        float distanceToAxis=length(oc-light*dot(oc,light));
        float shadow=1.-behind*(1.-smoothstep(planetRadius*vScale*.9,planetRadius*vScale*1.08,distanceToAxis))*.91;
        float diffuse=.38+abs(dot(normalize(vRingNormal),light))*.62;
        gl_FragColor=vec4(tint*diffuse*shadow*(.85+fine*.2),dust*.74);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(inner,outer,160),material);
  ring.rotation.x = Math.PI/2;
  return ring;
}

export function createProjectPlanet(project) {
  const seed = hashSeed(`${project.path ?? project.relativePath ?? project.id ?? ''}|${project.group ?? ''}|${project.name}`);
  const random = generator(seed);
  let type = Math.floor(random()*TYPES.length);
  let hero;
  if (project.name === 'Nebula Board') { type=0;hero={ label:'蔚蓝协作星',colors:['#041a38','#207ec0','#b49a57','#eddb9b'],accent:'#91c9ff' }; }
  else if (project.name === 'Orbital CAD') { type=7;hero={label:'钛金工程星',accent:'#7bdce9'}; }
  else if (project.name === 'Plasma Lab') { type=6;hero={label:'等离子能源星',colors:['#052a36','#087a80','#4ae9d7','#cef6bd'],accent:'#69e9d7'}; }
  else if (project.name === 'Sand Archive') { type=2;hero={label:'沙海档案星',colors:['#72452c','#c79c69','#e9cea3','#efe3bc'],accent:'#ebc89b'}; }
  else if (project.name === 'Prism Studio') { type=5;hero={label:'虹彩灵感星',colors:['#342244','#7865a2','#c2a4e8','#bce9ec'],accent:'#cfb4f2'}; }
  else if (project.name === 'Aurora Monitor') { type=3;hero={label:'鎏金暗星',colors:['#04221d','#1e4434','#d8ac47','#f7e1a0'],accent:'#e8ca75'}; }
  const variation = random();
  const tintShift = (random()-.5)*.055;
  const palette = (hero?.colors ?? TYPES[type].colors).map(hex => new THREE.Color(hex).offsetHSL(tintShift,(random()-.5)*.09,(random()-.5)*.025));
  const accent = new THREE.Color(hero?.accent ?? TYPES[type].accent).offsetHSL(tintShift,0,0);
  const radius = hero ? .285+random()*.035 : .205+random()*.075;
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.set((random()-.5)*.65,random()*TAU,(random()-.5)*.5);
  group.add(tilt);
  const surface = new THREE.Mesh(sphereGeometry(radius,type,seed),surfaceMaterial(type,palette,seed,variation));
  surface.rotation.y = random()*TAU;
  tilt.add(surface);
  const atmosphereMesh = atmosphere(radius,accent,type === 1 ? .7 : type === 7 ? .48 : .8);
  tilt.add(atmosphereMesh);
  const clouds = type === 0 || type === 6 ? cloudLayer(radius,seed,type) : null;
  if (clouds) { clouds.rotation.y=random()*TAU;tilt.add(clouds); }
  const rings = new THREE.Group();
  rings.rotation.set((random()-.5)*.75,random()*TAU,(random()-.5)*.7);
  tilt.add(rings);
  const hasRing = type === 7 || project.name === 'Sand Archive' || type === 1 && random()>.38 || type === 4 && random()>.63 || !hero && random()>.86;
  if (hasRing) {
    rings.add(dustRing(radius,seed,type===7?accent:palette[2],random,type===7));
    if (type === 7) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(radius*1.78,radius*.0055,6,120),new THREE.MeshStandardMaterial({ color:accent,emissive:accent,emissiveIntensity:.35,roughness:.35,metalness:.75 }));
      rim.rotation.x=Math.PI/2;rings.add(rim);
    }
  }
  const moons = [];
  const moonCount = project.name === 'Prism Studio' ? 2 : !hasRing && random()>.73 ? 1 : 0;
  for (let i=0;i<moonCount;i++) {
    const moonRadius=radius*(.105+random()*.075);
    const moonPalette=['#323c4d','#8997a8','#c0c5c5','#e0dfd4'].map(hex=>new THREE.Color(hex).offsetHSL(tintShift,0,-.02));
    const moon=new THREE.Mesh(sphereGeometry(moonRadius,2,seed+i*17,true),surfaceMaterial(2,moonPalette,seed+i*79,random()));
    const orbit={ mesh:moon,distance:radius*(2.1+i*.65+random()*.3),phase:random()*TAU,inclination:(random()-.5)*.7,speed:.08+random()*.06 };
    moons.push(orbit);tilt.add(moon);
  }
  group.userData.radius=radius;
  group.userData.identity={typeLabel:hero?.label ?? TYPES[type].label,accent:`#${accent.getHexString()}`,seed};
  group.userData.planet={surface,clouds,rings,moons,spin:.035+random()*.025,phase:surface.rotation.y};
  updateProjectPlanet(group,0);
  return group;
}

// Time is the scene's elapsed animation time. The factory root transform stays owned by scene.js.
export function updateProjectPlanet(group,time) {
  const planet=group.userData.planet;
  planet.surface.rotation.y=planet.phase+time*planet.spin;
  if(planet.clouds) planet.clouds.rotation.y=planet.phase+.7+time*planet.spin*1.21;
  for(const orbit of planet.moons) {
    const angle=orbit.phase+time*orbit.speed;
    orbit.mesh.position.set(Math.cos(angle)*orbit.distance,Math.sin(angle)*orbit.distance*Math.sin(orbit.inclination),Math.sin(angle)*orbit.distance*Math.cos(orbit.inclination));
    orbit.mesh.rotation.y=angle*.5;
  }
}

export function disposeProjectPlanet(group) {
  const geometries=new Set(),materials=new Set();
  group.traverse(object=>{
    if(object.geometry) geometries.add(object.geometry);
    for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]) materials.add(material);
  });
  for(const geometry of geometries) geometry.dispose();
  for(const material of materials) material.dispose();
}
