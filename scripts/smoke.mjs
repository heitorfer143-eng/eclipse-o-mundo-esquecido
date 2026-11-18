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
  await page.getByRole('button', { name: 'Nova aventura' }).click()
  await page.waitForTimeout(4500)
  await page.screenshot({ path: `${OUT}/02-game.png` })
  const state = await page.evaluate(() => {
    const g = window.__eclipse.game
    return {
      mode: g.mode,
      pos: g.player.position.toArray().map(n => Math.round(n)),
      health: Math.round(g.player.health),
      enemies: g.spawner.enemies.length,
      level: g.progression.level,
      biome: g.world.biomeAt(g.player.position.x, g.player.position.z),
      fps: g.fps,
      pois: g.world.pois.list().length,
      drawCalls: null,
    }
  })
  console.log('state:', state)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1400)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/03-walk.png` })
  await page.keyboard.press('Tab')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/04-inventory.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.keyboard.press('KeyM')
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `${OUT}/05-map.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.keyboard.press('KeyK')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/06-skills.png` })
}

console.log('errors:', errors.slice(0, 20))
await browser.close()
