import { PixelBuffer, Layer, CANVAS_W, CANVAS_H } from '../types'
import { strToU8, zipSync } from 'fflate'

// ── Export ────────────────────────────────────────────────────────────────────

export function compositeLayers(layers: Layer[], frameIndex: number): PixelBuffer {
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

export function exportSVG(frame: PixelBuffer): string {
  const rects: string[] = []
  for (let y = 0; y < CANVAS_H; y++) {
    for (let x = 0; x < CANVAS_W; x++) {
      if (frame[y * CANVAS_W + x]) {
        rects.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`)
      }
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" width="${CANVAS_W}" height="${CANVAS_H}">`,
    `  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="#000000"/>`,
    `  <g id="lit-pixels" fill="#FFFFFF">`,
    ...rects.map(r => `    ${r}`),
    `  </g>`,
    `</svg>`,
  ].join('\n')
}

export function downloadSVG(layers: Layer[], frameIndex: number, filename = 'frame.svg'): void {
  const frame = compositeLayers(layers, frameIndex)
  const svg = exportSVG(frame)
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), filename)
}

export function downloadFramesSVGZip(layers: Layer[]): void {
  const frameCount = layers[0]?.frames.length ?? 1
  const files: Record<string, Uint8Array> = {}
  for (let i = 0; i < frameCount; i++) {
    const frame = compositeLayers(layers, i)
    const name = `frame-${String(i + 1).padStart(2, '0')}.svg`
    files[name] = strToU8(exportSVG(frame))
  }
  const zip = zipSync(files, { level: 0 })
  downloadBlob(new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' }), 'frames.zip')
}

// ── Import ────────────────────────────────────────────────────────────────────

/**
 * Parse an SVG string and return a PixelBuffer for the 128×64 canvas.
 *
 * Strategy:
 * 1. Exact parse: if viewBox is 128×64 and only 1×1 rects → snap coords directly.
 * 2. Rasterize fallback: render to offscreen canvas at native size, scale-to-fit,
 *    threshold luminance > 50%.
 */
export async function importSVG(svgText: string): Promise<PixelBuffer> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const svgEl = doc.querySelector('svg')
  if (!svgEl) throw new Error('Invalid SVG')

  // Attempt exact parse
  const exact = tryExactParse(svgEl as unknown as SVGSVGElement)
  if (exact) return exact

  // Rasterize fallback
  return rasterizeSVG(svgText)
}

function tryExactParse(svg: SVGSVGElement): PixelBuffer | null {
  const vb = svg.getAttribute('viewBox')
  if (vb !== `0 0 ${CANVAS_W} ${CANVAS_H}`) return null

  const rects = svg.querySelectorAll('rect')
  const buf = new Uint8Array(CANVAS_W * CANVAS_H)
  let allExact = true

  for (const rect of rects) {
    const w = parseFloat(rect.getAttribute('width') ?? '0')
    const h = parseFloat(rect.getAttribute('height') ?? '0')
    const fill = rect.getAttribute('fill') ?? ''
    // Skip background rect
    if (w === CANVAS_W && h === CANVAS_H) continue
    if (w !== 1 || h !== 1) { allExact = false; break }
    const x = Math.round(parseFloat(rect.getAttribute('x') ?? '0'))
    const y = Math.round(parseFloat(rect.getAttribute('y') ?? '0'))
    if (fill.toLowerCase() !== '#000000') {
      if (x >= 0 && x < CANVAS_W && y >= 0 && y < CANVAS_H) {
        buf[y * CANVAS_W + x] = 1
      }
    }
  }

  return allExact ? buf : null
}

async function rasterizeSVG(svgText: string): Promise<PixelBuffer> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Scale to fit 128×64 (letterbox)
      const scale = Math.min(CANVAS_W / img.naturalWidth, CANVAS_H / img.naturalHeight)
      const dw = Math.round(img.naturalWidth * scale)
      const dh = Math.round(img.naturalHeight * scale)
      const dx = Math.round((CANVAS_W - dw) / 2)
      const dy = Math.round((CANVAS_H - dh) / 2)

      const offscreen = new OffscreenCanvas(CANVAS_W, CANVAS_H)
      const ctx = offscreen.getContext('2d')!
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      ctx.drawImage(img, dx, dy, dw, dh)

      const imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H)
      const buf = new Uint8Array(CANVAS_W * CANVAS_H)

      for (let i = 0; i < CANVAS_W * CANVAS_H; i++) {
        const r = imageData.data[i * 4]
        const g = imageData.data[i * 4 + 1]
        const b = imageData.data[i * 4 + 2]
        const lum = 0.299 * r + 0.587 * g + 0.114 * b
        buf[i] = lum > 127 ? 1 : 0
      }

      resolve(buf)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG image'))
    }

    img.src = url
  })
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
