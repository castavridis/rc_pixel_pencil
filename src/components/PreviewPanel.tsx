import { useEffect, useRef, useState } from 'react'
import { Layer } from '../types'
import { compositeLayersMultiValue } from '../lib/svg'

interface PreviewPanelProps {
  layers: Layer[]
  currentFrame: number
  pixelColor: string
  darkColor: string
  canvasColor: string
  onClose: () => void
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

export function PreviewPanel({ layers, currentFrame, pixelColor, darkColor, canvasColor, onClose }: PreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - 148,
    y: window.innerHeight - 104,
  }))
  const dragOffset = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const buf = compositeLayersMultiValue(layers, currentFrame)
    const imageData = ctx.createImageData(128, 64)
    const [pr, pg, pb] = hexToRgb(pixelColor)
    const [dr, dg, db] = hexToRgb(darkColor)
    const [br, bg, bb] = hexToRgb(canvasColor)

    for (let i = 0; i < buf.length; i++) {
      const o = i * 4
      if (buf[i] === 1) {
        imageData.data[o] = pr; imageData.data[o + 1] = pg; imageData.data[o + 2] = pb
      } else if (buf[i] === 2) {
        imageData.data[o] = dr; imageData.data[o + 1] = dg; imageData.data[o + 2] = db
      } else {
        imageData.data[o] = br; imageData.data[o + 1] = bg; imageData.data[o + 2] = bb
      }
      imageData.data[o + 3] = 255
    }
    ctx.putImageData(imageData, 0, 0)
  }, [layers, currentFrame, pixelColor, darkColor, canvasColor])

  function handlePointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('.preview-close-btn')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragOffset.current) return
    const pw = panelRef.current?.offsetWidth ?? 130
    const ph = panelRef.current?.offsetHeight ?? 98
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - pw, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - ph, e.clientY - dragOffset.current.y)),
    })
  }

  function handlePointerUp() {
    dragOffset.current = null
  }

  return (
    <div
      ref={panelRef}
      className="preview-panel"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="preview-panel-header">
        <span>Preview</span>
        <button className="preview-close-btn" onClick={onClose} title="Close preview">×</button>
      </div>
      <canvas ref={canvasRef} width={128} height={64} />
    </div>
  )
}
