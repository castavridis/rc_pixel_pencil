import { useEffect, useRef } from 'react'
import { Layer } from '../types'
import { compositeLayers } from '../lib/svg'

interface PreviewPanelProps {
  layers: Layer[]
  currentFrame: number
  pixelColor: string
  canvasColor: string
  onClose: () => void
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

export function PreviewPanel({ layers, currentFrame, pixelColor, canvasColor, onClose }: PreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const buf = compositeLayers(layers, currentFrame)
    const imageData = ctx.createImageData(128, 64)
    const [pr, pg, pb] = hexToRgb(pixelColor)
    const [br, bg, bb] = hexToRgb(canvasColor)

    for (let i = 0; i < buf.length; i++) {
      const o = i * 4
      if (buf[i]) {
        imageData.data[o] = pr; imageData.data[o + 1] = pg; imageData.data[o + 2] = pb
      } else {
        imageData.data[o] = br; imageData.data[o + 1] = bg; imageData.data[o + 2] = bb
      }
      imageData.data[o + 3] = 255
    }
    ctx.putImageData(imageData, 0, 0)
  }, [layers, currentFrame, pixelColor, canvasColor])

  return (
    <div className="preview-panel">
      <div className="preview-panel-header">
        <span>Preview</span>
        <button className="preview-close-btn" onClick={onClose} title="Close preview">×</button>
      </div>
      <canvas ref={canvasRef} width={128} height={64} />
    </div>
  )
}
