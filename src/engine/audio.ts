/**
 * Web Audio mixer with music and SFX buses. Browsers only allow audio after a user gesture, so
 * call `unlock()` from the first click/key press. Every sound is synthesized: no asset downloads.
 */
export type Sfx =
  | 'pickup' | 'jump' | 'land' | 'hurt' | 'ui' | 'win' | 'lose' | 'dash'
  | 'sword' | 'hit' | 'heavy' | 'block' | 'parry' | 'cast' | 'fire' | 'ice' | 'lightning'
  | 'arrow' | 'coin' | 'levelup' | 'death' | 'heal' | 'open' | 'quest' | 'roar' | 'boss'

export class Audio {
  readonly ctx: AudioContext
  private master: GainNode
  private music: GainNode
  private sfx: GainNode
  private musicTimer = 0
  private musicOn = false
  private buffers = new Map<string, AudioBuffer>()
  private noiseBuffer: AudioBuffer
  private openingSource?: AudioBufferSourceNode
  private openingGain?: GainNode
  private openingRequest = 0

  constructor() {
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.music = this.ctx.createGain()
    this.sfx = this.ctx.createGain()
    this.music.connect(this.master)
    this.sfx.connect(this.master)
    this.master.connect(this.ctx.destination)
    this.noiseBuffer = this.buildNoise()
  }

  private buildNoise(): AudioBuffer {
    const length = Math.floor(this.ctx.sampleRate * 0.6)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
    return buffer
  }

  unlock(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** Volumes in 0..1. */
  setVolumes(music: number, sfx: number, muted = false): void {
    const t = this.ctx.currentTime
    this.music.gain.setTargetAtTime(muted ? 0 : music * 0.55, t, 0.05)
    this.sfx.gain.setTargetAtTime(muted ? 0 : sfx * 0.8, t, 0.05)
  }

  async load(url: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(url)
    if (cached) return cached
    const data = await (await fetch(url)).arrayBuffer()
    const buffer = await this.ctx.decodeAudioData(data)
    this.buffers.set(url, buffer)
    return buffer
  }

  get openingPlaying(): boolean {
    return Boolean(this.openingSource)
  }

  playBuffer(buffer: AudioBuffer, bus: 'music' | 'sfx' = 'sfx', loop = false): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = loop
    src.connect(bus === 'music' ? this.music : this.sfx)
    src.start()
    return src
  }

  async playOpening(url: string, onEnded?: () => void): Promise<void> {
    this.unlock()
    this.stopOpening(0)
    const request = ++this.openingRequest
    try {
      const buffer = await this.load(url)
      if (request !== this.openingRequest) return
      if (this.ctx.state !== 'running') {
        onEnded?.()
        return
      }
      const source = this.ctx.createBufferSource()
      const gain = this.ctx.createGain()
      source.buffer = buffer
      gain.gain.setValueAtTime(0, this.ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.78, this.ctx.currentTime + 1.2)
      source.connect(gain).connect(this.music)
      this.openingSource = source
      this.openingGain = gain
      source.onended = () => {
        if (this.openingSource !== source) return
        this.openingSource = undefined
        this.openingGain = undefined
        onEnded?.()
      }
      source.start()
    } catch (error) {
      console.warn('A trilha da introdução não pôde ser carregada:', error)
      if (request === this.openingRequest) onEnded?.()
    }
  }

  stopOpening(fadeSeconds = 0.8): void {
    this.openingRequest += 1
    const source = this.openingSource
    const gain = this.openingGain
    if (!source || !gain) return
    this.openingSource = undefined
    this.openingGain = undefined
    const now = this.ctx.currentTime
    const fade = Math.max(0, fadeSeconds)
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    if (fade === 0) source.stop()
    else {
      gain.gain.linearRampToValueAtTime(0, now + fade)
      source.stop(now + fade + 0.03)
    }
  }

  private noise(duration: number, volume: number, frequency: number, q = 1, type: BiquadFilterType = 'bandpass', delay = 0): void {
    const t = this.ctx.currentTime + delay
    const source = this.ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.setValueAtTime(frequency, t)
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.35), t + duration)
    filter.Q.value = q
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    source.connect(filter).connect(gain).connect(this.sfx)
    source.start(t)
    source.stop(t + duration + 0.02)
  }

  play(name: Sfx): void {
    if (this.ctx.state !== 'running') return
    const t = this.ctx.currentTime
    const tone = (freq: number, end: number, dur: number, type: OscillatorType, vol: number, delay = 0) => {
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      o.type = type
      o.frequency.setValueAtTime(freq, t + delay)
      o.frequency.exponentialRampToValueAtTime(Math.max(end, 20), t + delay + dur)
      g.gain.setValueAtTime(0.0001, t + delay)
      g.gain.exponentialRampToValueAtTime(vol, t + delay + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur)
      o.connect(g).connect(this.sfx)
      o.start(t + delay)
      o.stop(t + delay + dur + 0.05)
    }
    switch (name) {
      case 'pickup': tone(880, 1320, 0.12, 'triangle', 0.35); tone(1320, 1760, 0.16, 'sine', 0.25, 0.06); break
      case 'jump': tone(300, 620, 0.14, 'square', 0.12); break
      case 'land': tone(160, 70, 0.1, 'sine', 0.25); break
      case 'hurt': tone(220, 90, 0.28, 'sawtooth', 0.22); this.noise(0.16, 0.16, 700); break
      case 'ui': tone(660, 700, 0.06, 'triangle', 0.18); break
      case 'dash': tone(500, 180, 0.18, 'sawtooth', 0.1); this.noise(0.18, 0.08, 900); break
      case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.01, 0.3, 'triangle', 0.25, i * 0.11)); break
      case 'lose': [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 0.38, 'sine', 0.25, i * 0.16)); break
      case 'sword': this.noise(0.14, 0.2, 2600, 1.2, 'bandpass'); tone(320, 140, 0.12, 'sawtooth', 0.05); break
      case 'hit': this.noise(0.1, 0.24, 900, 0.9); tone(160, 60, 0.1, 'square', 0.12); break
      case 'heavy': this.noise(0.28, 0.32, 420, 0.8); tone(120, 40, 0.32, 'sine', 0.3); break
      case 'block': this.noise(0.12, 0.22, 1800, 2.2); tone(520, 300, 0.1, 'square', 0.12); break
      case 'parry': tone(1200, 1800, 0.16, 'triangle', 0.22); this.noise(0.12, 0.16, 3200, 2.4); break
      case 'cast': tone(420, 900, 0.26, 'sine', 0.16); tone(640, 1200, 0.3, 'triangle', 0.1, 0.04); break
      case 'fire': this.noise(0.4, 0.2, 1200, 0.7, 'lowpass'); tone(180, 90, 0.4, 'sawtooth', 0.1); break
      case 'ice': tone(1400, 2200, 0.2, 'sine', 0.14); this.noise(0.24, 0.1, 4200, 3, 'highpass'); break
      case 'lightning': this.noise(0.18, 0.26, 5200, 1.6, 'highpass'); tone(1800, 400, 0.18, 'square', 0.1); break
      case 'arrow': this.noise(0.12, 0.12, 2200, 1.4); tone(700, 300, 0.1, 'triangle', 0.06); break
      case 'coin': tone(1046, 1568, 0.1, 'square', 0.14); tone(1568, 2093, 0.14, 'sine', 0.1, 0.05); break
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f * 1.005, 0.34, 'triangle', 0.22, i * 0.1)); break
      case 'death': [330, 262, 196, 131].forEach((f, i) => tone(f, f * 0.96, 0.5, 'sine', 0.24, i * 0.18)); break
      case 'heal': tone(660, 990, 0.3, 'sine', 0.16); tone(990, 1320, 0.32, 'triangle', 0.1, 0.08); break
      case 'open': this.noise(0.2, 0.14, 600, 1.2); tone(220, 320, 0.18, 'triangle', 0.1); break
      case 'quest': [660, 880, 1100].forEach((f, i) => tone(f, f, 0.26, 'triangle', 0.18, i * 0.09)); break
      case 'roar': tone(140, 60, 0.7, 'sawtooth', 0.3); this.noise(0.7, 0.22, 320, 0.7); break
      case 'boss': tone(70, 50, 1.2, 'sawtooth', 0.28); this.noise(1, 0.2, 220, 0.6); break
    }
  }

  /** Generative ambient pad: slow chord changes on a pentatonic set, scheduled ahead of time. */
  startMusic(): void {
    if (this.musicOn) return
    this.musicOn = true
    const chords = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 261.6, 329.6]]
    let bar = 0
    const schedule = () => {
      if (!this.musicOn) return
      const t = this.ctx.currentTime + 0.05
      const chord = chords[bar % chords.length]
      for (const f of chord) {
        for (const detune of [-6, 6]) {
          const o = this.ctx.createOscillator()
          const g = this.ctx.createGain()
          o.type = 'sine'
          o.frequency.value = f / 2
          o.detune.value = detune
          g.gain.setValueAtTime(0.0001, t)
          g.gain.linearRampToValueAtTime(0.05, t + 1.2)
          g.gain.linearRampToValueAtTime(0.0001, t + 4.2)
          o.connect(g).connect(this.music)
          o.start(t)
          o.stop(t + 4.4)
        }
      }
      // A sparse bell keeps the ambience from feeling static.
      if (bar % 2 === 0) {
        const bell = this.ctx.createOscillator()
        const bellGain = this.ctx.createGain()
        bell.type = 'triangle'
        bell.frequency.value = chord[2] * 2
        bellGain.gain.setValueAtTime(0.0001, t + 0.6)
        bellGain.gain.linearRampToValueAtTime(0.035, t + 0.8)
        bellGain.gain.exponentialRampToValueAtTime(0.0001, t + 3.4)
        bell.connect(bellGain).connect(this.music)
        bell.start(t + 0.6)
        bell.stop(t + 3.6)
      }
      bar += 1
      this.musicTimer = window.setTimeout(schedule, 3600)
    }
    schedule()
  }

  stopMusic(): void {
    this.musicOn = false
    clearTimeout(this.musicTimer)
  }
}
