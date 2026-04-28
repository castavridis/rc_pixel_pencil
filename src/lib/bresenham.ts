import { CANVAS_W, CANVAS_H, PixelBuffer } from '../types'

export function setPixel(buf: PixelBuffer, x: number, y: number, value: 0 | 1 | 2): void {
  if (x < 0 || x >= CANVAS_W || y < 0 || y >= CANVAS_H) return
  buf[y * CANVAS_W + x] = value
}

export function getPixel(buf: PixelBuffer, x: number, y: number): number {
  if (x < 0 || x >= CANVAS_W || y < 0 || y >= CANVAS_H) return 0
  return buf[y * CANVAS_W + x]
}

export function fillSquare(
  buf: PixelBuffer,
  cx: number,
  cy: number,
  size: number,
  value: 0 | 1 | 2,
): void {
  const half = Math.floor(size / 2)
  for (let dy = -half; dy < size - half; dy++) {
    for (let dx = -half; dx < size - half; dx++) {
      setPixel(buf, cx + dx, cy + dy, value)
    }
  }
}

/**
 * Bresenham line that calls `stamp(x, y)` at each pixel along the path.
 * Use this instead of bresenhamLine when you need a sized stamp (e.g. eraser).
 */
export function bresenhamLineWithStamp(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stamp: (x: number, y: number) => void,
): void {
  x0 = Math.round(x0); y0 = Math.round(y0)
  x1 = Math.round(x1); y1 = Math.round(y1)

  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  while (true) {
    stamp(x0, y0)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 < dx)  { err += dx; y0 += sy }
  }
}

/**
 * Convenience wrapper: Bresenham line that writes a single pixel value.
 */
export function bresenhamLine(
  buf: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  value: 0 | 1,
): void {
  bresenhamLineWithStamp(x0, y0, x1, y1, (x, y) => setPixel(buf, x, y, value))
}
