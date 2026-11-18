import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 640, height: 400 } })
page.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 300)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(8000)
await page.evaluate(() => document.querySelectorAll('.title__menu .btn')[0].click())
await page.waitForTimeout(4000)
console.log(await page.evaluate(() => {
  const g = window.__eclipse.game
  const times = {}
  const wrap = (obj, key, label) => {
    const original = obj[key].bind(obj)
    times[label] = 0
    obj[key] = (...args) => {
      const t0 = performance.now()
      const out = original(...args)
      times[label] += performance.now() - t0
      return out
    }
  }
  wrap(g.world, 'update', 'world')
  wrap(g.population, 'update', 'population')
  wrap(g.spawner, 'update', 'spawner')
  wrap(g.player, 'step', 'player')
  wrap(g.effects, 'update', 'effects')
  wrap(g.projectiles, 'update', 'projectiles')
  wrap(g.ui, 'renderHud', 'hud')
  const zero = { moveX: 0, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: false, rollPressed: false, attackPressed: false, attackHeld: false, blockHeld: false, lookX: 0, lookY: 0, interact: false }
  const t0 = performance.now()
  for (let i = 0; i < 120; i += 1) g.update(1 / 60, zero)
  const total = performance.now() - t0
  const rounded = Object.fromEntries(Object.entries(times).map(([k, v]) => [k, +(v / 120).toFixed(2)]))
  return { avgTotalMs: +(total / 120).toFixed(2), perCallMs: rounded, built: g.world.pois.builtCount, loaded: g.world.pois.loadedCount, npcs: g.population.npcs.length, enemies: g.spawner.enemies.length }
}))
await browser.close()
