import * as THREE from 'three'

type Particle = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  size: number
  color: THREE.Color
  gravity: number
}

type Ring = {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  life: number
  maxLife: number
  from: number
  to: number
  active: boolean
}

type Flash = { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; life: number; maxLife: number; active: boolean }

const MAX_PARTICLES = 700

/** Lightweight CPU particle system plus pooled shockwave rings and flashes. */
export class Effects {
  private readonly particles: Particle[] = []
  private readonly geometry: THREE.BufferGeometry
  private readonly positions: Float32Array
  private readonly colors: Float32Array
  private readonly sizes: Float32Array
  private readonly points: THREE.Points
  private readonly material: THREE.ShaderMaterial
  private readonly rings: Ring[] = []
  private readonly flashes: Flash[] = []
  private readonly slashes: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; life: number; maxLife: number; active: boolean }[] = []
  private readonly group = new THREE.Group()

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(MAX_PARTICLES * 3)
    this.colors = new Float32Array(MAX_PARTICLES * 3)
    this.sizes = new Float32Array(MAX_PARTICLES)
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1))
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTexture: { value: createParticleTexture() } },
      vertexShader: /* glsl */ `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (320.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTexture;
        varying vec3 vColor;
        void main() {
          vec4 tex = texture2D(uTexture, gl_PointCoord);
          if (tex.a < 0.02) discard;
          gl_FragColor = vec4(vColor, tex.a);
        }`,
      vertexColors: true,
    })
    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 6
    this.group.add(this.points)

    for (let i = 0; i < 14; i += 1) {
      const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), material)
      mesh.rotation.x = -Math.PI / 2
      mesh.visible = false
      mesh.renderOrder = 5
      this.group.add(mesh)
      this.rings.push({ mesh, material, life: 0, maxLife: 1, from: 1, to: 1, active: false })
    }
    for (let i = 0; i < 8; i += 1) {
      const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material)
      mesh.visible = false
      this.group.add(mesh)
      this.flashes.push({ mesh, material, life: 0, maxLife: 1, active: false })
    }
    for (let i = 0; i < 6; i += 1) {
      const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.5, 16, 1, -0.9, 1.8), material)
      mesh.visible = false
      this.group.add(mesh)
      this.slashes.push({ mesh, material, life: 0, maxLife: 1, active: false })
    }
    scene.add(this.group)
  }

  /** Burst of sparks at a point. */
  burst(position: THREE.Vector3, color: string, count = 14, speed = 5, size = 0.5, gravity = -9): void {
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= MAX_PARTICLES) break
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8))
      this.particles.push({
        x: position.x,
        y: position.y,
        z: position.z,
        vx: dir.x,
        vy: dir.y,
        vz: dir.z,
        life: 0.35 + Math.random() * 0.5,
        maxLife: 0.85,
        size: size * (0.6 + Math.random() * 0.8),
        color: c.clone().offsetHSL((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.15),
        gravity,
      })
    }
  }

  /** Rising motes used for healing and buffs. */
  rise(position: THREE.Vector3, color: string, count = 10, radius = 0.8): void {
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= MAX_PARTICLES) break
      const angle = Math.random() * Math.PI * 2
      this.particles.push({
        x: position.x + Math.cos(angle) * radius * Math.random(),
        y: position.y + Math.random() * 0.4,
        z: position.z + Math.sin(angle) * radius * Math.random(),
        vx: Math.cos(angle) * 0.35,
        vy: 1.6 + Math.random() * 1.4,
        vz: Math.sin(angle) * 0.35,
        life: 0.9 + Math.random() * 0.5,
        maxLife: 1.4,
        size: 0.35 + Math.random() * 0.3,
        color: c.clone(),
        gravity: 0.6,
      })
    }
  }

  ring(position: THREE.Vector3, radius: number, color: string, duration = 0.45): void {
    const ring = this.rings.find(r => !r.active)
    if (!ring) return
    ring.active = true
    ring.life = duration
    ring.maxLife = duration
    ring.from = Math.max(0.2, radius * 0.25)
    ring.to = radius
    ring.material.color.set(color)
    ring.mesh.position.set(position.x, position.y + 0.08, position.z)
    ring.mesh.scale.setScalar(ring.from)
    ring.mesh.visible = true
  }

  flash(position: THREE.Vector3, radius: number, color: string, duration = 0.28): void {
    const flash = this.flashes.find(f => !f.active)
    if (!flash) return
    flash.active = true
    flash.life = duration
    flash.maxLife = duration
    flash.material.color.set(color)
    flash.mesh.position.copy(position)
    flash.mesh.scale.setScalar(radius)
    flash.mesh.visible = true
  }

  explosion(position: THREE.Vector3, radius: number, color: string): void {
    this.flash(position, radius * 0.55, color, 0.3)
    this.ring(position, radius, color, 0.5)
    this.burst(position, color, Math.min(40, 10 + Math.round(radius * 4)), 4 + radius, 0.6, -6)
  }

  /** Melee arc that follows the swing direction. */
  slash(position: THREE.Vector3, facing: number, reach: number, color: string): void {
    const slash = this.slashes.find(s => !s.active)
    if (!slash) return
    slash.active = true
    slash.life = 0.22
    slash.maxLife = 0.22
    slash.material.color.set(color)
    slash.mesh.position.set(position.x, position.y + 1.1, position.z)
    slash.mesh.rotation.set(0, facing, Math.PI / 2)
    slash.mesh.scale.setScalar(Math.max(0.8, reach * 0.55))
    slash.mesh.visible = true
  }

  levelUp(position: THREE.Vector3): void {
    this.ring(position, 4.5, '#ffd166', 0.9)
    this.ring(position, 3, '#fff3c4', 0.7)
    this.rise(position, '#ffd166', 40, 1.2)
    this.flash(position.clone().setY(position.y + 1), 1.6, '#fff3c4', 0.6)
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }
      p.vy += p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      p.vx *= 1 - 1.6 * dt
      p.vz *= 1 - 1.6 * dt
    }
    const count = this.particles.length
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      if (i < count) {
        const p = this.particles[i]
        this.positions[i * 3] = p.x
        this.positions[i * 3 + 1] = p.y
        this.positions[i * 3 + 2] = p.z
        const fade = Math.max(0, p.life / p.maxLife)
        this.colors[i * 3] = p.color.r * fade
        this.colors[i * 3 + 1] = p.color.g * fade
        this.colors[i * 3 + 2] = p.color.b * fade
        this.sizes[i] = p.size * (0.5 + fade * 0.5)
      } else {
        this.sizes[i] = 0
      }
    }
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.color.needsUpdate = true
    this.geometry.attributes.size.needsUpdate = true

    for (const ring of this.rings) {
      if (!ring.active) continue
      ring.life -= dt
      const t = 1 - Math.max(0, ring.life) / ring.maxLife
      const radius = ring.from + (ring.to - ring.from) * t
      ring.mesh.scale.setScalar(radius)
      ring.material.opacity = (1 - t) * 0.85
      if (ring.life <= 0) {
        ring.active = false
        ring.mesh.visible = false
      }
    }
    for (const flash of this.flashes) {
      if (!flash.active) continue
      flash.life -= dt
      const t = 1 - Math.max(0, flash.life) / flash.maxLife
      flash.material.opacity = (1 - t) * 0.55
      flash.mesh.scale.setScalar(flash.mesh.scale.x * (1 + dt * 1.4))
      if (flash.life <= 0) {
        flash.active = false
        flash.mesh.visible = false
      }
    }
    for (const slash of this.slashes) {
      if (!slash.active) continue
      slash.life -= dt
      const t = 1 - Math.max(0, slash.life) / slash.maxLife
      slash.material.opacity = (1 - t) * 0.9
      slash.mesh.rotation.z = Math.PI / 2 - t * 1.2
      if (slash.life <= 0) {
        slash.active = false
        slash.mesh.visible = false
      }
    }
  }

  clear(): void {
    this.particles.length = 0
    for (const ring of this.rings) {
      ring.active = false
      ring.mesh.visible = false
    }
    for (const flash of this.flashes) {
      flash.active = false
      flash.mesh.visible = false
    }
    for (const slash of this.slashes) {
      slash.active = false
      slash.mesh.visible = false
    }
  }
}

function createParticleTexture(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.7)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
