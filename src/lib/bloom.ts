import { BloomSettings, CANVAS_W, CANVAS_H } from '../types'

/**
 * Render bloom effect from pixelsCanvas onto bloomCanvas.
 * Uses regular HTMLCanvasElement (not OffscreenCanvas) for broad filter support.
 * bloomCanvas should NOT have image-rendering: pixelated so the soft blur renders correctly.
 */
export function renderBloom(
  pixelsCanvas: HTMLCanvasElement,
  bloomCanvas: HTMLCanvasElement,
  bloom: BloomSettings,
  zoom: number,
): void {
  const ctx = bloomCanvas.getContext('2d')!
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  // Convert screen-pixel radius to native canvas pixels so the effect is
  // consistent regardless of zoom level.
  const nativeRadius = bloom.radius / zoom

  // Pass A: tight core
  const offA = document.createElement('canvas')
  offA.width = CANVAS_W
  offA.height = CANVAS_H
  const ctxA = offA.getContext('2d')!
  ctxA.filter = `blur(${nativeRadius / 2}px)`
  ctxA.drawImage(pixelsCanvas, 0, 0)

  // Pass B: wide halo
  const offB = document.createElement('canvas')
  offB.width = CANVAS_W
  offB.height = CANVAS_H
  const ctxB = offB.getContext('2d')!
  ctxB.filter = `blur(${nativeRadius * 1.5}px)`
  ctxB.drawImage(pixelsCanvas, 0, 0)

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
