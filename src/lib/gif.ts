import { Layer, CANVAS_W, CANVAS_H } from '../types'
import { downloadBlob, compositeLayersMultiValue } from './svg'
import { GIFEncoder, applyPalette } from 'gifenc'

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function pixelBufferToRGBA(
  frame: Uint8Array,
  pixelRgb: [number, number, number],
  darkRgb: [number, number, number],
  bgRgb: [number, number, number],
): Uint8Array {
  const rgba = new Uint8Array(CANVAS_W * CANVAS_H * 4)
  for (let i = 0; i < CANVAS_W * CANVAS_H; i++) {
    const v = frame[i]
    const [r, g, b] = v === 1 ? pixelRgb : v === 2 ? darkRgb : bgRgb
    rgba[i * 4 + 0] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

export async function exportAnimatedGIF(
  layers: Layer[],
  fps: number,
  pixelColor = '#ffffff',
  darkColor = '#000000',
  canvasColor = '#000000',
): Promise<void> {
  const encoder = GIFEncoder()
  const bgRgb = hexToRgb(canvasColor)
  const pixelRgb = hexToRgb(pixelColor)
  const darkRgb = hexToRgb(darkColor)
  const palette = [bgRgb, pixelRgb, darkRgb] as [number, number, number][]
  const delay = Math.round(1000 / fps)
  const frameCount = layers[0]?.frames.length ?? 1

  for (let fi = 0; fi < frameCount; fi++) {
    const frame = compositeLayersMultiValue(layers, fi)
    const rgba = pixelBufferToRGBA(frame, pixelRgb, darkRgb, bgRgb)
    const indexed = applyPalette(rgba, palette)
    encoder.writeFrame(indexed, CANVAS_W, CANVAS_H, { palette, delay, repeat: 0 })
  }

  encoder.finish()
  const bytes = encoder.bytes()
  downloadBlob(new Blob([bytes.slice().buffer], { type: 'image/gif' }), 'animation.gif')
}

export function exportPNG(
  pixelsCanvas: HTMLCanvasElement,
  bloomCanvas: HTMLCanvasElement,
): void {
  const offscreen = document.createElement('canvas')
  offscreen.width = CANVAS_W
  offscreen.height = CANVAS_H
  const ctx = offscreen.getContext('2d')!

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.drawImage(pixelsCanvas, 0, 0)
  ctx.drawImage(bloomCanvas, 0, 0)

  offscreen.toBlob(blob => {
    if (blob) downloadBlob(blob, 'frame.png')
  }, 'image/png')
}
