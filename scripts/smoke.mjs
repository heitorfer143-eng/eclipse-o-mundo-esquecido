import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.SMOKE_URL ?? 'http://localhost:5173/'
const OUT = process.env.SHOTS_DIR ?? 'shots'
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
const errors = []
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(12000)
await captureScreenshot(page, '01-title.png')

const hasGame = await page.evaluate(() => Boolean(window.__eclipse?.game))
console.log('game object:', hasGame)
console.log('errors so far:', errors.slice(0, 8))

if (hasGame) {
  await page.getByRole('button', { name: 'Nova campanha' }).click()
  await page.getByText('Você acorda na Floresta de Brumal sem memória', { exact: false }).waitFor()
  await captureScreenshot(page, '02-prologue.png')
  await page.getByRole('button', { name: 'Iniciar campanha' }).click()
  await page.locator('[data-player-name]').fill('Teste Eclipse')
  await page.locator('[data-model="Mage"]').click()
  await page.locator('[data-aura="arcano"]').click()
  await captureScreenshot(page, '03-character.png')
  await page.getByRole('button', { name: 'Confirmar e começar' }).click()
  await page.locator('.dialogue').waitFor({ state: 'visible' })
  await captureScreenshot(page, '04-iara-dialogue.png')
  await page.getByRole('button', { name: 'Aceitar missão: O Despertar' }).click()
  await page.getByRole('button', { name: 'Encerrar conversa' }).click()
  await page.waitForTimeout(4500)
  await page.waitForFunction(() => window.__eclipse.game.population.npcs.some(npc => npc.model.external), null, { timeout: 30000 })
  const externalModelScales = await page.evaluate(() => window.__eclipse.game.population.npcs
    .map(npc => npc.model.external?.root.children[0]?.scale.x)
    .filter(scale => Number.isFinite(scale)))
  if (externalModelScales.length && Math.max(...externalModelScales) > 100) {
    throw new Error(`Bounds inválidos no modelo clonado; fator de escala extremo: ${Math.max(...externalModelScales)}.`)
  }
  await page.locator('.hud__title').filter({ hasText: 'Teste Eclipse' }).waitFor()
  await captureScreenshot(page, '05-game.png')
  const state = await page.evaluate(() => {
    const g = window.__eclipse.game
    const iara = g.population.npcs.find(npc => npc.def.id === 'iara')
    const iaraDistance = iara?.position.distanceTo(g.player.position) ?? Infinity
    // Compare with the camera's reset direction. Earlier UI clicks may rotate the live
    // orbit camera before this assertion, which is normal and seed/runner dependent.
    const cameraBackX = Math.sin(g.player.facing)
    const cameraBackZ = Math.cos(g.player.facing)
    const iaraCameraSide = iara
      ? (iara.position.x - g.player.position.x) * cameraBackX
        + (iara.position.z - g.player.position.z) * cameraBackZ
      : Infinity
    const maxEnemyHeight = Math.max(0, ...g.spawner.enemies.map(enemy => enemy.height))
    return {
      mode: g.mode,
      pos: g.player.position.toArray().map(n => Math.round(n)),
      health: Math.round(g.player.health),
      enemies: g.spawner.enemies.length,
      maxEnemyHeight,
      iaraDistance,
      iaraCameraSide,
      openingQuest: g.quests.state('principal-01')?.status ?? null,
      trackedQuest: g.quests.tracked,
      level: g.progression.level,
      biome: g.world.biomeAt(g.player.position.x, g.player.position.z),
      fps: g.fps,
      pois: g.world.pois.list().length,
      drawCalls: null,
    }
  })
  console.log('state:', state)
  if (state.openingQuest !== 'ativa' || state.trackedQuest !== 'principal-01') throw new Error('O aceite de O Despertar não persistiu.')
  const createdProfile = await page.evaluate(() => window.__eclipse.save.activeCampaign?.profile)
  if (createdProfile?.name !== 'Teste Eclipse' || createdProfile.modelId !== 'Mage' || createdProfile.auraColor !== '#c094ff') {
    throw new Error(`O perfil escolhido na criação não foi salvo na campanha: ${JSON.stringify(createdProfile)}`)
  }
  if (state.iaraDistance > 3.4) throw new Error('Iara não está acessível no ponto de início.')
  if (state.iaraCameraSide >= 0) throw new Error('Iara está entre a câmera e o jogador no ponto de início.')
  if (state.maxEnemyHeight > 2.45) throw new Error(`Mob maior que o limite: ${state.maxEnemyHeight} m.`)
  await page.keyboard.press('KeyL')
  const huntCard = page.locator('.quest-hunt')
  await huntCard.waitFor({ state: 'visible' })
  const huntGuide = await huntCard.textContent()
  const locateAction = await page.locator('.panel__foot [data-hunt-locate]').textContent()
  if (!huntGuide?.includes('Lobo Sombrio') || !huntGuide.includes('Mata Sombria') || !locateAction?.includes('Localizar no jogo')) {
    throw new Error(`O diário não mostrou o localizador do objetivo atual: ${huntGuide}`)
  }
  await page.locator('.panel__close').evaluate(button => button.click())
  await page.waitForFunction(() => window.__eclipse.game.mode === 'playing' && window.__eclipse.game.quests.tracked === 'principal-01')
  await page.waitForFunction(() => {
    const locator = document.querySelector('.quest__locator')
    return locator && !locator.classList.contains('hidden') && locator.textContent?.trim()
  })
  const liveLocator = await page.locator('.quest__locator').textContent()
  if (!liveLocator?.includes('Lobo Sombrio') && !liveLocator?.includes('Zona de caça')) {
    throw new Error(`A HUD não exibiu a pista de localização do mob: ${liveLocator}`)
  }
  await page.evaluate(() => window.__eclipse.game.pause())
  await page.locator('.pause-card').waitFor()
  if (await page.locator('[data-customize]').count()) throw new Error('A pausa ainda permite editar a identidade do personagem.')
  await page.getByRole('button', { name: 'Continuar', exact: true }).evaluate(button => button.click())
  await page.waitForFunction(() => window.__eclipse.game.mode === 'playing')
  await page.waitForFunction(() => {
    const sites = window.__eclipse.game.world.pois.group
    let count = 0
    sites.traverse(object => { if (object.name.startsWith('house-model-')) count += 1 })
    return count >= 7
  }, null, { timeout: 20000 })
  const villageHouseCount = await page.evaluate(() => {
    let count = 0
    window.__eclipse.game.world.pois.group.traverse(object => { if (object.name.startsWith('house-model-')) count += 1 })
    return count
  })
  if (villageHouseCount < 7) throw new Error(`Modelos GLB de casas não foram instanciados na vila: ${villageHouseCount}`)
  console.log(`house models: ${villageHouseCount} CC0 GLB instances loaded in streamed settlements`)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1400)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(600)
  await captureScreenshot(page, '06-walk.png')
  await page.keyboard.press('Tab')
  await page.waitForTimeout(800)
  await captureScreenshot(page, '07-inventory.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.keyboard.press('KeyM')
  await page.waitForTimeout(1600)
  await captureScreenshot(page, '08-map.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.keyboard.press('KeyK')
  await page.waitForTimeout(800)
  await captureScreenshot(page, '09-skills.png')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Continuar campanha' }).waitFor()
  await page.getByRole('button', { name: 'Continuar campanha' }).click()
  await page.locator('.hud__title').filter({ hasText: 'Teste Eclipse' }).waitFor()
  await page.waitForTimeout(300)
  const resumed = await page.evaluate(() => ({
    mode: window.__eclipse.game.mode,
    quest: window.__eclipse.game.quests.state('principal-01')?.status ?? null,
    dialogueVisible: !document.querySelector('.dialogue')?.classList.contains('hidden'),
  }))
  const creatorVisible = await page.locator('.character-customizer').evaluate(element => !element.classList.contains('hidden'))
  if (creatorVisible) throw new Error('A retomada da campanha repetiu a criação do personagem.')
  if (resumed.mode !== 'playing' || resumed.quest !== 'ativa' || resumed.dialogueVisible) throw new Error('A retomada não restaurou a campanha diretamente.')
  console.log('campaign resumed without recreating the character or repeating Iara’s intro')

  await page.evaluate(() => {
    const runtime = window.__eclipse
    const legacy = JSON.parse(JSON.stringify(runtime.save.data.game))
    if (!legacy) throw new Error('Slot de campanha ausente para a migração legada.')
    legacy.position = [640, 35, 620]
    legacy.progression.level = 5
    legacy.inventory.gold = 321
    legacy.quests = { tracked: 'principal-01', states: {} }
    legacy.updatedAt = Date.now()
    runtime.save.data.game = legacy
    runtime.game.start(false)
  })
  await page.locator('.dialogue').waitFor({ state: 'visible' })
  const legacy = await page.evaluate(() => {
    const g = window.__eclipse.game
    return {
      quest: g.quests.state('principal-01')?.status ?? null,
      tracked: g.quests.tracked,
      level: g.progression.level,
      gold: g.inventory.gold,
      spawnDistance: g.player.position.distanceTo(g.world.spawn),
    }
  })
  if (legacy.quest || legacy.tracked || legacy.level !== 5 || legacy.gold !== 321 || legacy.spawnDistance > 0.1) {
    throw new Error(`Save antigo não foi direcionado a Iara com progresso preservado: ${JSON.stringify(legacy)}`)
  }
  await captureScreenshot(page, '10-legacy-iara-dialogue.png')
  await page.getByRole('button', { name: 'Aceitar missão: O Despertar' }).evaluate(button => button.click())
  const acceptedLegacy = await page.evaluate(() => ({
    quest: window.__eclipse.game.quests.state('principal-01')?.status ?? null,
    tracked: window.__eclipse.game.quests.tracked,
  }))
  if (acceptedLegacy.quest !== 'ativa' || acceptedLegacy.tracked !== 'principal-01') {
    throw new Error('O aceite de O Despertar não funcionou após a migração legada.')
  }

  await page.getByRole('button', { name: 'Encerrar conversa' }).evaluate(button => button.click())
  const firstCampaignId = await page.evaluate(() => window.__eclipse.save.data.activeCampaignId)
  await page.evaluate(() => window.__eclipse.game.pause())
  await page.getByRole('button', { name: 'Sair para o título' }).evaluate(button => button.click())
  if (await page.getByRole('button', { name: 'Editar aparência' }).count()) throw new Error('O título ainda permite editar o personagem de uma campanha existente.')
  await page.getByRole('button', { name: 'Nova campanha' }).evaluate(button => button.click())
  await page.getByRole('button', { name: 'Iniciar campanha' }).click()
  await page.locator('[data-player-name]').fill('Nara Eclipse')
  await page.getByRole('button', { name: 'Confirmar e começar' }).click()
  await page.waitForFunction(() => window.__eclipse?.game
    && window.__eclipse.save.data.campaigns.length === 2
    && window.__eclipse.save.data.profile.name === 'Nara Eclipse', null, { timeout: 45000 })
  const newCampaignDialogue = await page.locator('.dialogue').evaluate(element => !element.classList.contains('hidden'))
  if (newCampaignDialogue) {
    await page.getByRole('button', { name: 'Encerrar conversa' }).evaluate(button => button.click())
  } else if (await page.evaluate(() => window.__eclipse.game.mode === 'paused')) {
    await page.getByRole('button', { name: 'Continuar', exact: true }).evaluate(button => button.click())
  }
  await page.waitForFunction(() => window.__eclipse?.game.mode === 'playing', null, { timeout: 10000 })
  const secondCampaign = await page.evaluate(() => ({
    activeId: window.__eclipse.save.data.activeCampaignId,
    profile: window.__eclipse.save.data.profile.name,
    campaigns: window.__eclipse.save.data.campaigns.map(slot => ({
      id: slot.id,
      name: slot.profile.name,
      level: slot.game?.progression.level ?? null,
      gold: slot.game?.inventory.gold ?? null,
    })),
  }))
  if (secondCampaign.activeId === firstCampaignId || secondCampaign.profile !== 'Nara Eclipse') {
    throw new Error(`A segunda personagem/campanha não foi criada: ${JSON.stringify(secondCampaign)}`)
  }
  const firstSlot = secondCampaign.campaigns.find(slot => slot.id === firstCampaignId)
  if (firstSlot?.name !== 'Teste Eclipse' || firstSlot.level !== 5 || firstSlot.gold !== 321) {
    throw new Error(`A campanha original foi sobrescrita: ${JSON.stringify(secondCampaign)}`)
  }
  const dialogueOpen = await page.locator('.dialogue').evaluate(element => !element.classList.contains('hidden'))
  if (dialogueOpen) await page.getByRole('button', { name: 'Encerrar conversa' }).evaluate(button => button.click())
  await page.evaluate(() => window.__eclipse.game.pause())
  await page.getByRole('button', { name: 'Sair para o título' }).evaluate(button => button.click())
  await page.getByRole('button', { name: /Retomar Teste Eclipse, nível 5/ }).evaluate(button => button.click())
  await page.waitForFunction(id => window.__eclipse?.game
    && window.__eclipse.save.data.activeCampaignId === id
    && window.__eclipse.save.data.profile.name === 'Teste Eclipse'
    && window.__eclipse.game.progression.level === 5, firstCampaignId, { timeout: 45000 })
  if (await page.evaluate(() => window.__eclipse.game.mode === 'paused')) {
    await page.getByRole('button', { name: 'Continuar', exact: true }).evaluate(button => button.click())
  }
  await page.waitForFunction(() => window.__eclipse?.game.mode === 'playing', null, { timeout: 10000 })
  console.log('multiple campaigns: created a second character and resumed the original save intact')

  await page.evaluate(() => window.__eclipse.game.pause())
  await page.getByRole('button', { name: 'Sair para o título' }).evaluate(button => button.click())
  const settingsBeforeDeletion = await page.evaluate(() => JSON.stringify(window.__eclipse.save.data.settings))
  const deleteConfirmations = []
  page.on('dialog', async dialog => {
    deleteConfirmations.push(dialog.message())
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Excluir save de Nara Eclipse' }).click()
  await page.waitForFunction(id => window.__eclipse.save.data.campaigns.length === 1
    && window.__eclipse.save.data.activeCampaignId === id
    && window.__eclipse.save.data.profile.name === 'Teste Eclipse', firstCampaignId)
  if (deleteConfirmations.length !== 1 || !deleteConfirmations[0].includes('As outras campanhas')) {
    throw new Error('A exclusão do save não exibiu confirmação clara sobre os outros slots.')
  }
  await page.getByRole('button', { name: 'Excluir save de Teste Eclipse' }).click()
  await page.waitForFunction(() => window.__eclipse.save.data.campaigns.length === 0
    && window.__eclipse.save.data.activeCampaignId === null
    && window.__eclipse.save.data.game === null)
  const afterDeletion = await page.evaluate(() => ({
    campaigns: window.__eclipse.save.data.campaigns.length,
    game: window.__eclipse.save.data.game,
    settings: JSON.stringify(window.__eclipse.save.data.settings),
  }))
  if (deleteConfirmations.length !== 2 || afterDeletion.settings !== settingsBeforeDeletion) {
    throw new Error(`Excluir saves alterou outros dados ou não pediu duas confirmações: ${JSON.stringify(afterDeletion)}`)
  }
  console.log('save deletion: confirmed per-slot removal, other campaigns preserved, settings unchanged')
}

await page.close()

const mobileUrl = new globalThis.URL(URL)
mobileUrl.searchParams.set('smoke', '1')
const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
mobilePage.on('console', message => { if (message.type() === 'error') errors.push(`mobile: ${message.text()}`) })
mobilePage.on('pageerror', error => errors.push(`mobile pageerror: ${error.message}`))
await mobilePage.goto(mobileUrl.toString(), { waitUntil: 'domcontentloaded' })
await mobilePage.waitForFunction(() => window.__eclipse?.game, { timeout: 30000 })
await mobilePage.getByRole('button', { name: 'Nova campanha' }).waitFor({ timeout: 20000 })
await mobilePage.getByRole('button', { name: 'Nova campanha' }).click()
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
await mobilePage.touchscreen.tap(
  mobileQuestButtonBox.x + mobileQuestButtonBox.width / 2,
  mobileQuestButtonBox.y + mobileQuestButtonBox.height / 2,
)
await mobilePage.locator('.quest-hunt').waitFor({ state: 'visible' })
const mobileLocateButton = mobilePage.locator('[data-hunt-locate]')
const mobileLocateButtonBox = await mobileLocateButton.boundingBox()
if (!mobileLocateButtonBox) throw new Error('Ação Localizar sem área clicável no diário mobile.')
await mobilePage.touchscreen.tap(
  mobileLocateButtonBox.x + mobileLocateButtonBox.width / 2,
  mobileLocateButtonBox.y + mobileLocateButtonBox.height / 2,
)
await mobilePage.waitForFunction(() => window.__eclipse.game.mode === 'playing')
await mobilePage.locator('.quest__locator:not(.hidden)').waitFor({ state: 'visible' })
await mobilePage.evaluate(() => window.__eclipse.ui.touch.show(true))
await captureScreenshot(mobilePage, '11-mobile-portrait.png')
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
  throw new Error(`Arraste touch não chegou aos controles: ${JSON.stringify(touchProbe)}`)
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
if (landscape.overlappingPoiLabels) throw new Error('Rótulos longos de destinos se sobrepõem no compasso mobile landscape.')
await captureScreenshot(mobilePage, '12-mobile-landscape.png')
console.log('mobile portrait and landscape:', { portrait, landscape })
await mobilePage.close()

console.log('errors:', errors.slice(0, 20))
await browser.close()
