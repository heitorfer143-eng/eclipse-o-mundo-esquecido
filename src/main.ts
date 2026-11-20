import './styles/main.css'
import * as THREE from 'three'
import { Assets } from './engine/assets'
import { Audio } from './engine/audio'
import { Input } from './engine/input'
import { SaveStore } from './engine/save'
import { CameraRig } from './game/camera'
import { Game, type GameInput } from './game/game'
import { questById } from './game/data/questData'
import type { ElementId } from './game/data/types'
import { applyHouseTextures, type HouseTextureSet } from './game/world/houseTextures'
import { applyWorldTextures } from './game/world/worldTextures'
import type { ChunkTextureSet } from './game/world/chunks'
import { World } from './game/world/world'
import { Ui } from './ui/ui'

const TIPS = [
  'Segure o botão direito para bloquear: um aparo no momento exato abre o inimigo para o contra-ataque.',
  'Elementos reagem entre si. Congele um inimigo e acerte-o com raio.',
  'Colete ervas, minérios e madeira: a bancada de alquimia transforma isso em sobrevivência.',
  'Santuários marcam seu ponto de retorno e restauram vida e mana.',
  'A noite traz criaturas mais fortes — e melhores recompensas.',
  'Cada arma tem um ritmo. A adaga pune pelas costas, o espadão pune a paciência.',
]
const HOUSE_MODEL_ASSETS = [
  'assets/models/houses/shuriken-cottage.glb',
  'assets/models/houses/shuriken-tavern.glb',
  'assets/models/houses/shuriken-blacksmith.glb',
  'assets/models/houses/low-poly-medieval-house.glb',
  'assets/models/houses/low-poly-city-house-building-low.glb',
  'assets/models/houses/gable-house.glb',
]
const HOUSE_TEXTURE_ASSETS = {
  wood: 'assets/textures/houses/wood-planks.webp',
  stone: 'assets/textures/houses/stone-blocks.webp',
  plaster: 'assets/textures/houses/plaster.webp',
  roof: 'assets/textures/houses/roof-shingles.webp',
} as const
const WORLD_TEXTURE_ASSETS = {
  grass: 'assets/textures/world/grass-meadow.webp',
  leaves: 'assets/textures/tree-leaves.webp',
  bark: HOUSE_TEXTURE_ASSETS.wood,
  stone: 'assets/textures/castle-stone.webp',
  rock: HOUSE_TEXTURE_ASSETS.stone,
} as const

function createWorldSeed(): number {
  const values = new Uint32Array(1)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values)
  else values[0] = Math.floor(Math.random() * 0x1_0000_0000) >>> 0
  return values[0] || 1
}

const ELEMENT_KEYS: Record<string, ElementId> = {
  Digit1: 'fogo', Digit2: 'gelo', Digit3: 'raio', Digit4: 'terra', Digit5: 'vento', Digit6: 'sombra',
}

async function boot(): Promise<void> {
  const bootStartedAt = performance.now()
  const canvas = document.querySelector<HTMLCanvasElement>('#game')!
  const uiRoot = document.querySelector<HTMLElement>('#ui')!
  const save = new SaveStore()
  const launchUrl = new URL(window.location.href)
  const resumeCampaignOnBoot = launchUrl.searchParams.get('eclipseResume') === '1'
  if (resumeCampaignOnBoot) {
    launchUrl.searchParams.delete('eclipseResume')
    window.history.replaceState({}, '', launchUrl)
  }
  const audio = new Audio()
  const input = new Input(canvas)
  const camera = new CameraRig(window.innerWidth / window.innerHeight)

  const loading = buildLoading()
  document.body.appendChild(loading.root)
  const opening = questById('principal-01')
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)]
  loading.tip.textContent = opening ? `${opening.summary} ${tip}` : tip
  const setProgress = (value: number, label: string): void => {
    loading.fill.style.width = `${Math.round(value * 100)}%`
    loading.label.textContent = label
  }
  const nextFrame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()))

  setProgress(0.06, 'Acendendo o renderizador')
  const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !touchDevice, powerPreference: 'high-performance' })
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  applyQuality(renderer, save.data.settings.quality)
  await nextFrame()

  setProgress(0.2, 'Acordando o fragmento de Aether')
  const assets = new Assets()
  let houseModels: (THREE.Object3D | null)[] = []
  const stopAssetProgress = assets.onProgress(progress => {
    setProgress(0.2 + progress * 0.28, `Carregando modelos ${Math.round(progress * 100)}%`)
  })
  try {
    const housePromises: Promise<THREE.Object3D | null>[] = HOUSE_MODEL_ASSETS.map(path => assets.gltf(`${import.meta.env.BASE_URL}${path}`)
      .then(gltf => gltf.scene as THREE.Object3D)
      .catch(error => {
        console.warn(`Casa externa indisponível; será usada a casa procedural: ${path}`, error)
        return null
      }))
    const textureEntries = Object.entries(HOUSE_TEXTURE_ASSETS) as [keyof HouseTextureSet, string][]
    const texturePromises = textureEntries.map(async ([key, path]) => {
      try {
        return [key, await assets.texture(`${import.meta.env.BASE_URL}${path}`, { repeat: 1 })] as const
      } catch (error) {
        console.warn(`Textura de casa indisponível; serão mantidos os materiais base: ${path}`, error)
        return null
      }
    })
    const worldTextureEntries = Object.entries(WORLD_TEXTURE_ASSETS) as [keyof typeof WORLD_TEXTURE_ASSETS, string][]
    const worldTexturePromises = worldTextureEntries.map(async ([key, path]) => {
      try {
        return [key, await assets.texture(`${import.meta.env.BASE_URL}${path}`, { repeat: 1 })] as const
      } catch (error) {
        console.warn(`Textura de mundo indisponível; será usado o material base: ${path}`, error)
        return null
      }
    })
    const [loadedModels, loadedTextures, loadedWorldTextures] = await Promise.all([
      Promise.all(housePromises), Promise.all(texturePromises), Promise.all(worldTexturePromises),
    ])
    const textureSet = loadedTextures.every(entry => entry !== null)
      ? Object.fromEntries(loadedTextures) as HouseTextureSet
      : null
    if (textureSet) {
      for (const model of loadedModels.slice(0, 3)) if (model) applyHouseTextures(model, textureSet)
    }
    if (loadedWorldTextures.every(entry => entry !== null)) {
      applyWorldTextures(Object.fromEntries(loadedWorldTextures) as ChunkTextureSet)
    }
    houseModels = loadedModels
  } finally {
    stopAssetProgress()
  }
  setProgress(0.5, 'Semeando um novo Aetherion')
  const world = new World(save.data.game?.seed ?? save.activeCampaign?.seed ?? createWorldSeed(), save.data.settings.quality, undefined, houseModels)
  await nextFrame()

  setProgress(0.62, 'Plantando florestas e ruínas')
  await nextFrame()

  let game!: Game
  const ui = new Ui(uiRoot, save, {
    onOpeningPlay: () => {
      audio.unlock()
      void audio.playOpening(`${import.meta.env.BASE_URL}assets/audio/eclipse-opening.mp3`)
    },
    onOpeningStop: () => audio.stopOpening(),
    onNewGame: profile => {
      const campaignId = save.createCampaign(profile, createWorldSeed())
      if (!campaignId) {
        window.alert('Já existe uma campanha ativa. Continue essa jornada ou exclua o único save antes de criar outra.')
        ui.showTitle()
        return
      }
      const next = new URL(window.location.href)
      next.searchParams.set('eclipseResume', '1')
      window.location.assign(next.toString())
    },
    onContinue: campaignId => {
      const previousId = save.data.activeCampaignId
      if (!save.activateCampaign(campaignId)) return
      if (previousId !== campaignId) {
        const next = new URL(window.location.href)
        next.searchParams.set('eclipseResume', '1')
        window.location.assign(next.toString())
        return
      }
      startGame(false, true, true)
    },
    onSettingsChanged: settings => {
      applyQuality(renderer, settings.quality)
      game.applySettings(settings)
    },
    onCharacterProfileChanged: profile => game.applyCharacterProfile(profile),
  })

  setProgress(0.84, 'Acordando os habitantes')
  game = new Game({
    world,
    camera,
    ui,
    audio,
    save,
    onQuit: () => {
      audio.stopOpening()
      audio.stopMusic()
      game.toTitle()
      ui.showTitle()
      input.unlockPointer()
    },
    onPauseRequest: () => input.unlockPointer(),
    onResumeRequest: () => {
      audio.unlock()
      input.lockPointer()
    },
  })
  await nextFrame()
  setProgress(1, 'Pronto')
  await nextFrame()
  const minimumLoadingMs = 1400
  const remainingLoadingMs = Math.max(0, minimumLoadingMs - (performance.now() - bootStartedAt))
  if (remainingLoadingMs > 0) await new Promise<void>(resolve => window.setTimeout(resolve, remainingLoadingMs))
  loading.root.style.opacity = '0'
  window.setTimeout(() => loading.root.remove(), 700)

  let started = false
  let suppressAutomaticPauseUntil = 0
  const startGame = (fresh: boolean, requestPointerLock = true, openingMusic = false): void => {
    audio.unlock()
    if (openingMusic) {
      audio.stopMusic()
      void audio.playOpening(`${import.meta.env.BASE_URL}assets/audio/eclipse-opening.mp3`, () => audio.startMusic())
    } else {
      audio.stopOpening()
      audio.startMusic()
    }
    started = true
    suppressAutomaticPauseUntil = performance.now() + 1800
    game.start(fresh)
    if (ui.blocking || !requestPointerLock) input.unlockPointer()
    else input.lockPointer()
  }

  // ── input plumbing ──────────────────────────────────────────────────────
  let mouseAttack = false
  let mouseBlock = false
  let attackPressed = false
  let jumpPressed = false
  let jumpHeld = false

  canvas.addEventListener('mousedown', event => {
    audio.unlock()
    if (ui.blocking || game.mode !== 'playing') return
    if (document.pointerLockElement !== canvas) {
      input.lockPointer()
      return
    }
    if (event.button === 0) {
      mouseAttack = true
      attackPressed = true
    } else if (event.button === 2) {
      mouseBlock = true
    }
  })
  window.addEventListener('mouseup', event => {
    if (event.button === 0) mouseAttack = false
    if (event.button === 2) mouseBlock = false
  })
  canvas.addEventListener('contextmenu', event => event.preventDefault())

  window.addEventListener('keydown', event => {
    audio.unlock()
    if (event.repeat || ui.blocking || game.mode !== 'playing') return
    if (event.code === 'Space') {
      jumpPressed = true
      jumpHeld = true
    }
    if (event.code === 'KeyJ') {
      attackPressed = true
      mouseAttack = true
    }
    if (event.code === 'KeyQ') mouseBlock = true
    if (event.code === 'KeyH') game.usePotion()
    if (event.code === 'Tab') {
      event.preventDefault()
      game.openPanel('inventario')
    }
    if (event.code === 'KeyK') game.openPanel('habilidades')
    if (event.code === 'KeyM') game.openPanel('mapa')
    if (event.code === 'KeyL') game.openPanel('missoes')
    if (event.code === 'KeyZ') game.castAbility(0)
    if (event.code === 'KeyX') game.castAbility(1)
    if (event.code === 'KeyC') game.castAbility(2)
    const element = ELEMENT_KEYS[event.code]
    if (element) game.selectElement(element)
  })
  window.addEventListener('keyup', event => {
    if (event.code === 'Space') jumpHeld = false
    if (event.code === 'KeyJ') mouseAttack = false
    if (event.code === 'KeyQ') mouseBlock = false
  })

  let userInteractedSinceBoot = false
  window.addEventListener('pointerdown', () => { userInteractedSinceBoot = true }, { capture: true, passive: true })
  window.addEventListener('keydown', () => { userInteractedSinceBoot = true }, { capture: true })
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) return
    if (performance.now() < suppressAutomaticPauseUntil) return
    if (game.mode === 'playing' && !ui.blocking && started && userInteractedSinceBoot) game.pause()
  })

  const resizeViewport = (): void => {
    const width = Math.max(1, Math.round(window.visualViewport?.width ?? document.documentElement.clientWidth ?? window.innerWidth))
    const height = Math.max(1, Math.round(window.visualViewport?.height ?? document.documentElement.clientHeight ?? window.innerHeight))
    const root = document.documentElement
    if (root.style.getPropertyValue('--app-width') !== `${width}px`) root.style.setProperty('--app-width', `${width}px`)
    if (root.style.getPropertyValue('--app-height') !== `${height}px`) root.style.setProperty('--app-height', `${height}px`)
    if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) renderer.setSize(width, height, false)
    camera.resize(width, height)
  }
  const onOrientationChange = (): void => {
    ui.touch.resetInputs()
    requestAnimationFrame(resizeViewport)
    window.setTimeout(resizeViewport, 180)
  }
  resizeViewport()
  window.addEventListener('resize', resizeViewport)
  window.visualViewport?.addEventListener('resize', resizeViewport)
  window.visualViewport?.addEventListener('scroll', resizeViewport)
  window.addEventListener('orientationchange', onOrientationChange)
  window.addEventListener('pageshow', resizeViewport)

  // iOS Safari can still start browser gestures outside individual controls.
  // Keep ordinary one-finger gameplay input intact; block only pinch/double-tap gestures.
  document.addEventListener('touchmove', event => {
    if (event.touches.length > 1) event.preventDefault()
  }, { passive: false })
  for (const gesture of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(gesture, event => event.preventDefault(), { passive: false })
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.mode === 'playing' && userInteractedSinceBoot
      && performance.now() >= suppressAutomaticPauseUntil) game.pause()
    else resizeViewport()
  })

  // ── main loop ───────────────────────────────────────────────────────────
  let last = performance.now()
  let accumulator = 0
  let fpsAccum = 0
  let fpsFrames = 0
  const fixed = 1 / 60
  const previewOrbitCenter = new THREE.Vector3()
  const orbitCharacterPreview = (time: number): void => {
    const mobilePreview = window.innerWidth <= 640
    previewOrbitCenter.copy(game.player.position)
    if (mobilePreview) previewOrbitCenter.y -= 0.75
    camera.orbit(time, previewOrbitCenter, mobilePreview ? 6.2 : 7.5)
  }

  const loop = (now: number): void => {
    const raw = Math.min(0.1, (now - last) / 1000)
    last = now
    fpsAccum += raw
    fpsFrames += 1
    if (fpsAccum > 0.5) {
      game.setFps(Math.round(fpsFrames / fpsAccum))
      fpsAccum = 0
      fpsFrames = 0
    }

    input.sensitivity = save.data.settings.sensitivity
    input.invertY = save.data.settings.invertY
    input.update(raw)
    const look = input.takeLook()
    world.updateAmbient(raw, started ? game.position : world.spawn)

    if (!started) {
      if (ui.characterCustomizationVisible) orbitCharacterPreview(now / 1000)
      else camera.orbit(now / 1000, world.spawn, 32)
    } else if (game.mode === 'playing' && !ui.blocking) {
      accumulator += raw
      let steps = 0
      while (accumulator >= fixed && steps < 4) {
        const touchMove = ui.touch.move
        const touchLook = ui.consumeTouchLook()
        const touchJumpPressed = ui.consumeTouch('jump')
        const touchRollPressed = ui.consumeTouch('roll')
        const touchAttackPressed = ui.consumeTouch('attack')
        const touchInteractPressed = ui.consumeTouch('interact')
        const intent: GameInput = {
          moveX: clamp(input.move.x + touchMove.x, -1, 1),
          moveY: clamp(input.move.y - touchMove.y, -1, 1),
          sprint: input.held('sprint'),
          jumpPressed: jumpPressed || input.pressed('jump') || touchJumpPressed,
          jumpHeld: jumpHeld || input.held('jump') || ui.heldTouch('jump'),
          rollPressed: input.pressed('dash') || touchRollPressed,
          attackPressed: attackPressed || touchAttackPressed,
          attackHeld: mouseAttack || ui.heldTouch('attack'),
          blockHeld: mouseBlock || ui.heldTouch('block'),
          // Mouse deltas are already converted to radians; takeLook applies
          // sensitivity and vertical inversion once. Touch deltas are pixels.
          lookX: look.x + touchLook.x * 0.0045 * save.data.settings.sensitivity,
          lookY: look.y + touchLook.y * 0.0045 * save.data.settings.sensitivity * (save.data.settings.invertY ? -1 : 1),
          interact: input.consume('interact') || touchInteractPressed,
        }
        game.update(fixed, intent)
        attackPressed = false
        jumpPressed = false
        accumulator -= fixed
        steps += 1
      }
    } else {
      accumulator = 0
      if (started && game.mode === 'paused') {
        if (ui.characterCustomizationVisible) orbitCharacterPreview(now / 1000)
        else if (!game.dialogue.npc) camera.orbit(now / 1000, game.position, 10)
      }
    }

    if (ui.consumeTouch('ability0') && game.mode === 'playing' && !ui.blocking) game.castAbility(0)
    if (ui.consumeTouch('ability1') && game.mode === 'playing' && !ui.blocking) game.castAbility(1)
    if (ui.consumeTouch('ability2') && game.mode === 'playing' && !ui.blocking) game.castAbility(2)
    if (ui.consumeTouch('potion') && game.mode === 'playing' && !ui.blocking) game.usePotion()
    if (input.consume('pause') && game.mode === 'playing' && !ui.blocking) {
      input.unlockPointer()
      game.pause()
    }
    if (ui.consumeTouch('pause') && game.mode === 'playing' && !ui.blocking) {
      input.unlockPointer()
      game.pause()
    }

    renderer.render(world.scene, camera.camera)
    input.endFrame()
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  if (resumeCampaignOnBoot && save.activeCampaign) startGame(false, false)
  else ui.showTitle()
  const localSmoke = window.location.hostname === '127.0.0.1' && new URLSearchParams(window.location.search).has('smoke')
  if (import.meta.env.DEV || localSmoke) {
    ;(window as unknown as { __eclipse: unknown }).__eclipse = { game, ui, save, world, input, renderer, camera, audio }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function applyQuality(renderer: THREE.WebGLRenderer, quality: 'low' | 'medium' | 'high'): void {
  const ratio = window.devicePixelRatio || 1
  const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  // Retina phones render many more pixels than desktop displays; cap the internal
  // resolution to keep frame times and battery use under control.
  const pixelRatio = quality === 'low' ? 1 : touchDevice
    ? Math.min(ratio, quality === 'medium' ? 1.05 : 1.18)
    : quality === 'medium' ? Math.min(ratio, 1.35) : Math.min(ratio, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.shadowMap.enabled = quality !== 'low'
  renderer.setSize(window.visualViewport?.width ?? window.innerWidth, window.visualViewport?.height ?? window.innerHeight, false)
}

function buildLoading(): { root: HTMLDivElement; fill: HTMLDivElement; label: HTMLDivElement; tip: HTMLDivElement } {
  const root = document.createElement('div')
  root.className = 'loading'
  root.innerHTML = `
    <div class="loading__sigil"></div>
    <h1 class="loading__title">Eclipse</h1>
    <div class="loading__sub">O Mundo Esquecido</div>
    <div class="loading__bar"><div class="loading__fill"></div></div>
    <div class="loading__tip"></div>`
  return {
    root,
    fill: root.querySelector<HTMLDivElement>('.loading__fill')!,
    label: root.querySelector<HTMLDivElement>('.loading__sub')!,
    tip: root.querySelector<HTMLDivElement>('.loading__tip')!,
  }
}

boot().catch(error => {
  console.error(error)
  const el = document.getElementById('ui')
  if (el) el.innerHTML = `<div class="fatal" style="padding:24px;font-family:system-ui">Falha ao iniciar: ${String((error as Error)?.message ?? error).replace(/[<>&]/g, '')}</div>`
})
