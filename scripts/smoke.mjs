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
  await captureScreenshot(page, '03-character.png')
  await page.getByRole('button', { name: 'Confirmar e começar' }).click()
  await page.locator('.dialogue').waitFor({ state: 'visible' })
  await captureScreenshot(page, '04-iara-dialogue.png')
  await page.getByRole('button', { name: 'Aceitar missão: O Despertar' }).click()
  await page.getByRole('button', { name: 'Encerrar conversa' }).click()
  await page.waitForTimeout(4500)
  await page.getByText('Teste Eclipse', { exact: true }).waitFor()
  await captureScreenshot(page, '05-game.png')
  const state = await page.evaluate(() => {
    const g = window.__eclipse.game
    const iara = g.population.npcs.find(npc => npc.def.id === 'iara')
    const iaraDistance = iara?.position.distanceTo(g.player.position) ?? Infinity
    const maxEnemyHeight = Math.max(0, ...g.spawner.enemies.map(enemy => enemy.height))
    return {
      mode: g.mode,
      pos: g.player.position.toArray().map(n => Math.round(n)),
      health: Math.round(g.player.health),
      enemies: g.spawner.enemies.length,
      maxEnemyHeight,
      iaraDistance,
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
  if (state.iaraDistance > 3.4) throw new Error('Iara não está acessível no ponto de início.')
  if (state.maxEnemyHeight > 2.45) throw new Error(`Mob maior que o limite: ${state.maxEnemyHeight} m.`)
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
  await page.getByText('Teste Eclipse', { exact: true }).waitFor()
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
}

await page.close()

const mobileUrl = new globalThis.URL(URL)
mobileUrl.searchParams.set('smoke', '1')
const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
mobilePage.on('console', message => { if (message.type() === 'error') errors.push(`mobile: ${message.text()}`) })
mobilePage.on('pageerror', error => errors.push(`mobile pageerror: ${error.message}`))
await mobilePage.goto(mobileUrl.toString(), { waitUntil: 'domcontentloaded' })
await mobilePage.waitForFunction(() => window.__eclipse?.game, { timeout: 30000 })
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
await mobilePage.setViewportSize({ width: 844, height: 390 })
await mobilePage.waitForTimeout(350)
const landscape = await mobilePage.evaluate(() => ({
  appHeight: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
  canvasHeight: getComputedStyle(document.querySelector('#game')).height,
  cameraFov: window.__eclipse.camera.camera.fov,
  isLandscape: matchMedia('(orientation: landscape)').matches,
}))
if (landscape.cameraFov !== 62 || !landscape.isLandscape || landscape.appHeight !== '390px' || landscape.canvasHeight !== '390px') {
  throw new Error(`O jogo não se adaptou ao giro do celular: ${JSON.stringify(landscape)}`)
}
await captureScreenshot(mobilePage, '12-mobile-landscape.png')
console.log('mobile portrait and landscape:', { portrait, landscape })
await mobilePage.close()

console.log('errors:', errors.slice(0, 20))
await browser.close()
