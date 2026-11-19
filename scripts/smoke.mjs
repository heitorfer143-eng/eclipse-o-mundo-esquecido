import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.SMOKE_URL ?? 'http://localhost:5173/'
const OUT = process.env.SHOTS_DIR ?? 'shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } })
const errors = []
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(12000)
await page.screenshot({ path: `${OUT}/01-title.png` })

const hasGame = await page.evaluate(() => Boolean(window.__eclipse?.game))
console.log('game object:', hasGame)
console.log('errors so far:', errors.slice(0, 8))

if (hasGame) {
  await page.getByRole('button', { name: 'Criar personagem · campanha' }).click()
  await page.getByText('Você acorda na Floresta de Brumal sem memória', { exact: false }).waitFor()
  await page.screenshot({ path: `${OUT}/02-prologue.png` })
  await page.getByRole('button', { name: 'Iniciar campanha' }).click()
  await page.locator('[data-player-name]').fill('Teste Eclipse')
  await page.screenshot({ path: `${OUT}/03-character.png` })
  await page.getByRole('button', { name: 'Confirmar e começar' }).click()
  await page.locator('.dialogue').waitFor({ state: 'visible' })
  await page.screenshot({ path: `${OUT}/04-iara-dialogue.png` })
  await page.getByRole('button', { name: 'Aceitar missão: O Despertar' }).click()
  await page.getByRole('button', { name: 'Encerrar conversa' }).click()
  await page.waitForTimeout(4500)
  await page.getByText('Teste Eclipse', { exact: true }).waitFor()
  await page.screenshot({ path: `${OUT}/05-game.png` })
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
  await page.screenshot({ path: `${OUT}/06-walk.png` })
  await page.keyboard.press('Tab')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/07-inventory.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.keyboard.press('KeyM')
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `${OUT}/08-map.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.keyboard.press('KeyK')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/09-skills.png` })
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
    const key = 'eclipse.o-mundo-esquecido.v2'
    const raw = localStorage.getItem(key)
    if (!raw) throw new Error('Save da campanha não encontrado para a migração legada.')
    const data = JSON.parse(raw)
    if (!data.game) throw new Error('Slot de campanha ausente no save local.')
    data.game.position = [640, 35, 620]
    data.game.progression.level = 5
    data.game.inventory.gold = 321
    data.game.quests = { tracked: 'principal-01', states: {} }
    data.game.updatedAt = Date.now()
    localStorage.setItem(key, JSON.stringify(data))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Continuar campanha' }).waitFor()
  await page.getByRole('button', { name: 'Continuar campanha' }).click()
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
  await page.screenshot({ path: `${OUT}/10-legacy-iara-dialogue.png` })
  await page.getByRole('button', { name: 'Aceitar missão: O Despertar' }).click()
  const acceptedLegacy = await page.evaluate(() => ({
    quest: window.__eclipse.game.quests.state('principal-01')?.status ?? null,
    tracked: window.__eclipse.game.quests.tracked,
  }))
  if (acceptedLegacy.quest !== 'ativa' || acceptedLegacy.tracked !== 'principal-01') {
    throw new Error('O aceite de O Despertar não funcionou após a migração legada.')
  }
}

console.log('errors:', errors.slice(0, 20))
await browser.close()
