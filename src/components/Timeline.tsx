import { useEffect, useRef } from 'react'
import { Layer, PixelBuffer, CANVAS_W, CANVAS_H, MAX_FRAMES } from '../types'

interface TimelineProps {
  layers: Layer[]
  currentFrame: number
  isPlaying: boolean
  onSelectFrame: (i: number) => void
  onAddFrame: () => void
  onDeleteFrame: () => void
  onDuplicateFrame: () => void
  onTogglePlay: () => void
  pixelColor: string
  darkColor: string
}

function compositeLayers(layers: Layer[], frameIndex: number): PixelBuffer {
  const out = new Uint8Array(CANVAS_W * CANVAS_H) as PixelBuffer
  for (const layer of layers) {
    if (!layer.visible) continue
    const frame = layer.frames[frameIndex]
    if (!frame) continue
    for (let i = 0; i < out.length; i++) {
      if (frame[i]) out[i] = frame[i]
    }
  }
  return out
}

function FrameThumb({ frame, active, pixelColor, darkColor }: { frame: PixelBuffer; active: boolean; pixelColor: string; darkColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    for (let y = 0; y < CANVAS_H; y++) {
      for (let x = 0; x < CANVAS_W; x++) {
        const v = frame[y * CANVAS_W + x]
        if (v === 1) {
          ctx.fillStyle = pixelColor
          ctx.fillRect(x, y, 1, 1)
        } else if (v === 2) {
          ctx.fillStyle = darkColor
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
  }, [frame, pixelColor, darkColor])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className={`frame-thumb${active ? ' active' : ''}`}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

export function Timeline({
  layers,
  currentFrame,
  isPlaying,
  onSelectFrame,
  onAddFrame,
  onDeleteFrame,
  onDuplicateFrame,
  onTogglePlay,
  pixelColor,
  darkColor,
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const frameCount = layers[0]?.frames.length ?? 1

  // Auto-scroll active frame into view
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const thumb = el.children[currentFrame] as HTMLElement | undefined
    thumb?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [currentFrame])

  return (
    <div className="timeline">
      <div className="timeline-frames" ref={scrollRef}>
        {Array.from({ length: frameCount }, (_, i) => {
          const composite = compositeLayers(layers, i)
          return (
            <div
              key={i}
              className={`timeline-frame-wrap${i === currentFrame ? ' active' : ''}`}
              onClick={() => !isPlaying && onSelectFrame(i)}
              title={`Frame ${i + 1}`}
            >
              <div className="frame-number">{i + 1}</div>
              <FrameThumb frame={composite} active={i === currentFrame} pixelColor={pixelColor} darkColor={darkColor} />
            </div>
          )
        })}
      </div>

      <div className="timeline-controls">
        <button
          onClick={onAddFrame}
          disabled={isPlaying || frameCount >= MAX_FRAMES}
          title="Add frame"
        >+ Add</button>
        <button
          onClick={onDeleteFrame}
          disabled={isPlaying || frameCount <= 1}
          title="Delete current frame"
        >- Del</button>
        <button
          onClick={onDuplicateFrame}
          disabled={isPlaying || frameCount >= MAX_FRAMES}
          title="Duplicate current frame"
        >Dup</button>

        <span className="timeline-sep" />

        <span className="fps-label">FPS: 12</span>
        <button
          className={`play-btn${isPlaying ? ' playing' : ''}`}
          onClick={onTogglePlay}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? '■ Stop' : '► Play'}
        </button>
      </div>
    </div>
  )
}
