import { BloomSettings, CANVAS_W, CANVAS_H, GLOW_PAD } from '../types'

const BLOOM_W = CANVAS_W + GLOW_PAD * 2
const BLOOM_H = CANVAS_H + GLOW_PAD * 2

export function renderGlow(
  pixelsCanvas: HTMLCanvasElement,
  glowCanvas: HTMLCanvasElement,
  glow: BloomSettings,
): void {
  const ctx = glowCanvas.getContext('2d')!
  ctx.clearRect(0, 0, BLOOM_W, BLOOM_H)

  const srcCtx = pixelsCanvas.getContext('2d')!
  const { data } = srcCtx.getImageData(0, 0, CANVAS_W, CANVAS_H)

  const r = glow.radius
  const peak = Math.min(glow.intensity, 1)

  ctx.globalCompositeOperation = 'lighter'

  for (let y = 0; y < CANVAS_H; y++) {
    for (let x = 0; x < CANVAS_W; x++) {
      const i = (y * CANVAS_W + x) * 4
      if (data[i + 3] === 0) continue

      const R = data[i], G = data[i + 1], B = data[i + 2]
      const cx = x + 0.5 + GLOW_PAD
      const cy = y + 0.5 + GLOW_PAD

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      grad.addColorStop(0,   `rgba(${R},${G},${B},${peak})`)
      grad.addColorStop(0.4, `rgba(${R},${G},${B},${peak * 0.4})`)
      grad.addColorStop(1,   `rgba(${R},${G},${B},0)`)

      ctx.fillStyle = grad
      const x1 = Math.max(0, cx - r)
      const y1 = Math.max(0, cy - r)
      const x2 = Math.min(BLOOM_W, cx + r)
      const y2 = Math.min(BLOOM_H, cy + r)
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1)
    }
  }

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

export function clearGlow(glowCanvas: HTMLCanvasElement): void {
  const ctx = glowCanvas.getContext('2d')!
  ctx.clearRect(0, 0, BLOOM_W, BLOOM_H)
}
