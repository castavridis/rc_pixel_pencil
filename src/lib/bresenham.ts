import { CANVAS_W, CANVAS_H, PixelBuffer } from '../types'

/**
 * Draw a line from (x0, y0) to (x1, y1) using Bresenham's algorithm.
 * Sets each pixel along the path to `value` (1 = lit, 0 = dark).
 */
export function bresenhamLine(
  buf: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  value: 0 | 1,
): void {
  x0 = Math.round(x0)
  y0 = Math.round(y0)
  x1 = Math.round(x1)
  y1 = Math.round(y1)

  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  while (true) {
    setPixel(buf, x0, y0, value)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 < dx) { err += dx; y0 += sy }
  }
}

export function setPixel(buf: PixelBuffer, x: number, y: number, value: 0 | 1): void {
  if (x < 0 || x >= CANVAS_W || y < 0 || y >= CANVAS_H) return
  buf[y * CANVAS_W + x] = value
}

export function getPixel(buf: PixelBuffer, x: number, y: number): number {
  if (x < 0 || x >= CANVAS_W || y < 0 || y >= CANVAS_H) return 0
  return buf[y * CANVAS_W + x]
}
