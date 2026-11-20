import * as THREE from 'three'
import { clamp, smoothstep } from '../core/math'

const SKY_VERTEX = /* glsl */ `
  varying vec3 vSkyDirection;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    // Keep the sky direction independent of the dome's camera-following translation.
    vSkyDirection = mat3(modelMatrix) * position;
  gl_Position = projectionMatrix * viewMatrix * world;
}`

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform float uNight;
varying vec3 vSkyDirection;
void main() {
  vec3 dir = normalize(vSkyDirection);
  float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 color = mix(uHorizon, uTop, pow(h, 0.85));
  float sun = max(dot(dir, normalize(uSunDirection)), 0.0);
  color += uSunColor * pow(sun, 220.0) * 1.6;
  color += uSunColor * pow(sun, 12.0) * 0.18;
  // Horizon glow at dawn and dusk.
  float glow = pow(1.0 - abs(dir.y), 6.0) * (1.0 - uNight);
  color += uSunColor * glow * 0.22;
  // A faint, stationary veil in the upper night sky; inexpensive layered bands.
  float auroraWave = 0.5 + 0.5 * sin(dir.x * 9.0 + dir.z * 4.0 + sin(dir.z * 7.0));
  float auroraBand = smoothstep(0.16, 0.32, dir.y) * (1.0 - smoothstep(0.62, 0.82, dir.y));
  vec3 auroraColor = mix(vec3(0.025, 0.11, 0.18), vec3(0.12, 0.16, 0.25), auroraWave);
  color += auroraColor * auroraBand * uNight * 0.28;
  gl_FragColor = vec4(color, 1.0);
}`

/** Day/night cycle, sun/moon lighting, stars and drifting clouds. */
export class Sky {
  readonly group = new THREE.Group()
  readonly sun: THREE.DirectionalLight
  readonly hemi: THREE.HemisphereLight
  readonly ambient: THREE.AmbientLight
  /** 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
  timeOfDay = 0.32
  /** Seconds for a full day. */
  dayLength = 780
  readonly sunDirection = new THREE.Vector3(0, 1, 0)
  private readonly dome: THREE.Mesh
  private readonly uniforms: { uTop: { value: THREE.Color }; uHorizon: { value: THREE.Color }; uSunColor: { value: THREE.Color }; uSunDirection: { value: THREE.Vector3 }; uNight: { value: number } }
  private readonly stars: THREE.Points
  private readonly starMaterial: THREE.PointsMaterial
  private readonly moon: THREE.Mesh
  private readonly clouds: THREE.Group
  private readonly fogColor = new THREE.Color()
  private readonly cloudTint = new THREE.Color()
  private readonly topDay = new THREE.Color('#3d7fc6')
  private readonly topNight = new THREE.Color('#07101f')
  private readonly horizonDay = new THREE.Color('#c9e3f5')
  private readonly horizonNight = new THREE.Color('#18243b')
  private readonly duskColor = new THREE.Color('#ff8a5a')
  private readonly duskTop = new THREE.Color('#5a3a72')
  private readonly warmSun = new THREE.Color('#fff2cc')
  private readonly lowSun = new THREE.Color('#8fa6ff')
  private readonly sunDay = new THREE.Color('#ffe9b8')
  private readonly sunHorizon = new THREE.Color('#ff9d6b')
  private readonly sunNight = new THREE.Color('#9fb6ff')
  private readonly hemiDay = new THREE.Color('#9ec4ff')
  private readonly hemiNight = new THREE.Color('#456687')
  private readonly groundDay = new THREE.Color('#40502f')
  private readonly groundNight = new THREE.Color('#384962')
  private readonly ambientDay = new THREE.Color('#93a8c9')
  private readonly ambientNight = new THREE.Color('#7188a9')
  private readonly white = new THREE.Color('#ffffff')
  private readonly fogNight = new THREE.Color('#243a58')
  private readonly fog: THREE.FogExp2
  private weatherFog = 0
  private weatherTint: THREE.Color | null = null

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.SphereGeometry(1400, 32, 20)
    this.uniforms = {
      uTop: { value: new THREE.Color('#3f7fc4') },
      uHorizon: { value: new THREE.Color('#cfe6f7') },
      uSunColor: { value: new THREE.Color('#fff0c4') },
      uSunDirection: { value: new THREE.Vector3(0.4, 0.6, 0.2) },
      uNight: { value: 0 },
    }
    const material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
    this.dome = new THREE.Mesh(geometry, material)
    this.dome.frustumCulled = false
    this.dome.renderOrder = -10
    this.group.add(this.dome)

    this.sun = new THREE.DirectionalLight('#ffe7b0', 2.4)
    this.sun.castShadow = true
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 260
    this.sun.shadow.camera.left = -60
    this.sun.shadow.camera.right = 60
    this.sun.shadow.camera.top = 60
    this.sun.shadow.camera.bottom = -60
    this.sun.shadow.bias = -0.0008
    this.sun.shadow.normalBias = 0.05
    this.group.add(this.sun)
    this.group.add(this.sun.target)

    this.hemi = new THREE.HemisphereLight('#bcd7ff', '#3c4a34', 0.7)
    this.ambient = new THREE.AmbientLight('#7e8fb8', 0.35)
    this.group.add(this.hemi, this.ambient)

    const starPositions = new Float32Array(1800 * 3)
    for (let i = 0; i < 1800; i += 1) {
      const u = Math.random() * Math.PI * 2
      const v = Math.acos(Math.random() * 0.95)
      const r = 1150
      starPositions[i * 3] = Math.sin(v) * Math.cos(u) * r
      starPositions[i * 3 + 1] = Math.abs(Math.cos(v)) * r
      starPositions[i * 3 + 2] = Math.sin(v) * Math.sin(u) * r
    }
    const starGeometry = new THREE.BufferGeometry()
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    this.starMaterial = new THREE.PointsMaterial({ color: '#e8f0ff', size: 1.9, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })
    this.stars = new THREE.Points(starGeometry, this.starMaterial)
    this.stars.frustumCulled = false
    this.group.add(this.stars)

    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(26, 20, 14),
      new THREE.MeshBasicMaterial({ color: '#e8edff', fog: false }),
    )
    this.moon.frustumCulled = false
    this.group.add(this.moon)

    this.clouds = new THREE.Group()
    const cloudTexture = createCloudTexture()
    for (let i = 0; i < 22; i += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture, transparent: true, opacity: 0.5, depthWrite: false, fog: false }))
      const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.5
      const radius = 260 + Math.random() * 620
      sprite.position.set(Math.cos(angle) * radius, 150 + Math.random() * 130, Math.sin(angle) * radius)
      const s = 90 + Math.random() * 150
      sprite.scale.set(s, s * 0.55, 1)
      this.clouds.add(sprite)
    }
    this.group.add(this.clouds)

    scene.add(this.group)
    this.fog = new THREE.FogExp2('#cfe0ec', 0.0035)
    scene.fog = this.fog
  }

  setQuality(shadowMapSize: number): void {
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    this.sun.shadow.map?.dispose()
    this.sun.shadow.map = null
  }

  /** Weather hooks: fog density and a colour tint layered over the day palette. */
  setWeather(fog: number, tint: THREE.Color | null): void {
    this.weatherFog = fog
    this.weatherTint = tint
  }

  get night(): number {
    return this.uniforms.uNight.value
  }

  get horizonColor(): THREE.Color {
    return this.uniforms.uHorizon.value
  }

  update(dt: number, camera: THREE.PerspectiveCamera, focus: THREE.Vector3): void {
    this.timeOfDay = (this.timeOfDay + dt / this.dayLength) % 1
    const t = this.timeOfDay
    const angle = (t - 0.25) * Math.PI * 2
    const sunY = Math.sin(angle)
    const sunX = Math.cos(angle) * 0.85
    const sunZ = Math.cos(angle) * 0.32
    this.sunDirection.set(sunX, sunY, sunZ).normalize()

    const elevation = clamp(sunY, -1, 1)
    const day = smoothstep(-0.12, 0.25, elevation)
    const dusk = 1 - Math.abs(clamp(elevation * 3.2, -1, 1))
    const night = 1 - day

    // Palette
    this.uniforms.uTop.value.copy(this.topDay).lerp(this.topNight, night).lerp(this.duskTop, dusk * 0.35)
    const horizon = this.uniforms.uHorizon.value.copy(this.horizonDay).lerp(this.horizonNight, night).lerp(this.duskColor, dusk * 0.55)
    this.uniforms.uSunColor.value.copy(elevation > 0 ? this.warmSun : this.lowSun).lerp(this.duskColor, dusk * 0.5)
    this.uniforms.uSunDirection.value.copy(this.sunDirection)
    this.uniforms.uNight.value = night

    // Lighting
    this.sun.position.copy(focus).addScaledVector(this.sunDirection, 120)
    this.sun.target.position.copy(focus)
    this.sun.target.updateMatrixWorld()
    this.sun.intensity = 0.4 + day * 2.25
    this.sun.color.copy(day > 0.2 ? this.sunDay : this.sunHorizon).lerp(this.sunNight, night * 0.9)
    this.hemi.intensity = 0.78 - day * 0.05
    this.hemi.color.copy(this.hemiDay).lerp(this.hemiNight, night)
    this.hemi.groundColor.copy(this.groundDay).lerp(this.groundNight, night)
    this.ambient.intensity = 0.35 + night * 0.23
    this.ambient.color.copy(this.ambientDay).lerp(this.ambientNight, night)

    this.starMaterial.opacity = clamp(night * 1.1 - 0.12, 0, 0.78)
    this.moon.position.copy(camera.position).addScaledVector(this.sunDirection, -800)
    this.moon.visible = night > 0.05

    this.dome.position.copy(camera.position)
    this.stars.position.copy(camera.position)

    // Clouds drift and tint with the sky.
    this.clouds.position.x = (this.clouds.position.x + dt * 1.6) % 900
    this.cloudTint.copy(this.white).lerp(this.horizonNight, night * 0.85).lerp(this.duskColor, dusk * 0.25)
    for (const cloud of this.clouds.children) {
      const material = (cloud as THREE.Sprite).material as THREE.SpriteMaterial
      material.color.copy(this.cloudTint)
      material.opacity = 0.18 + day * 0.32
    }

    // Fog: palette horizon colour, pushed by weather.
    this.fogColor.copy(horizon).lerp(this.white, 0.08).lerp(this.fogNight, night * 0.55)
    if (this.weatherTint) this.fogColor.lerp(this.weatherTint, 0.55)
    this.fog.color.copy(this.fogColor)
    this.fog.density = 0.0022 + this.weatherFog + night * 0.0005
  }
}

function createCloudTexture(): THREE.Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
