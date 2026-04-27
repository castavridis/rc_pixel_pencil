import React, { useRef, useEffect, useCallback } from 'react'
import { PixelBuffer, BloomSettings, ToolId, CANVAS_W, CANVAS_H } from '../types'
import { renderBloom, clearBloom } from '../lib/bloom'

interface CanvasProps {
  frames: PixelBuffer[]
  currentFrame: number
  zoom: number
  pan: { x: number; y: number }
  showGrid: boolean
  onionEnabled: boolean
  bloom: BloomSettings
  tool: ToolId
  isPlaying: boolean
  onCursorChange: (x: number | null, y: number | null) => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, tool: ToolId) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>, tool: ToolId) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onZoomScroll: (delta: number, cx: number, cy: number) => void
  pixelsCanvasRef: React.RefObject<HTMLCanvasElement | null>
  bloomCanvasRef: React.RefObject<HTMLCanvasElement | null>
}

export function Canvas({
  frames,
  currentFrame,
  zoom,
  pan,
  showGrid,
  onionEnabled,
  bloom,
  tool,
  isPlaying,
  onCursorChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onZoomScroll,
  pixelsCanvasRef,
  bloomCanvasRef,
}: CanvasProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const onionCanvasRef = useRef<HTMLCanvasElement>(null)
  const gridCanvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  // Refs for RAF loop (avoid stale closures)
  const framesRef = useRef(frames)
  const currentFrameRef = useRef(currentFrame)
  const bloomRef = useRef(bloom)
  const showGridRef = useRef(showGrid)
  const onionEnabledRef = useRef(onionEnabled)
  const zoomRef = useRef(zoom)

  useEffect(() => { framesRef.current = frames }, [frames])
  useEffect(() => { currentFrameRef.current = currentFrame }, [currentFrame])
  useEffect(() => { bloomRef.current = bloom }, [bloom])
  useEffect(() => { showGridRef.current = showGrid }, [showGrid])
  useEffect(() => { onionEnabledRef.current = onionEnabled }, [onionEnabled])
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  // Draw background (once)
  useEffect(() => {
    const canvas = bgCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  }, [])

  // RAF render loop
  useEffect(() => {
    function drawOnion() {
      const canvas = onionCanvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      if (!onionEnabledRef.current) return

      const fi = currentFrameRef.current
      const fs = framesRef.current
      const prev = fs[fi - 1]
      const next = fs[fi + 1]

      if (prev) {
        ctx.globalAlpha = 0.30
        ctx.fillStyle = '#fff'
        for (let y = 0; y < CANVAS_H; y++) {
          for (let x = 0; x < CANVAS_W; x++) {
            if (prev[y * CANVAS_W + x]) ctx.fillRect(x, y, 1, 1)
          }
        }
      }
      if (next) {
        ctx.globalAlpha = 0.20
        ctx.fillStyle = 'rgb(100,200,255)'
        for (let y = 0; y < CANVAS_H; y++) {
          for (let x = 0; x < CANVAS_W; x++) {
            if (next[y * CANVAS_W + x]) ctx.fillRect(x, y, 1, 1)
          }
        }
      }
      ctx.globalAlpha = 1
    }

    function drawPixels() {
      const canvas = pixelsCanvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      const fi = currentFrameRef.current
      const frame = framesRef.current[fi]
      if (!frame) return
      ctx.fillStyle = '#fff'
      for (let y = 0; y < CANVAS_H; y++) {
        for (let x = 0; x < CANVAS_W; x++) {
          if (frame[y * CANVAS_W + x]) ctx.fillRect(x, y, 1, 1)
        }
      }
    }

    function drawGrid() {
      const canvas = gridCanvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      const z = zoomRef.current
      if (!showGridRef.current && z <= 5) return
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1 / z
      ctx.beginPath()
      for (let x = 0; x <= CANVAS_W; x++) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, CANVAS_H)
      }
      for (let y = 0; y <= CANVAS_H; y++) {
        ctx.moveTo(0, y)
        ctx.lineTo(CANVAS_W, y)
      }
      ctx.stroke()
    }

    function frame() {
      drawOnion()
      drawPixels()
      const b = bloomRef.current
      const pc = pixelsCanvasRef.current
      const bc = bloomCanvasRef.current
      if (pc && bc) {
        if (b.enabled) renderBloom(pc, bc, b)
        else clearBloom(bc)
      }
      drawGrid()
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [pixelsCanvasRef, bloomCanvasRef])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -1 : 1
    onZoomScroll(delta, e.clientX, e.clientY)
  }, [onZoomScroll])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.floor((e.clientX - rect.left) / zoom)
    const y = Math.floor((e.clientY - rect.top) / zoom)
    if (x >= 0 && x < CANVAS_W && y >= 0 && y < CANVAS_H) {
      onCursorChange(x, y)
    } else {
      onCursorChange(null, null)
    }
    onPointerMove(e, tool)
  }, [zoom, tool, onCursorChange, onPointerMove])

  const handlePointerLeave = useCallback(() => {
    onCursorChange(null, null)
  }, [onCursorChange])

  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    imageRendering: 'pixelated',
  }

  const wrapperW = CANVAS_W * zoom
  const wrapperH = CANVAS_H * zoom

  return (
    <div
      className="canvas-viewport"
      onWheel={handleWheel}
    >
      <div
        ref={wrapperRef}
        className="canvas-wrapper"
        style={{
          width: wrapperW,
          height: wrapperH,
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
          cursor: isPlaying ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair',
        }}
        onPointerDown={e => onPointerDown(e, tool)}
        onPointerMove={handlePointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <canvas ref={bgCanvasRef} width={CANVAS_W} height={CANVAS_H} style={canvasStyle} />
        <canvas ref={onionCanvasRef} width={CANVAS_W} height={CANVAS_H} style={canvasStyle} />
        <canvas ref={pixelsCanvasRef as React.RefObject<HTMLCanvasElement>} width={CANVAS_W} height={CANVAS_H} style={canvasStyle} />
        <canvas ref={bloomCanvasRef as React.RefObject<HTMLCanvasElement>} width={CANVAS_W} height={CANVAS_H} style={canvasStyle} />
        <canvas ref={gridCanvasRef} width={CANVAS_W} height={CANVAS_H} style={canvasStyle} />
      </div>
    </div>
  )
}
