import { BloomSettings, CANVAS_W, CANVAS_H } from '../types'

/**
 * Render bloom effect from pixelsCanvas onto bloomCanvas.
 * Two-pass offscreen blur composite.
 */
export function renderBloom(
  pixelsCanvas: HTMLCanvasElement,
  bloomCanvas: HTMLCanvasElement,
  bloom: BloomSettings,
): void {
  const ctx = bloomCanvas.getContext('2d')!
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  // Pass A: tight core
  const offA = new OffscreenCanvas(CANVAS_W, CANVAS_H)
  const ctxA = offA.getContext('2d')!
  ctxA.filter = `blur(${bloom.radius / 2}px)`
  ctxA.drawImage(pixelsCanvas, 0, 0)

  // Pass B: wide halo
  const offB = new OffscreenCanvas(CANVAS_W, CANVAS_H)
  const ctxB = offB.getContext('2d')!
  ctxB.filter = `blur(${bloom.radius * 1.5}px)`
  ctxB.drawImage(pixelsCanvas, 0, 0)

  // Composite onto bloomCanvas
  ctx.globalCompositeOperation = 'lighter'

  ctx.globalAlpha = bloom.intensity * 0.6
  ctx.drawImage(offA, 0, 0)

  ctx.globalAlpha = bloom.intensity * 0.4
  ctx.drawImage(offB, 0, 0)

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

export function clearBloom(bloomCanvas: HTMLCanvasElement): void {
  const ctx = bloomCanvas.getContext('2d')!
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
}
