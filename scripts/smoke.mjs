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

// New-game flow: exactly one identity, saved before the first story dialogue.
await page.getByRole('button', { name: 'Criar personagem', exact: true }).click()
await page.locator('.campaign-intro').waitFor({ state: 'visible' })
await page.getByRole('button', { name: 'Iniciar campanha' }).click()
await page.locator('[data-player-name]').fill('Teste Eclipse')
await page.locator('[data-aura="arcano"]').click()
await captureScreenshot(page, '02-character.png')
await page.getByRole('button', { name: 'Confirmar e começar' }).click()
await page.locator('.dialogue').waitFor({ state: 'visible', timeout: 45000 })
await captureScreenshot(page, '03-iara-dialogue.png')
await page.getByRole('button', { name: 'Aceitar missão: O Despertar' }).click()
await page.getByRole('button', { name: 'Encerrar conversa' }).click()
await page.waitForFunction(() => window.__eclipse.game.mode === 'playing' && window.__eclipse.game.quests.tracked === 'principal-01')
await page.waitForTimeout(1000)

const openingState = await page.evaluate(() => {
  const g = window.__eclipse.game
  const iara = g.population.npcs.find(npc => npc.def.id === 'iara')
  const profile = window.__eclipse.save.activeCampaign?.profile
  const equipment = g.inventory.equipment
  const cameraBackX = Math.sin(g.player.facing)
  const cameraBackZ = Math.cos(g.player.facing)
  return {
    mode: g.mode,
    profile,
    distanceToIara: iara?.position.distanceTo(g.player.position) ?? Infinity,
    iaraCameraSide: iara
      ? (iara.position.x - g.player.position.x) * cameraBackX + (iara.position.z - g.player.position.z) * cameraBackZ
      : Infinity,
    maxEnemyHeight: Math.max(0, ...g.spawner.enemies.map(enemy => enemy.height)),
    quest: g.quests.state('principal-01')?.status ?? null,
    tracked: g.quests.tracked,
    storyFlags: g.save.data.game?.storyFlags ?? [],
    armorEquipped: Boolean(equipment.armadura || equipment.capacete || equipment.botas),
    activeCampaigns: g.save.data.campaigns.length,
  }
})
console.log('opening state:', openingState)
if (openingState.mode !== 'playing' || openingState.quest !== 'ativa' || openingState.tracked !== 'principal-01') {
  throw new Error(`O aceite da missão inicial não persistiu: ${JSON.stringify(openingState)}`)
}
if (openingState.profile?.name !== 'Teste Eclipse' || openingState.profile.modelId !== 'Survivor' || openingState.profile.auraColor !== '#c094ff') {
  throw new Error(`Perfil inicial deveria ser um sobrevivente sem armadura: ${JSON.stringify(openingState.profile)}`)
}
if (openingState.armorEquipped || openingState.activeCampaigns !== 1 || !openingState.storyFlags.includes('iara-intro')) {
  throw new Error('A campanha não começou com uma identidade única, sem armadura e com a introdução marcada.')
}
if (openingState.distanceToIara > 3.4 || openingState.iaraCameraSide >= 0) throw new Error('Iara não está acessível ou ficou entre a câmera e o jogador.')
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

// Existing CC0 house GLBs must appear in streamed settlements; the nearby door must be usable.
await page.waitForFunction(() => {
  let count = 0
  window.__eclipse.game.world.pois.group.traverse(object => { if (object.name.startsWith('house-model-')) count += 1 })
  return count >= 7
}, null, { timeout: 30000 })
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
await page.getByRole('button', { name: 'Iniciar campanha' }).click()
await page.locator('[data-player-name]').fill('Nara Eclipse')
await page.getByRole('button', { name: 'Confirmar e começar' }).click()
await page.locator('.dialogue').waitFor({ state: 'visible', timeout: 45000 })
const recreated = await page.evaluate(() => ({
  count: window.__eclipse.save.data.campaigns.length,
  name: window.__eclipse.save.activeCampaign?.profile.name,
  model: window.__eclipse.save.activeCampaign?.profile.modelId,
}))
if (recreated.count !== 1 || recreated.name !== 'Nara Eclipse' || recreated.model !== 'Survivor') {
  throw new Error(`Após excluir, a campanha única não pôde ser recriada corretamente: ${JSON.stringify(recreated)}`)
}
await page.getByRole('button', { name: 'Encerrar conversa' }).click()
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
