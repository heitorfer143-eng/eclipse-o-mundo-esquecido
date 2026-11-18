import type { BiomeId } from '../game/data/types'
import { BIOMES } from '../game/world/biomes'
import type { World } from '../game/world/world'

const SIZE = 240
const EXTENT = 2100

/**
 * Bakes a parchment-style world map once. Sampling a 240x240 grid keeps generation under a few
 * hundred milliseconds while still showing coastlines, mountain shading and biome bands.
 */
export function generateWorldMap(world: World): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 900
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const grid = document.createElement('canvas')
  grid.width = SIZE
  grid.height = SIZE
  const gctx = grid.getContext('2d')
  if (!gctx) return canvas
  const heights = new Float32Array(SIZE * SIZE)
  const biomes: BiomeId[] = new Array(SIZE * SIZE)
  const step = (EXTENT * 2) / SIZE
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const wx = -EXTENT + x * step
      const wz = -EXTENT + y * step
      heights[y * SIZE + x] = world.heightAt(wx, wz)
      biomes[y * SIZE + x] = world.biomeAt(wx, wz)
    }
  }
  const image = gctx.createImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const index = y * SIZE + x
      const height = heights[index]
      const biome = BIOMES[biomes[index]]
      let color: [number, number, number]
      if (height < 0) {
        const depth = Math.min(1, -height / 45)
        color = mix(hexToRgb('#2f6f83'), hexToRgb('#0d2431'), depth)
      } else {
        color = hexToRgb(biome.grass)
        const slope = slopeAt(heights, x, y)
        const shade = Math.min(0.55, Math.max(-0.45, slope * 2.2 + (height - 20) / 220))
        color = shadeColor(color, shade)
        if (height > 150) color = mix(color, hexToRgb('#d8d4cc'), Math.min(0.75, (height - 150) / 180))
      }
      image.data[index * 4] = color[0]
      image.data[index * 4 + 1] = color[1]
      image.data[index * 4 + 2] = color[2]
      image.data[index * 4 + 3] = 255
    }
  }
  gctx.putImageData(image, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(grid, 0, 0, canvas.width, canvas.height)

  // Parchment wash and vignette.
  ctx.globalCompositeOperation = 'multiply'
  const wash = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  wash.addColorStop(0, '#f0e2c4')
  wash.addColorStop(0.5, '#e6d5b3')
  wash.addColorStop(1, '#d9c49c')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'source-over'
  const vignette = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.3, canvas.width / 2, canvas.height / 2, canvas.width * 0.72)
  vignette.addColorStop(0, 'rgba(60,42,20,0)')
  vignette.addColorStop(1, 'rgba(48,32,14,0.55)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Grid + frame
  ctx.strokeStyle = 'rgba(90,64,32,0.16)'
  ctx.lineWidth = 1
  for (let i = 1; i < 8; i += 1) {
    const p = (canvas.width / 8) * i
    ctx.beginPath()
    ctx.moveTo(p, 0)
    ctx.lineTo(p, canvas.height)
    ctx.moveTo(0, p)
    ctx.lineTo(canvas.width, p)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(60,42,20,0.55)'
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6)

  // Compass rose
  ctx.save()
  ctx.translate(canvas.width - 84, 88)
  ctx.strokeStyle = 'rgba(58,40,18,0.6)'
  ctx.fillStyle = 'rgba(58,40,18,0.5)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, 40, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, -36)
  ctx.lineTo(9, 0)
  ctx.lineTo(0, 36)
  ctx.lineTo(-9, 0)
  ctx.closePath()
  ctx.fill()
  ctx.font = '600 16px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('N', 0, -46)
  ctx.restore()

  return canvas
}

function slopeAt(heights: Float32Array, x: number, y: number): number {
  const left = heights[y * SIZE + Math.max(0, x - 1)]
  const right = heights[y * SIZE + Math.min(SIZE - 1, x + 1)]
  const up = heights[Math.max(0, y - 1) * SIZE + x]
  const down = heights[Math.min(SIZE - 1, y + 1) * SIZE + x]
  return (right - left + (down - up)) / 24
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]
}

function shadeColor(color: [number, number, number], amount: number): [number, number, number] {
  const factor = 1 + amount
  return [Math.min(255, Math.round(color[0] * factor)), Math.min(255, Math.round(color[1] * factor)), Math.min(255, Math.round(color[2] * factor))]
}
