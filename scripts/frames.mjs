import { chromium } from 'playwright'

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 900, height: 560 } })
page.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 300)))
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)) })
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
await page.evaluate(() => document.querySelectorAll('.title__menu .btn')[0].click())
await page.waitForTimeout(3000)

for (let round = 0; round < 3; round += 1) {
  const result = await page.evaluate(async () => {
    const g = window.__eclipse.game
    const ui = window.__eclipse.ui
    const before = g.playtime
    let frames = 0
    const start = performance.now()
    await new Promise(resolve => {
      const tick = () => {
        frames += 1
        if (performance.now() - start < 2000) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
    return {
      frames,
      wall: +((performance.now() - start) / 1000).toFixed(2),
      simDelta: +(g.playtime - before).toFixed(2),
      blocking: ui.blocking,
      mode: g.mode,
      titleVisible: document.querySelector('.title')?.className,
      panels: document.querySelector('.panel')?.className,
    }
  })
  console.log(round, result)
}
await browser.close()
