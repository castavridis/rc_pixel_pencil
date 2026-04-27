import { useEffect, useRef } from 'react'
import { PixelBuffer, CANVAS_W, CANVAS_H, MAX_FRAMES } from '../types'

interface TimelineProps {
  frames: PixelBuffer[]
  currentFrame: number
  isPlaying: boolean
  onSelectFrame: (i: number) => void
  onAddFrame: () => void
  onDeleteFrame: () => void
  onDuplicateFrame: () => void
  onTogglePlay: () => void
}

function FrameThumb({ frame, active }: { frame: PixelBuffer; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.fillStyle = '#fff'
    for (let y = 0; y < CANVAS_H; y++) {
      for (let x = 0; x < CANVAS_W; x++) {
        if (frame[y * CANVAS_W + x]) {
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
  }, [frame])

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
  frames,
  currentFrame,
  isPlaying,
  onSelectFrame,
  onAddFrame,
  onDeleteFrame,
  onDuplicateFrame,
  onTogglePlay,
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

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
        {frames.map((frame, i) => (
          <div
            key={i}
            className={`timeline-frame-wrap${i === currentFrame ? ' active' : ''}`}
            onClick={() => !isPlaying && onSelectFrame(i)}
            title={`Frame ${i + 1}`}
          >
            <div className="frame-number">{i + 1}</div>
            <FrameThumb frame={frame} active={i === currentFrame} />
          </div>
        ))}
      </div>

      <div className="timeline-controls">
        <button
          onClick={onAddFrame}
          disabled={isPlaying || frames.length >= MAX_FRAMES}
          title="Add frame"
        >+ Add</button>
        <button
          onClick={onDeleteFrame}
          disabled={isPlaying || frames.length <= 1}
          title="Delete current frame"
        >- Del</button>
        <button
          onClick={onDuplicateFrame}
          disabled={isPlaying || frames.length >= MAX_FRAMES}
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
