import * as THREE from 'three';

// The field lives in continuous 3D direction space. Sphere UVs, longitude and
// latitude never enter the shader, so neither a meridian nor a pole is special.
export function createNebulaBackground() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float time;
      varying vec3 vDirection;

      float cloudHash(vec3 p) {
        p = fract(p * .1031);
        p += dot(p,p.yzx + 33.33);
        return fract((p.x+p.y)*p.z);
      }

      float cloudNoise(vec3 p) {
        vec3 i=floor(p),f=fract(p);
        f=f*f*(3.-2.*f);
        return mix(
          mix(mix(cloudHash(i),cloudHash(i+vec3(1,0,0)),f.x),
              mix(cloudHash(i+vec3(0,1,0)),cloudHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(cloudHash(i+vec3(0,0,1)),cloudHash(i+vec3(1,0,1)),f.x),
              mix(cloudHash(i+vec3(0,1,1)),cloudHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }

      float cloudFbm(vec3 p) {
        float value=0.,amplitude=.5;
        mat3 turn=mat3(.00,.80,.60,-.80,.36,-.48,-.60,-.48,.64);
        for(int i=0;i<4;i++) {
          value+=amplitude*cloudNoise(p);
          p=turn*p*2.07+vec3(7.1,3.7,11.8);
          amplitude*=.5;
        }
        return value/0.9375;
      }

      void main() {
        vec3 d=normalize(vDirection);
        vec3 drift=vec3(time*.0008,time*.0012,-time*.0005);
        float n=cloudFbm(d*3.3+vec3(2.7,5.1,-1.9)+drift);
        vec3 warped=d*10.5+vec3(n*2.1,-n*1.35,n*.75);
        float tendrils=cloudFbm(warped+drift*.43);
        float wisps=cloudNoise(d*31.+vec3(tendrils*4.)+drift*.7);

        float belt=exp(-pow((d.y+.12+sin(d.x*3.)*.1)*3.3,2.));
        float clouds=pow(n*.65+tendrils*.35,2.1)*(.3+1.5*belt);
        float plume=pow(max(0.,tendrils-.3),1.45)*belt;
        float rifts=smoothstep(.48,.73,n)*(1.-smoothstep(.24,.44,tendrils))*belt;
        vec3 cold=mix(vec3(.023,.075,.12),vec3(.16,.065,.25),smoothstep(-.5,.55,d.x));
        vec3 color=vec3(.0015,.003,.009)+cold*(clouds*1.4+plume*2.4);
        color+=vec3(.05,.18,.24)*pow(n,5.)*belt*2.3;
        color+=vec3(.18,.085,.035)*clouds*exp(-pow(d.y*5.,2.))*.7;
        color*=1.-rifts*.5;
        color+=cold*pow(wisps,5.)*belt*.12;
        float grain=cloudHash(vec3(gl_FragCoord.xy,17.))*.0018;
        gl_FragColor=vec4(color*.65+grain,1.);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(95,40,24),material);
  mesh.rotation.y=.7;
  return mesh;
}
