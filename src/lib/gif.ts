import { PixelBuffer, Layer, CANVAS_W, CANVAS_H } from '../types'
import { downloadBlob } from './svg'
import { GIFEncoder, applyPalette } from 'gifenc'

function compositeLayers(layers: Layer[], frameIndex: number): PixelBuffer {
  const out = new Uint8Array(CANVAS_W * CANVAS_H) as PixelBuffer
  for (const layer of layers) {
    if (!layer.visible) continue
    const frame = layer.frames[frameIndex]
    if (!frame) continue
    for (let i = 0; i < out.length; i++) {
      if (frame[i]) out[i] = 1
    }
  }
  return out
}

function pixelBufferToRGBA(frame: PixelBuffer): Uint8Array {
  const rgba = new Uint8Array(CANVAS_W * CANVAS_H * 4)
  for (let i = 0; i < CANVAS_W * CANVAS_H; i++) {
    const v = frame[i] ? 255 : 0
    rgba[i * 4 + 0] = v
    rgba[i * 4 + 1] = v
    rgba[i * 4 + 2] = v
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

export async function exportAnimatedGIF(layers: Layer[], fps: number): Promise<void> {
  const encoder = GIFEncoder()
  const palette = [[0, 0, 0], [255, 255, 255]]
  const delay = Math.round(1000 / fps)
  const frameCount = layers[0]?.frames.length ?? 1

  for (let fi = 0; fi < frameCount; fi++) {
    const frame = compositeLayers(layers, fi)
    const rgba = pixelBufferToRGBA(frame)
    const indexed = applyPalette(rgba, palette)
    encoder.writeFrame(indexed, CANVAS_W, CANVAS_H, { palette, delay, repeat: 0 })
  }

  encoder.finish()
  const bytes = encoder.bytes()
  // Use slice() to get a regular ArrayBuffer (not SharedArrayBuffer)
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
