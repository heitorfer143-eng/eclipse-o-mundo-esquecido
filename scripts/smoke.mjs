import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.SMOKE_URL ?? 'http://localhost:5173/'
const OUT = process.env.SHOTS_DIR ?? 'shots'
const errors = []
const pageErrors = []

async function captureScreenshot(page, filename) {
  if (process.env.CAPTURE_SMOKE_SHOTS !== '1') return
  mkdirSync(OUT, { recursive: true })
  try {
    await page.screenshot({ path: `${OUT}/${filename}`, timeout: 8000, animations: 'disabled', scale: 'css' })
  } catch (error) {
    console.warn(`Screenshot opcional ignorado (${filename}): ${error.message}`)
  }
}

const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
page.on('pageerror', error => {
  const message = `pageerror: ${error.message}`
  errors.push(message)
  pageErrors.push(message)
})

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__eclipse?.game, { timeout: 30000 })
await page.waitForTimeout(2500)
await captureScreenshot(page, '01-title.png')
console.log('game object:', await page.evaluate(() => Boolean(window.__eclipse?.game)))

await page.getByRole('button', { name: 'Assistir à introdução' }).click()
await page.locator('.opening-intro').waitFor({ state: 'visible' })
const openingTitle = await page.locator('.opening-intro__title').textContent()
if (openingTitle !== 'O amanhecer foi partido.') throw new Error(`A introdução não abriu no primeiro quadro: ${openingTitle}`)
await page.waitForFunction(() => window.__eclipse.audio.openingPlaying, null, { timeout: 15000 })
await page.getByRole('button', { name: 'Pular introdução' }).click()
await page.locator('.opening-intro').waitFor({ state: 'hidden' })

// New-game flow: exactly one identity, saved before the first story dialogue.
await page.getByRole('button', { name: 'Criar personagem', exact: true }).click()
await page.locator('.opening-intro').waitFor({ state: 'visible' })
await page.waitForFunction(() => window.__eclipse.audio.openingPlaying, null, { timeout: 15000 })
await page.getByRole('button', { name: 'Pular para criar personagem' }).click()
await page.locator('.campaign-intro').waitFor({ state: 'visible' })
await page.getByRole('button', { name: 'Iniciar campanha' }).click()
await page.locator('[data-player-name]').fill('Teste Eclipse')
await page.locator('[data-model="Paladin"]').click()
await page.locator('[data-element="gelo"]').click()
if (await page.locator('[data-aura]').count()) throw new Error('O criador ainda expõe a seleção de cor da aura.')
await captureScreenshot(page, '02-character.png')
await page.getByRole('button', { name: 'Confirmar e começar' }).click()
await page.locator('.dialogue').waitFor({ state: 'visible', timeout: 45000 })
const initialIara = await page.evaluate(() => {
  const g = window.__eclipse.game
  const iara = g.population.npcs.find(npc => npc.def.id === 'iara')
  if (!iara) return { distance: Infinity, cameraSide: Infinity }
  const cameraBackX = Math.sin(g.player.facing)
  const cameraBackZ = Math.cos(g.player.facing)
  return {
    distance: iara.position.distanceTo(g.player.position),
    cameraSide: (iara.position.x - g.player.position.x) * cameraBackX + (iara.position.z - g.player.position.z) * cameraBackZ,
  }
})
if (initialIara.distance > 3.4 || initialIara.cameraSide >= 0) {
  throw new Error(`Iara não iniciou acessível e fora do eixo da câmera: ${JSON.stringify(initialIara)}`)
}
await captureScreenshot(page, '03-iara-dialogue.png')
await page.getByRole('button', { name: 'Aceitar missão: O Despertar' }).click()
await page.getByRole('button', { name: 'Encerrar conversa' }).click()
await page.waitForFunction(() => window.__eclipse.game.mode === 'playing' && window.__eclipse.game.quests.tracked === 'principal-01')
await page.waitForFunction(() => {
  const external = window.__eclipse.game.player.model.external
  let hasShirt = false
  external?.root.traverse(object => {
    if (!object.isMesh) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    if (materials.some(material => material.name === 'Shirt')) hasShirt = true
  })
  return hasShirt
}, null, { timeout: 30000 })
const faunaCount = await page.evaluate(() => window.__eclipse.game.world.chunks.wildlifeAgents().filter(animal => !animal.dead).length)
if (faunaCount < 2) throw new Error(`A fauna não apareceu em quantidade suficiente: ${faunaCount}`)
await page.waitForFunction(() => {
  let loaded = false
  window.__eclipse.game.world.scene.traverse(object => {
    if (object.name !== 'world-rocks' || !object.isInstancedMesh || Array.isArray(object.material)) return
    if (object.material.map?.image?.width) loaded = true
  })
  return loaded
}, null, { timeout: 30000 })
const rockTextureUrl = await page.evaluate(() => {
  let url = ''
  window.__eclipse.game.world.scene.traverse(object => {
    if (object.name !== 'world-rocks' || !object.isInstancedMesh || Array.isArray(object.material)) return
    const image = object.material.map?.image
    if (image?.width) url = image.currentSrc || image.src || ''
  })
  return url
})
if (!rockTextureUrl.includes('stone-blocks.webp')) throw new Error(`As rochas não receberam a textura própria: ${rockTextureUrl}`)
if (await page.evaluate(() => window.__eclipse.game.player.element) !== 'gelo') throw new Error('element specialization did not persist to the campaign')
await page.waitForTimeout(1000)

await page.waitForFunction(() => window.__eclipse.game.world.chunks.wildlifeAgents().some(animal =>
  animal.actions.idle && animal.actions.walk && animal.actions.run && animal.actions.death), null, { timeout: 30000 })
const huntedAnimal = await page.evaluate(() => {
  const g = window.__eclipse.game
  const animal = g.world.chunks.wildlifeAgents().find(candidate => !candidate.dead
    && candidate.actions.idle && candidate.actions.walk && candidate.actions.run && candidate.actions.death)
  if (!animal) throw new Error('Nenhum animal Quaternius animado foi carregado.')
  const before = {
    meat: g.inventory.stacks.find(stack => stack.id === 'comida-carne')?.count ?? 0,
    hide: g.inventory.stacks.find(stack => stack.id === 'mat-couro')?.count ?? 0,
  }
  g.damageArea(animal.worldPosition.clone(), 0, 100000, 'fogo')
  return {
    name: animal.name,
    dead: animal.dead,
    counted: animal.counted,
    deathAnimation: animal.actions.death?.isRunning() ?? false,
    meat: (g.inventory.stacks.find(stack => stack.id === 'comida-carne')?.count ?? 0) - before.meat,
    hide: (g.inventory.stacks.find(stack => stack.id === 'mat-couro')?.count ?? 0) - before.hide,
  }
})
console.log('Quaternius animal hunt:', huntedAnimal)
if (!huntedAnimal.dead || !huntedAnimal.counted || !huntedAnimal.deathAnimation || huntedAnimal.meat < 1 || huntedAnimal.hide < 1) {
  throw new Error(`A fauna não tocou morte/recompensas no combate existente: ${JSON.stringify(huntedAnimal)}`)
}

const lighting = await page.evaluate(() => {
  const g = window.__eclipse.game
  const sky = g.world.sky
  const originalTime = sky.timeOfDay
  sky.timeOfDay = 0.5
  sky.update(0, g.camera.camera, g.player.position)
  const day = { sun: sky.sun.intensity, hemi: sky.hemi.intensity, ambient: sky.ambient.intensity }
  sky.timeOfDay = 0.99
  sky.update(0, g.camera.camera, g.player.position)
  const night = { level: sky.night, sun: sky.sun.intensity, hemi: sky.hemi.intensity, ambient: sky.ambient.intensity, fogDensity: window.__eclipse.game.world.scene.fog.density }
  sky.timeOfDay = originalTime
  sky.update(0, g.camera.camera, g.player.position)
  return { day, night }
})
console.log('day/night lighting:', lighting)
if (lighting.day.sun < 2.6 || lighting.day.hemi < 0.72 || lighting.day.ambient < 0.34
  || lighting.night.level < 0.99 || lighting.night.sun < 0.39 || lighting.night.hemi < 1.75
  || lighting.night.ambient < 1.35 || lighting.night.fogDensity > 0.0022) {
  throw new Error(`A iluminação noturna segue escura ou a luz do dia foi alterada: ${JSON.stringify(lighting)}`)
}
await page.evaluate(() => {
  const g = window.__eclipse.game
  g.world.sky.timeOfDay = 0.99
  g.world.sky.update(0, g.camera.camera, g.player.position)
})
await page.waitForTimeout(150)
await captureScreenshot(page, 'night-lighting.png')
await page.evaluate(() => {
  const g = window.__eclipse.game
  g.world.sky.timeOfDay = 0.3
  g.world.sky.update(0, g.camera.camera, g.player.position)
})

const openingState = await page.evaluate(() => {
  const g = window.__eclipse.game
  const profile = window.__eclipse.save.activeCampaign?.profile
  const equipment = g.inventory.equipment
  const externalMaterials = new Set()
  g.player.model.external?.root.traverse(object => {
    if (!object.isMesh) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) externalMaterials.add(material.name)
  })
  return {
    mode: g.mode,
    profile,
    maxEnemyHeight: Math.max(0, ...g.spawner.enemies.map(enemy => enemy.height)),
    quest: g.quests.state('principal-01')?.status ?? null,
    tracked: g.quests.tracked,
    storyFlags: g.save.data.game?.storyFlags ?? [],
    armorEquipped: Boolean(equipment.armadura || equipment.capacete || equipment.botas),
    playerAuraVisible: g.player.model.root.getObjectByName('character-aura')?.visible ?? false,
    visualGear: g.player.model.visibleGearState,
    externalModelLoaded: Boolean(g.player.model.external),
    externalMaterials: [...externalMaterials],
    activeCampaigns: g.save.data.campaigns.length,
  }
})
console.log('opening state:', openingState)
if (openingState.mode !== 'playing' || openingState.quest !== 'ativa' || openingState.tracked !== 'principal-01') {
  throw new Error(`O aceite da missão inicial não persistiu: ${JSON.stringify(openingState)}`)
}
if (openingState.profile?.name !== 'Teste Eclipse' || openingState.profile.modelId !== 'Paladin') {
  throw new Error(`Perfil inicial deveria manter o Paladino escolhido: ${JSON.stringify(openingState.profile)}`)
}
if (openingState.playerAuraVisible) throw new Error('A aura do protagonista ainda está visível.')
if (openingState.armorEquipped || openingState.activeCampaigns !== 1 || !openingState.storyFlags.includes('iara-intro')
  || !openingState.externalModelLoaded || !openingState.externalMaterials.includes('Shirt') || !openingState.externalMaterials.includes('Pants')) {
  throw new Error('A campanha não começou com uma identidade única, sem armadura e com a introdução marcada.')
}
if (openingState.visualGear.armor || openingState.visualGear.helmet || openingState.visualGear.boots) {
  throw new Error(`O Paladino não começou com roupa civil e sem armadura: ${JSON.stringify(openingState.visualGear)}`)
}
await captureScreenshot(page, 'character-unarmored.png')
const equippedLook = await page.evaluate(() => {
  const model = window.__eclipse.game.player.model
  model.setEquipment({ armor: true, armorStyle: 'andarilho' })
  return model.visibleGearState
})
await page.waitForFunction(() => {
  const external = window.__eclipse.game.player.model.external
  let hasArmor = false
  external?.root.traverse(object => {
    if (!object.isMesh) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    if (materials.some(material => material.name === 'Armor')) hasArmor = true
  })
  return hasArmor
}, null, { timeout: 30000 })
if (!equippedLook.armor) {
  throw new Error(`A armadura equipada não selecionou o visual Quaternius do Paladino: ${JSON.stringify(equippedLook)}`)
}
await captureScreenshot(page, 'character-first-armor.png')
const restoredLook = await page.evaluate(() => {
  window.__eclipse.game.refreshStats()
  return window.__eclipse.game.player.model.visibleGearState
})
if (restoredLook.armor) throw new Error(`A validação visual alterou o equipamento inicial: ${JSON.stringify(restoredLook)}`)
await page.waitForFunction(() => {
  const external = window.__eclipse.game.player.model.external
  let hasShirt = false
  external?.root.traverse(object => {
    if (!object.isMesh) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    if (materials.some(material => material.name === 'Shirt')) hasShirt = true
  })
  return hasShirt
}, null, { timeout: 30000 })
if (openingState.maxEnemyHeight > 2.45) throw new Error(`Mob maior que o limite: ${openingState.maxEnemyHeight} m.`)

await page.keyboard.press('l')
const huntCard = page.locator('.quest-hunt')
await huntCard.waitFor({ state: 'visible' })
const huntGuide = await huntCard.textContent()
const locateAction = await page.locator('.panel__foot [data-hunt-locate]').textContent()
if (!huntGuide?.includes('Lobo Sombrio') || !huntGuide.includes('Mata Sombria') || !locateAction?.includes('Localizar no jogo')) {
  throw new Error(`O diário não mostrou o localizador da missão: ${huntGuide}`)
}
await page.locator('.panel__close').evaluate(button => button.click())
await page.waitForFunction(() => window.__eclipse.game.mode === 'playing')
await page.locator('.quest__locator:not(.hidden)').waitFor({ state: 'visible' })
const liveLocator = await page.locator('.quest__locator').textContent()
if (!liveLocator?.includes('Lobo Sombrio') && !liveLocator?.includes('Zona de caça')) throw new Error(`A HUD não mostrou o localizador: ${liveLocator}`)
const activeQuestTarget = await page.evaluate(() => {
  const g = window.__eclipse.game
  const target = g.panelContext().questTarget
  return {
    target,
    markerName: g.questMarker.name,
    markerVisible: g.questMarker.visible,
    markerPosition: { x: g.questMarker.position.x, z: g.questMarker.position.z },
  }
})
console.log('active quest map/world target:', activeQuestTarget)
if (!activeQuestTarget.target || activeQuestTarget.markerName !== 'quest-world-marker' || !activeQuestTarget.markerVisible
  || Math.hypot(activeQuestTarget.target.x - activeQuestTarget.markerPosition.x, activeQuestTarget.target.z - activeQuestTarget.markerPosition.z) > 0.01) {
  throw new Error(`O destino atual não foi conectado ao mapa e ao marcador do mundo: ${JSON.stringify(activeQuestTarget)}`)
}
const collectionTarget = await page.evaluate(() => {
  const g = window.__eclipse.game
  const previous = g.quests.toJSON()
  const resource = g.population.nearestResource('mat-erva', g.player.position)
  g.quests.states.set('secundaria-02', { status: 'ativa', progress: {} })
  g.quests.tracked = 'secundaria-02'
  g.update(1 / 60, { moveX: 0, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: false, rollPressed: false,
    attackPressed: false, attackHeld: false, blockHeld: false, lookX: 0, lookY: 0, interact: false })
  const target = g.panelContext().questTarget
  const locator = document.querySelector('.quest__locator')?.textContent ?? ''
  g.quests.load(previous)
  g.update(1 / 60, { moveX: 0, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: false, rollPressed: false,
    attackPressed: false, attackHeld: false, blockHeld: false, lookX: 0, lookY: 0, interact: false })
  return { resource: resource && { x: resource.position.x, z: resource.position.z }, target, locator }
})
console.log('active collection resource target:', collectionTarget)
if (!collectionTarget.resource || !collectionTarget.target || collectionTarget.target.name !== 'Erva Curativa'
  || Math.hypot(collectionTarget.resource.x - collectionTarget.target.x, collectionTarget.resource.z - collectionTarget.target.z) > 0.01
  || !collectionTarget.locator.includes('Erva Curativa')) {
  throw new Error(`O objetivo de coleta aponta ao local errado: ${JSON.stringify(collectionTarget)}`)
}
const mountCycle = await page.evaluate(() => {
  const g = window.__eclipse.game
  const animal = g.world.chunks.wildlifeAgents().find(candidate => !candidate.dead && !candidate.mounted)
  if (!animal) return { available: false }
  // Use a loaded glTF as a deterministic interaction fixture; species eligibility is covered by unit tests.
  animal.mountable = true
  const x = g.player.position.x + 0.55
  const z = g.player.position.z
  g.world.chunks.relocateMountedAnimal(animal, x, g.world.terrain.heightAt(x, z), z)
  const neutral = { moveX: 0, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: false, rollPressed: false,
    attackPressed: false, attackHeld: false, blockHeld: false, lookX: 0, lookY: 0, interact: false }
  g.update(1 / 60, { ...neutral, interact: true })
  g.update(1 / 60, neutral)
  const mounted = g.player.mounted && animal.mounted
  const mountPrompt = g.interactLabel
  const touchLabelWhileMounted = document.querySelector('[data-action="interact"]')?.textContent ?? ''
  g.update(1 / 60, { ...neutral, interact: true })
  g.update(1 / 60, neutral)
  return {
    available: true,
    mounted,
    mountPrompt,
    touchLabelWhileMounted,
    dismounted: !g.player.mounted && !animal.mounted,
    touchLabelAfterDismount: document.querySelector('[data-action="interact"]')?.textContent ?? '',
    retainedInWorld: g.world.chunks.wildlifeAgents().includes(animal),
  }
})
console.log('mount/dismount interaction:', mountCycle)
if (!mountCycle.available || !mountCycle.mounted || mountCycle.mountPrompt !== 'Desmontar'
  || mountCycle.touchLabelWhileMounted !== 'Desm.' || !mountCycle.dismounted
  || !mountCycle.touchLabelAfterDismount.startsWith('Montar') || !mountCycle.retainedInWorld) {
  throw new Error(`Montar/desmontar ou prompt touch falhou: ${JSON.stringify(mountCycle)}`)
}

// Existing CC0 house GLBs must appear in streamed settlements; the nearby door must be usable.
await page.waitForFunction(() => {
  let count = 0
  window.__eclipse.game.world.pois.group.traverse(object => { if (object.name.startsWith('house-model-')) count += 1 })
  return count >= 7
}, null, { timeout: 30000 })
const houseTextureStatus = await page.evaluate(() => {
  const categories = new Set()
  let loadedMaps = 0
  const houseRoots = []
  window.__eclipse.game.world.pois.group.traverse(object => { if (object.name.startsWith('house-model-')) houseRoots.push(object) })
  for (const root of houseRoots) root.traverse(object => {
    if (!object.isMesh) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      const name = material.name.toLowerCase()
      if (!material.map?.image?.width) continue
      loadedMaps += 1
      if (/thatch|roof|shingle|paintred|paintorange/.test(name)) categories.add('telhas')
      else if (/wood|bark|timber/.test(name)) categories.add('madeira')
      else if (/stone|soil|plinth|brick/.test(name)) categories.add('pedra')
      else if (/cream|paint|plaster|wall/.test(name)) categories.add('reboco')
    }
  })
  return { loadedMaps, categories: [...categories] }
})
console.log('house texture maps:', houseTextureStatus)
if (houseTextureStatus.loadedMaps < 4 || ['madeira', 'pedra', 'reboco', 'telhas'].some(category => !houseTextureStatus.categories.includes(category))) {
  throw new Error(`Os mapas de textura não foram aplicados às categorias dos GLBs: ${JSON.stringify(houseTextureStatus)}`)
}
const npcNavigation = await page.evaluate(() => {
  const g = window.__eclipse.game
  const npc = g.population.npcs.find(candidate => candidate.root.userData.poiId === 'vila-brumal')
  const aura = npc?.model.root.getObjectByName('character-aura')
  const houses = g.world.pois.collidersOf('vila-brumal').filter(collider => collider.npcBlocking)
  if (!npc || houses.length === 0) return { available: false }
  const isInside = () => houses.some(collider => npc.position.x >= collider.minX && npc.position.x <= collider.maxX
    && npc.position.z >= collider.minZ && npc.position.z <= collider.maxZ)
  const startedInside = isInside()
  for (let step = 0; step < 1200; step += 1) npc.update(0.1, { x: 10000, y: 0, z: 10000 }, false)
  return { available: true, startedInside, endedInside: isInside(), auraVisible: aura?.visible ?? null }
})
console.log('NPC house navigation:', npcNavigation)
if (!npcNavigation.available || npcNavigation.startedInside || npcNavigation.endedInside || npcNavigation.auraVisible !== false) {
  throw new Error(`Navegação ou remoção de aura do NPC falhou: ${JSON.stringify(npcNavigation)}`)
}
const houseEntry = await page.evaluate(() => {
  const g = window.__eclipse.game
  const door = g.world.nearestHouseDoor(g.player.position.x, g.player.position.z, 180)
  if (!door) return { found: false }
  g.player.position.set(door.x, door.y + 0.2, door.z)
  g.player.root.position.copy(g.player.position)
  g.player.velocity.set(0, 0, 0)
  g.update(1 / 60, {
    moveX: 0, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: false, rollPressed: false,
    attackPressed: false, attackHeld: false, blockHeld: false, lookX: 0, lookY: 0, interact: true,
  })
  return {
    found: true,
    inside: g.world.isInterior,
    doorId: door.houseId,
    savedId: g.save.data.game?.interior?.houseId ?? null,
  }
})
if (!houseEntry.found || !houseEntry.inside || houseEntry.savedId !== houseEntry.doorId) {
  throw new Error(`A porta não abriu um interior persistido: ${JSON.stringify(houseEntry)}`)
}
console.log('house interior entered and saved:', houseEntry)
await captureScreenshot(page, '04-house-interior.png')

// Reload/continue must restore the room directly and must not replay Iara's first-meeting dialogue.
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__eclipse?.game, { timeout: 30000 })
await page.getByRole('button', { name: 'Continuar campanha' }).waitFor({ timeout: 20000 })
await page.getByRole('button', { name: 'Continuar campanha' }).click()
await page.waitForFunction(() => window.__eclipse.game.world.isInterior, null, { timeout: 30000 })
const resumedInterior = await page.evaluate(() => ({
  inside: window.__eclipse.game.world.isInterior,
  dialogueOpen: !document.querySelector('.dialogue')?.classList.contains('hidden'),
  storyFlags: window.__eclipse.save.data.game?.storyFlags ?? [],
}))
if (!resumedInterior.inside || resumedInterior.dialogueOpen || !resumedInterior.storyFlags.includes('iara-intro')) {
  throw new Error(`A retomada repetiu introdução ou não restaurou a casa: ${JSON.stringify(resumedInterior)}`)
}
const exitResult = await page.evaluate(() => {
  const g = window.__eclipse.game
  if (!g.interior) return { inside: g.world.isInterior, savedInterior: g.save.data.game?.interior ?? null }
  g.player.teleport(g.interior.exitPosition)
  g.update(1 / 60, {
    moveX: 0, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: false, rollPressed: false,
    attackPressed: false, attackHeld: false, blockHeld: false, lookX: 0, lookY: 0, interact: true,
  })
  return { inside: g.world.isInterior, savedInterior: g.save.data.game?.interior ?? null }
})
if (exitResult.inside || exitResult.savedInterior !== null) throw new Error(`A saída da casa não restaurou o mundo/save: ${JSON.stringify(exitResult)}`)
await page.waitForFunction(() => !window.__eclipse.game.world.isInterior)
if (await page.locator('.dialogue').evaluate(element => !element.classList.contains('hidden'))) {
  throw new Error('O diálogo inicial reapareceu ao sair da casa.')
}
console.log('interior restored on reload, exit works, Iara intro stays closed')

// No second campaign may be created until the active save is deliberately deleted.
await page.keyboard.press('Escape')
await page.waitForFunction(() => window.__eclipse.game.mode === 'paused' && document.pointerLockElement === null)
await page.locator('.pause-card').waitFor()
const pauseHitTest = await page.evaluate(() => {
  const save = document.querySelector('.pause-card [data-save]')
  const quit = document.querySelector('.pause-card [data-quit]')
  const body = document.querySelector('.pause-card .panel__body')
  if (!(save instanceof HTMLElement) || !(quit instanceof HTMLElement) || !(body instanceof HTMLElement)) return { missing: true }
  const saveRect = save.getBoundingClientRect()
  const quitRect = quit.getBoundingClientRect()
  const hit = document.elementFromPoint(quitRect.left + quitRect.width / 2, quitRect.top + quitRect.height / 2)
  return {
    missing: false,
    save: { top: saveRect.top, bottom: saveRect.bottom },
    quit: { top: quitRect.top, bottom: quitRect.bottom },
    body: { height: body.clientHeight, scrollHeight: body.scrollHeight, scrollTop: body.scrollTop },
    hit: hit?.closest('[data-quit]') ? 'quit' : hit?.closest('[data-save]') ? 'save' : hit?.tagName ?? 'none',
  }
})
console.log('pause hit test:', pauseHitTest)
if (pauseHitTest.hit !== 'quit') throw new Error(`Saída da pausa encoberta por outro elemento: ${JSON.stringify(pauseHitTest)}`)
if (await page.locator('[data-customize]').count()) throw new Error('A pausa permite editar identidade fixa.')
const quitButton = page.locator('.pause-card [data-quit]')
const quitBounds = await quitButton.boundingBox()
if (!quitBounds) throw new Error('O botão Sair para o título não tem uma caixa clicável.')
const quitPoint = { x: quitBounds.x + quitBounds.width / 2, y: quitBounds.y + quitBounds.height / 2 }
await page.mouse.move(quitPoint.x, quitPoint.y, { steps: 1 })
const pointerTarget = await page.evaluate(({ x, y }) => {
  const hit = document.elementFromPoint(x, y)
  return hit?.closest('[data-quit]') ? 'quit' : hit?.closest('[data-save]') ? 'save' : hit?.tagName ?? 'none'
}, quitPoint)
if (pointerTarget !== 'quit') throw new Error(`O cursor não alcançou Sair para o título: ${pointerTarget}`)
await page.mouse.click(quitPoint.x, quitPoint.y)
await page.waitForTimeout(250)
const afterQuit = await page.evaluate(() => ({
  titleVisible: !document.querySelector('.title')?.classList.contains('hidden'),
  titleMenu: document.querySelector('.title__menu')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  pauseVisible: Boolean(document.querySelector('.pause-card') && !document.querySelector('.pause-card')?.classList.contains('hidden')),
  mode: window.__eclipse.game.mode,
}))
console.log('after quit click:', afterQuit)
if (!afterQuit.titleVisible || afterQuit.pauseVisible) throw new Error(`Sair da pausa não abriu a tela de título: ${JSON.stringify(afterQuit)}`)
const createButton = page.locator('.title__menu button').filter({ hasText: 'Campanha única ativa' })
if (await createButton.count() !== 1) throw new Error(`A tela de título não mostrou o estado de campanha única: ${afterQuit.titleMenu}`)
if (!(await createButton.isDisabled())) throw new Error('A tela de título deixa criar outra campanha enquanto existe um save.')
const settingsBeforeDeletion = await page.evaluate(() => JSON.stringify(window.__eclipse.save.data.settings))
let deleteMessages = 0
page.once('dialog', async dialog => { deleteMessages += 1; await dialog.dismiss() })
await page.getByRole('button', { name: 'Excluir save de Teste Eclipse' }).click()
if (deleteMessages !== 1 || await page.evaluate(() => window.__eclipse.save.data.campaigns.length) !== 1) {
  throw new Error('Cancelar a confirmação de exclusão não preservou a campanha.')
}
page.once('dialog', async dialog => { deleteMessages += 1; await dialog.accept() })
await page.getByRole('button', { name: 'Excluir save de Teste Eclipse' }).click()
await page.waitForFunction(() => window.__eclipse.save.data.campaigns.length === 0
  && window.__eclipse.save.data.activeCampaignId === null && window.__eclipse.save.data.game === null)
if (deleteMessages !== 2 || await page.evaluate(() => JSON.stringify(window.__eclipse.save.data.settings)) !== settingsBeforeDeletion) {
  throw new Error('Excluir o save alterou configurações ou deixou de pedir confirmação.')
}
await page.getByRole('button', { name: 'Criar personagem', exact: true }).click()
await page.locator('.opening-intro').waitFor({ state: 'visible' })
await page.getByRole('button', { name: 'Pular para criar personagem' }).click()
await page.locator('.campaign-intro').waitFor({ state: 'visible' })
await page.getByRole('button', { name: 'Iniciar campanha' }).click()
await page.locator('[data-player-name]').fill('Nara Eclipse')
await page.getByRole('button', { name: 'Confirmar e começar' }).click({ noWaitAfter: true })
await page.locator('.dialogue').waitFor({ state: 'visible', timeout: 60000 })
const recreated = await page.evaluate(() => ({
  count: window.__eclipse.save.data.campaigns.length,
  name: window.__eclipse.save.activeCampaign?.profile.name,
  model: window.__eclipse.save.activeCampaign?.profile.modelId,
}))
if (recreated.count !== 1 || recreated.name !== 'Nara Eclipse' || recreated.model !== 'Soldier') {
  throw new Error(`Após excluir, a campanha única não pôde ser recriada corretamente: ${JSON.stringify(recreated)}`)
}
await page.getByRole('button', { name: 'Aceitar missão: O Despertar' }).click()
await page.getByRole('button', { name: 'Encerrar conversa' }).click()
const skillIntegration = await page.evaluate(() => {
  const g = window.__eclipse.game
  const savedRanks = g.skills.toJSON()
  const base = { attack: g.player.stats.attack, spellPower: g.player.stats.spellPower, mana: g.player.stats.maxMana,
    moveSpeed: g.player.stats.moveSpeed, defense: g.player.stats.defense, lifesteal: g.player.stats.lifesteal }
  g.skills.ranks.set('lamina-forca', 1)
  g.skills.ranks.set('lamina-guarda', 1)
  g.skills.ranks.set('arcano-poder', 1)
  g.skills.ranks.set('arcano-mana', 2)
  g.skills.ranks.set('sombra-agil', 1)
  g.skills.ranks.set('sombra-sanguessuga', 1)
  g.skills.ranks.set('arcano-foco', 1)
  g.skills.ranks.set('arcano-eco', 2)
  g.refreshStats()
  const upgraded = { attack: g.player.stats.attack, spellPower: g.player.stats.spellPower, mana: g.player.stats.maxMana,
    moveSpeed: g.player.stats.moveSpeed, defense: g.player.stats.defense, lifesteal: g.player.stats.lifesteal }
  const abilityIndex = g.abilities().findIndex(ability => ability.kind === 'projetil')
  const ability = g.abilities()[abilityIndex]
  const manaBefore = g.player.mana
  const projectilesBefore = g.projectiles.activeCount
  const originalRandom = Math.random
  try {
    Math.random = () => 0
    g.castAbility(abilityIndex)
  } finally {
    Math.random = originalRandom
  }
  const cast = { projectiles: g.projectiles.activeCount - projectilesBefore, spent: manaBefore - g.player.mana, expectedCost: ability.mana * 0.94 }
  g.projectiles.clear()
  g.player.mode = 'idle'
  g.player.cooldowns.delete(ability.id)
  g.skills.load(savedRanks)
  g.refreshStats()
  return { base, upgraded, cast }
})
console.log('skill integration:', skillIntegration)
if (Math.abs(skillIntegration.upgraded.attack / skillIntegration.base.attack - 1.08) > 0.001
  || Math.abs(skillIntegration.upgraded.spellPower / skillIntegration.base.spellPower - 1.08) > 0.001
  || skillIntegration.upgraded.mana - skillIntegration.base.mana !== 40
  || skillIntegration.upgraded.defense - skillIntegration.base.defense !== 6
  || Math.abs(skillIntegration.upgraded.moveSpeed / skillIntegration.base.moveSpeed - 1.04) > 0.001
  || Math.abs(skillIntegration.upgraded.lifesteal - skillIntegration.base.lifesteal - 0.03) > 0.001
  || skillIntegration.cast.projectiles !== 2 || Math.abs(skillIntegration.cast.spent - skillIntegration.cast.expectedCost) > 0.02) {
  throw new Error(`Efeitos passivos/conjuração dupla não foram aplicados exatamente uma vez: ${JSON.stringify(skillIntegration)}`)
}
await page.evaluate(() => {
  const g = window.__eclipse.game
  g.ui.openCraft(g.panelContext(), 'forja')
})
const craftHint = await page.locator('.recipe').first().textContent()
if (!craftHint?.includes('Espaço: será verificado depois que você reunir os materiais.')
  || craftHint.includes('não cabe mesmo após consumir os materiais')) {
  throw new Error(`O crafting atribuiu falta de espaço apesar dos materiais ausentes: ${craftHint}`)
}
await page.locator('.panel__close').evaluate(button => button.click())
await page.keyboard.press('l')
await page.locator('.quest-detail__obj').first().waitFor()
const wolfKill = await page.evaluate(() => {
  const g = window.__eclipse.game
  const wolf = g.spawner.enemies.find(enemy => enemy.def.id === 'lobo-sombrio' && enemy.alive)
  if (!wolf) throw new Error('Não há lobo sombrio próximo para testar a missão.')
  g.damageArea(wolf.position.clone(), 0.2, 100000, 'fogo')
  return {
    dead: wolf.dead,
    counted: wolf.counted,
    progress: g.quests.objectiveProgress('principal-01', 'obj-p01-1'),
    savedProgress: g.save.data.game?.quests?.states?.['principal-01']?.progress?.['obj-p01-1'] ?? 0,
  }
})
const visibleWolfProgress = await page.locator('.quest-detail__obj').first().textContent()
console.log('real wolf kill progress:', { ...wolfKill, visibleWolfProgress })
if (!wolfKill.dead || !wolfKill.counted || wolfKill.progress !== 1 || wolfKill.savedProgress !== 1
  || !visibleWolfProgress?.includes('1/3')) {
  throw new Error(`O abate real não contou/salvou/atualizou o diário: ${JSON.stringify({ wolfKill, visibleWolfProgress })}`)
}
await page.locator('.panel__close').evaluate(button => button.click())
await page.waitForFunction(() => window.__eclipse.game.mode === 'playing')
const missionProof = await page.evaluate(() => {
  const g = window.__eclipse.game
  const neutral = { moveX: 0, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: false, rollPressed: false,
    attackPressed: false, attackHeld: false, blockHeld: false, lookX: 0, lookY: 0, interact: false }
  const remainingWolves = g.spawner.enemies.filter(enemy => enemy.def.id === 'lobo-sombrio' && enemy.alive)
  if (remainingWolves.length < 2) throw new Error(`Restam ${remainingWolves.length} lobos vivos; são necessários mais dois.`)
  for (const wolf of remainingWolves.slice(0, 2)) g.damageArea(wolf.position.clone(), 0.2, 100000, 'fogo')
  const wolvesDone = g.quests.objectiveProgress('principal-01', 'obj-p01-1')
  const wolfSave = g.save.data.game?.quests?.states?.['principal-01']?.progress?.['obj-p01-1'] ?? 0
  const herbs = g.population.nodes.filter(node => node.kind === 'erva' && !node.depleted)
  if (herbs.length < 3) throw new Error(`Há somente ${herbs.length} ervas físicas disponíveis.`)
  for (const node of herbs.slice(0, 3)) {
    g.player.teleport(node.position.clone())
    g.update(1 / 60, { ...neutral, interact: true })
    g.update(1 / 60, neutral)
  }
  const herbsDone = g.quests.objectiveProgress('principal-01', 'obj-p01-2')
  const herbCount = g.inventory.count('mat-erva')
  return { wolvesDone, wolfSave, herbsDone, herbCount }
})
if (missionProof.wolvesDone !== 3 || missionProof.wolfSave !== 3 || missionProof.herbsDone !== 3 || missionProof.herbCount < 3) {
  throw new Error(`Abates/coletas reais não completaram a missão: ${JSON.stringify(missionProof)}`)
}
const thomConversation = await page.evaluate(() => {
  const g = window.__eclipse.game
  g.openNpcDialogue('velho-thom')
  return {
    text: g.dialogue.node?.text ?? '',
    talked: g.quests.objectiveProgress('principal-01', 'obj-p01-3'),
    dialogue: document.querySelector('.dialogue')?.textContent ?? '',
  }
})
if (!thomConversation.text.includes('marca') || thomConversation.talked !== 1
  || !thomConversation.dialogue.includes('Você está bem, Thom?')) {
  throw new Error(`Thom não explicou a marca/manteve a missão secundária: ${JSON.stringify(thomConversation)}`)
}
await page.getByRole('button', { name: 'Encerrar conversa' }).click()
await page.waitForFunction(() => window.__eclipse.game.mode === 'playing')
const bossProof = await page.evaluate(() => {
  const g = window.__eclipse.game
  const poi = g.world.pois.list().find(entry => entry.bossId === 'guardiao-floresta-corrompido')
  if (!poi) throw new Error('O POI do Guardião não existe no mapa.')
  const x = poi.x
  const z = poi.z + poi.radius + 4
  g.player.teleport(g.player.position.clone().set(x, g.world.groundAt(x, z, 200), z))
  g.update(1 / 60, { moveX: 0, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: false, rollPressed: false,
    attackPressed: false, attackHeld: false, blockHeld: false, lookX: 0, lookY: 0, interact: false })
  const boss = g.boss
  if (!boss || boss.def.id !== 'guardiao-floresta-corrompido') throw new Error('O Guardião não apareceu no fluxo real do POI.')
  g.damageArea(boss.position.clone(), boss.radius + 1, 100000, 'fogo')
  return {
    dead: boss.dead,
    objective: g.quests.objectiveProgress('principal-01', 'obj-p01-4'),
    savedObjective: g.save.data.game?.quests?.states?.['principal-01']?.progress?.['obj-p01-4'] ?? 0,
    ready: g.quests.ready('principal-01'),
  }
})
console.log('mission gameplay proof:', { ...missionProof, thomTalked: thomConversation.talked, bossProof })
if (!bossProof.dead || bossProof.objective !== 1 || bossProof.savedObjective !== 1 || !bossProof.ready) {
  throw new Error(`A luta real contra o Guardião não completou/salvou a missão: ${JSON.stringify(bossProof)}`)
}
await page.evaluate(() => window.__eclipse.game.openNpcDialogue('iara'))
const turnInButton = page.getByRole('button', { name: 'Concluir missão: O Despertar' })
const dialoguePointerUnlocked = await page.evaluate(() => document.pointerLockElement !== document.querySelector('#game'))
if (!dialoguePointerUnlocked) throw new Error('A conversa com NPC manteve o pointer lock e bloqueou as opções clicáveis.')
const turnInHitTarget = await turnInButton.evaluate(button => {
  const rect = button.getBoundingClientRect()
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
  return hit === button || button.contains(hit)
})
if (!turnInHitTarget) throw new Error('O botão Concluir missão está encoberto na interface.')
const rewardBefore = await page.evaluate(() => {
  const g = window.__eclipse.game
  const totalXp = p => p.xp + Array.from({ length: p.level - 1 }, (_, i) => Math.round(58 * (i + 1) ** 1.42)).reduce((sum, value) => sum + value, 0)
  return { gold: g.inventory.gold, xp: totalXp(g.progression), potions: g.inventory.count('pocao-vida-1'), bread: g.inventory.count('comida-pao') }
})
await turnInButton.click()
await page.waitForFunction(() => {
  const external = window.__eclipse.game.player.model.external
  let hasSoldierArmor = false
  external?.root.traverse(object => {
    if (!object.isMesh) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    if (materials.some(material => material.name === 'Main' || material.name === 'Helmet')) hasSoldierArmor = true
  })
  return hasSoldierArmor
}, null, { timeout: 30000 })
const armorAfterMission = await page.evaluate(() => {
  const g = window.__eclipse.game
  return {
    quest: g.quests.state('principal-01')?.status,
    equipped: g.inventory.equipment.armadura?.id ?? null,
    visual: g.player.model.visibleGearState,
  }
})
console.log('first armor progression:', armorAfterMission)
if (armorAfterMission.quest !== 'concluida' || armorAfterMission.equipped !== 'armadura-andarilho'
  || !armorAfterMission.visual.armor) {
  throw new Error(`A entrega da missão não vestiu a primeira armadura: ${JSON.stringify(armorAfterMission)}`)
}
const rewardAfter = await page.evaluate(() => {
  const g = window.__eclipse.game
  const totalXp = p => p.xp + Array.from({ length: p.level - 1 }, (_, i) => Math.round(58 * (i + 1) ** 1.42)).reduce((sum, value) => sum + value, 0)
  const state = g.save.data.game?.quests?.states?.['principal-01']
  const savedProgression = g.save.data.game?.progression
  return {
    gold: g.inventory.gold, xp: totalXp(g.progression), potions: g.inventory.count('pocao-vida-1'), bread: g.inventory.count('comida-pao'),
    savedXp: savedProgression ? totalXp(savedProgression) : null,
    savedGold: g.save.data.game?.inventory?.gold, savedPotions: g.save.data.game?.inventory?.stacks?.find(stack => stack.id === 'pocao-vida-1')?.count ?? 0,
    savedBread: g.save.data.game?.inventory?.stacks?.find(stack => stack.id === 'comida-pao')?.count ?? 0, savedStatus: state?.status,
  }
})
const rewardDelta = { xp: rewardAfter.xp - rewardBefore.xp, gold: rewardAfter.gold - rewardBefore.gold,
  potions: rewardAfter.potions - rewardBefore.potions, bread: rewardAfter.bread - rewardBefore.bread }
console.log('exact saved mission rewards:', { rewardBefore, rewardAfter, rewardDelta })
if (rewardDelta.xp !== 120 || rewardDelta.gold !== 60 || rewardDelta.potions !== 2 || rewardDelta.bread !== 3
  || rewardAfter.savedXp !== rewardAfter.xp
  || rewardAfter.savedGold !== rewardAfter.gold || rewardAfter.savedPotions !== rewardAfter.potions
  || rewardAfter.savedBread !== rewardAfter.bread || rewardAfter.savedStatus !== 'concluida') {
  throw new Error(`Recompensa exata não foi aplicada e salva: ${JSON.stringify({ rewardBefore, rewardAfter, rewardDelta })}`)
}
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__eclipse?.game, { timeout: 30000 })
await page.getByRole('button', { name: 'Continuar campanha' }).click()
await page.waitForFunction(() => window.__eclipse.game.mode === 'playing', null, { timeout: 30000 })
const reloadedReward = await page.evaluate(() => {
  const g = window.__eclipse.game
  const totalXp = p => p.xp + Array.from({ length: p.level - 1 }, (_, i) => Math.round(58 * (i + 1) ** 1.42)).reduce((sum, value) => sum + value, 0)
  return { status: g.quests.state('principal-01')?.status, gold: g.inventory.gold,
    xp: totalXp(g.progression), potions: g.inventory.count('pocao-vida-1'), bread: g.inventory.count('comida-pao'), armor: g.inventory.equipment.armadura?.id ?? null }
})
if (reloadedReward.status !== 'concluida' || reloadedReward.xp !== rewardAfter.xp || reloadedReward.gold !== rewardAfter.gold
  || reloadedReward.potions !== rewardAfter.potions || reloadedReward.bread !== rewardAfter.bread
  || reloadedReward.armor !== 'armadura-andarilho') {
  throw new Error(`Recompensas não sobreviveram ao reload: ${JSON.stringify(reloadedReward)}`)
}
console.log('mission reward survives reload:', reloadedReward)
await page.waitForTimeout(150)
await captureScreenshot(page, 'character-after-mission.png')
const closeDialogue = page.getByRole('button', { name: 'Encerrar conversa' })
if (await closeDialogue.isVisible()) await closeDialogue.click()
await page.keyboard.press('Escape')
await page.waitForFunction(() => window.__eclipse.game.mode === 'paused' && document.pointerLockElement === null)
await page.locator('.pause-card').waitFor()
const finalQuitBounds = await page.locator('.pause-card [data-quit]').boundingBox()
if (!finalQuitBounds) throw new Error('O segundo botão Sair para o título não tem uma caixa clicável.')
const finalQuitPoint = { x: finalQuitBounds.x + finalQuitBounds.width / 2, y: finalQuitBounds.y + finalQuitBounds.height / 2 }
await page.mouse.move(finalQuitPoint.x, finalQuitPoint.y, { steps: 1 })
const finalPointerTarget = await page.evaluate(({ x, y }) => {
  const hit = document.elementFromPoint(x, y)
  return hit?.closest('[data-quit]') ? 'quit' : hit?.closest('[data-save]') ? 'save' : hit?.className ?? hit?.tagName ?? 'none'
}, finalQuitPoint)
if (finalPointerTarget !== 'quit') throw new Error(`O segundo botão Sair está encoberto por ${finalPointerTarget}.`)
await page.mouse.click(finalQuitPoint.x, finalQuitPoint.y)
await page.waitForFunction(() => !document.querySelector('.title')?.classList.contains('hidden'))
if (!(await page.locator('.title__menu button').filter({ hasText: 'Campanha única ativa' }).isDisabled())) {
  throw new Error('O save recriado permite iniciar outra campanha em paralelo.')
}
console.log('single campaign: duplicate creation blocked; confirmed deletion preserves settings and enables a fresh journey')
await page.close()

// Mobile smoke: creation, mission diary/localizer, touch controls and rotation.
const mobileUrl = new globalThis.URL(URL)
mobileUrl.searchParams.set('smoke', '1')
const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
mobilePage.on('console', message => { if (message.type() === 'error') errors.push(`mobile: ${message.text()}`) })
mobilePage.on('pageerror', error => {
  const message = `mobile pageerror: ${error.message}`
  errors.push(message)
  pageErrors.push(message)
})
await mobilePage.goto(mobileUrl.toString(), { waitUntil: 'domcontentloaded' })
await mobilePage.waitForFunction(() => window.__eclipse?.game, { timeout: 30000 })
await mobilePage.getByRole('button', { name: 'Criar personagem', exact: true }).click()
await mobilePage.locator('.opening-intro').waitFor({ state: 'visible' })
await mobilePage.getByRole('button', { name: 'Pular para criar personagem' }).click()
await mobilePage.locator('.campaign-intro').waitFor({ state: 'visible' })
await mobilePage.getByRole('button', { name: 'Iniciar campanha' }).click()
await mobilePage.locator('[data-player-name]').fill('Mobile Eclipse')
await mobilePage.getByRole('button', { name: 'Confirmar e começar' }).click()
await mobilePage.locator('.dialogue').waitFor({ state: 'visible' })
await mobilePage.getByRole('button', { name: 'Aceitar missão: O Despertar' }).click()
await mobilePage.getByRole('button', { name: 'Encerrar conversa' }).click()
await mobilePage.waitForFunction(() => window.__eclipse.game.mode === 'playing' && window.__eclipse.game.quests.tracked === 'principal-01')
const mobileQuestButton = mobilePage.locator('[data-open-quests]')
await mobileQuestButton.waitFor({ state: 'visible' })
const mobileQuestButtonBox = await mobileQuestButton.boundingBox()
if (!mobileQuestButtonBox) throw new Error('Botão de missões mobile sem área clicável.')
await mobilePage.touchscreen.tap(mobileQuestButtonBox.x + mobileQuestButtonBox.width / 2, mobileQuestButtonBox.y + mobileQuestButtonBox.height / 2)
await mobilePage.locator('.quest-hunt').waitFor({ state: 'visible' })
const mobileLocateButton = mobilePage.locator('[data-hunt-locate]')
const mobileLocateButtonBox = await mobileLocateButton.boundingBox()
if (!mobileLocateButtonBox) throw new Error('Ação Localizar sem área clicável no diário mobile.')
await mobilePage.touchscreen.tap(mobileLocateButtonBox.x + mobileLocateButtonBox.width / 2, mobileLocateButtonBox.y + mobileLocateButtonBox.height / 2)
await mobilePage.waitForFunction(() => window.__eclipse.game.mode === 'playing')
await mobilePage.locator('.quest__locator:not(.hidden)').waitFor({ state: 'visible' })
await mobilePage.evaluate(() => window.__eclipse.ui.touch.show(true))
await captureScreenshot(mobilePage, '05-mobile-portrait.png')
const portrait = await mobilePage.evaluate(() => ({
  touchAction: getComputedStyle(document.querySelector('.touch__look')).touchAction,
  appHeight: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
  canvasHeight: getComputedStyle(document.querySelector('#game')).height,
  cameraFov: window.__eclipse.camera.camera.fov,
  touchButtons: [...document.querySelectorAll('.touch__btn')].filter(button => getComputedStyle(button).display !== 'none').length,
}))
if (portrait.touchAction !== 'none' || portrait.touchButtons < 6 || portrait.cameraFov !== 72) {
  throw new Error(`Controles mobile em retrato não estão prontos: ${JSON.stringify(portrait)}`)
}
const touchProbe = await mobilePage.evaluate(() => {
  const touch = window.__eclipse.ui.touch
  const stick = document.querySelector('.touch__stick')
  const look = document.querySelector('.touch__look')
  if (!(stick instanceof HTMLElement) || !(look instanceof HTMLElement)) throw new Error('Pads touch ausentes.')
  const rect = stick.getBoundingClientRect()
  const startX = rect.left + rect.width / 2
  const startY = rect.top + rect.height / 2
  stick.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 71, pointerType: 'touch', clientX: startX, clientY: startY, bubbles: true, cancelable: true }))
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 71, pointerType: 'touch', clientX: startX + rect.width * 0.6, clientY: startY, bubbles: true, cancelable: true }))
  const moveX = touch.move.x
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 71, pointerType: 'touch', bubbles: true, cancelable: true }))
  look.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 72, pointerType: 'touch', clientX: 300, clientY: 300, bubbles: true, cancelable: true }))
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 72, pointerType: 'touch', clientX: 328, clientY: 284, bubbles: true, cancelable: true }))
  const lookDelta = touch.consumeLook()
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 72, pointerType: 'touch', bubbles: true, cancelable: true }))
  return { moveX, lookDelta }
})
if (touchProbe.moveX < 0.4 || Math.abs(touchProbe.lookDelta.x) < 20 || Math.abs(touchProbe.lookDelta.y) < 10) {
  throw new Error(`O gesto touch não chegou aos controles: ${JSON.stringify(touchProbe)}`)
}
await mobilePage.setViewportSize({ width: 844, height: 390 })
await mobilePage.waitForTimeout(350)
const landscape = await mobilePage.evaluate(() => ({
  appHeight: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
  canvasHeight: getComputedStyle(document.querySelector('#game')).height,
  cameraFov: window.__eclipse.camera.camera.fov,
  isLandscape: matchMedia('(orientation: landscape)').matches,
  overlappingPoiLabels: [...document.querySelectorAll('.compass__mark--poi')].some(mark => getComputedStyle(mark).display !== 'none'),
}))
if (landscape.cameraFov !== 62 || !landscape.isLandscape || landscape.appHeight !== '390px' || landscape.canvasHeight !== '390px') {
  throw new Error(`O jogo não se adaptou ao giro do celular: ${JSON.stringify(landscape)}`)
}
if (landscape.overlappingPoiLabels) throw new Error('Rótulos de destinos se sobrepõem no compasso em landscape.')
await captureScreenshot(mobilePage, '06-mobile-landscape.png')
console.log('mobile portrait and landscape:', { portrait, landscape })
await mobilePage.close()

console.log('browser errors:', errors.slice(0, 20))
await browser.close()
if (pageErrors.length) throw new Error(`Erros fatais de JavaScript durante o smoke test: ${pageErrors.join(' | ')}`)
