import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 640, height: 400 } })
page.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 300)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(8000)
await page.evaluate(() => document.querySelectorAll('.title__menu .btn')[0].click())
await page.waitForTimeout(6000)
console.log(await page.evaluate(() => {
  const g = window.__eclipse.game
  const zero = { moveX: 0, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: false, rollPressed: false, attackPressed: false, attackHeld: false, blockHeld: false, lookX: 0, lookY: 0, interact: false }
  const samples = []
  for (let i = 0; i < 30; i += 1) {
    const t0 = performance.now()
    g.update(1 / 60, zero)
    samples.push(+(performance.now() - t0).toFixed(2))
  }
  return {
    samples,
    built: g.world.pois.builtCount,
    loaded: g.world.pois.loadedCount,
    total: g.world.pois.list().length,
    npcs: g.population.npcs.length,
    enemies: g.spawner.enemies.length,
    play: +g.playtime.toFixed(2),
  }
}))
await browser.close()
