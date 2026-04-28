import { BloomSettings, CANVAS_W, CANVAS_H } from '../types'

export function renderGlow(
  pixelsCanvas: HTMLCanvasElement,
  glowCanvas: HTMLCanvasElement,
  glow: BloomSettings,
  zoom: number,
): void {
  const ctx = glowCanvas.getContext('2d')!
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  const r = glow.radius / zoom

  const passes = [
    { blur: r * 0.4, alpha: glow.intensity * 0.55 },
    { blur: r * 1.2, alpha: glow.intensity * 0.28 },
    { blur: r * 3.0, alpha: glow.intensity * 0.12 },
    { blur: r * 6.0, alpha: glow.intensity * 0.05 },
  ]

  for (const { blur, alpha } of passes) {
    const off = document.createElement('canvas')
    off.width = CANVAS_W
    off.height = CANVAS_H
    const octx = off.getContext('2d')!
    octx.filter = `blur(${blur}px)`
    octx.drawImage(pixelsCanvas, 0, 0)
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = alpha
    ctx.drawImage(off, 0, 0)
  }

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

export function clearGlow(glowCanvas: HTMLCanvasElement): void {
  const ctx = glowCanvas.getContext('2d')!
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
}
