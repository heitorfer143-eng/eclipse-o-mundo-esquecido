import * as THREE from 'three'
import { SEA_LEVEL } from './terrain'

const VERTEX = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec3 p = position;
  float w = sin(p.x * 0.055 + uTime * 0.9) * 0.22 + sin(p.z * 0.083 - uTime * 1.15) * 0.18 + sin((p.x + p.z) * 0.031 + uTime * 0.6) * 0.12;
  p.y += w;
  float dx = cos(p.x * 0.055 + uTime * 0.9) * 0.055 * 0.22 + cos((p.x + p.z) * 0.031 + uTime * 0.6) * 0.031 * 0.12;
  float dz = cos(p.z * 0.083 - uTime * 1.15) * 0.083 * 0.18 + cos((p.x + p.z) * 0.031 + uTime * 0.6) * 0.031 * 0.12;
  vNormal = normalize(vec3(-dx, 1.0, -dz));
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`

const FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uNight;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - max(dot(viewDir, normalize(vNormal)), 0.0), 2.4);
  vec3 color = mix(uDeep, uShallow, 0.35 + 0.3 * sin(vWorld.x * 0.02 + uTime * 0.4));
  color = mix(color, uSky, fresnel * 0.55);
  vec3 halfDir = normalize(viewDir + normalize(uSunDirection));
  float spec = pow(max(dot(normalize(vNormal), halfDir), 0.0), 180.0);
  color += uSunColor * spec * (1.0 - uNight) * 1.6;
  float sparkle = pow(max(dot(normalize(vNormal), halfDir), 0.0), 24.0) * 0.12;
  color += uSunColor * sparkle * (1.0 - uNight);
  float alpha = mix(0.82, 0.95, fresnel);
  gl_FragColor = vec4(color, alpha);
}`

/** One large animated plane covers the ocean and every inland lake below sea level. */
export class Water {
  readonly mesh: THREE.Mesh
  private readonly uniforms: Record<string, THREE.IUniform>
  private time = 0

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.PlaneGeometry(6000, 6000, 120, 120)
    geometry.rotateX(-Math.PI / 2)
    this.uniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#0d3a49') },
      uShallow: { value: new THREE.Color('#2d7f8c') },
      uSky: { value: new THREE.Color('#a9cfe6') },
      uSunDirection: { value: new THREE.Vector3(0.4, 0.8, 0.2) },
      uSunColor: { value: new THREE.Color('#fff2cc') },
      uNight: { value: 0 },
    }
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.position.y = SEA_LEVEL
    this.mesh.renderOrder = 2
    this.mesh.receiveShadow = false
    this.mesh.frustumCulled = false
    scene.add(this.mesh)
  }

  update(dt: number, camera: THREE.PerspectiveCamera, sunDirection: THREE.Vector3, sunColor: THREE.Color, night: number, sky: THREE.Color): void {
    this.time += dt
    this.uniforms.uTime.value = this.time
    this.uniforms.uSunDirection.value.copy(sunDirection)
    this.uniforms.uSunColor.value.copy(sunColor)
    this.uniforms.uNight.value = night
    this.uniforms.uSky.value.copy(sky)
    // Keep the plane centred on the camera so the horizon never ends.
    this.mesh.position.x = camera.position.x
    this.mesh.position.z = camera.position.z
  }
}
