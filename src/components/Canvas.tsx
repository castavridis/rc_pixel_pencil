import React, { useRef, useEffect, useCallback } from 'react'
import { PixelBuffer, BloomSettings, ToolId, Guide, ReferenceImageSettings, CANVAS_W, CANVAS_H } from '../types'
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
  eraserSize: number
  isPlaying: boolean
  guides: Guide[]
  guidesLocked: boolean
  hoveredGuideAxis: 'h' | 'v' | null
  onCursorChange: (x: number | null, y: number | null) => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, tool: ToolId) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>, tool: ToolId) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onZoomScroll: (delta: number, cx: number, cy: number) => void
  onDeleteHoveredGuide: () => void
  pixelsCanvasRef: React.RefObject<HTMLCanvasElement | null>
  bloomCanvasRef: React.RefObject<HTMLCanvasElement | null>
  selectedGuideId: string | null
  pendingDeleteGuideId: string | null
  spaceDown: boolean
  isPanning: boolean
  isRefDragging: boolean
  referenceImage: ReferenceImageSettings | null
  canvasColor: string
  pixelColor: string
  onScaleReferenceImage: (scale: number) => void
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
  eraserSize,
  isPlaying,
  guides,
  guidesLocked,
  hoveredGuideAxis,
  onCursorChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onZoomScroll,
  onDeleteHoveredGuide,
  pixelsCanvasRef,
  bloomCanvasRef,
  selectedGuideId,
  pendingDeleteGuideId,
  spaceDown,
  isPanning,
  isRefDragging,
  referenceImage,
  canvasColor,
  pixelColor,
  onScaleReferenceImage,
}: CanvasProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const refCanvasRef = useRef<HTMLCanvasElement>(null)
  const onionCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  // Refs for RAF loop (avoid stale closures)
  const framesRef = useRef(frames)
  const currentFrameRef = useRef(currentFrame)
  const bloomRef = useRef(bloom)
  const showGridRef = useRef(showGrid)
  const onionEnabledRef = useRef(onionEnabled)
  const zoomRef = useRef(zoom)
  const guidesRef = useRef(guides)
  const selectedGuideIdRef = useRef(selectedGuideId)
  const pendingDeleteGuideIdRef = useRef(pendingDeleteGuideId)
  const toolRef = useRef(tool)
  const eraserSizeRef = useRef(eraserSize)
  const cursorPxRef = useRef<{ x: number; y: number } | null>(null)
  const referenceImageRef = useRef(referenceImage)
  const refImgElementRef = useRef<HTMLImageElement | null>(null)
  const guidesLockedRef = useRef(guidesLocked)
  const pixelColorRef = useRef(pixelColor)

  useEffect(() => { framesRef.current = frames }, [frames])
  useEffect(() => { currentFrameRef.current = currentFrame }, [currentFrame])
  useEffect(() => { bloomRef.current = bloom }, [bloom])
  useEffect(() => { showGridRef.current = showGrid }, [showGrid])
  useEffect(() => { onionEnabledRef.current = onionEnabled }, [onionEnabled])
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { guidesRef.current = guides }, [guides])
  useEffect(() => { guidesLockedRef.current = guidesLocked }, [guidesLocked])
  useEffect(() => { selectedGuideIdRef.current = selectedGuideId }, [selectedGuideId])
  useEffect(() => { pendingDeleteGuideIdRef.current = pendingDeleteGuideId }, [pendingDeleteGuideId])
  useEffect(() => { toolRef.current = tool }, [tool])
  useEffect(() => { eraserSizeRef.current = eraserSize }, [eraserSize])
  useEffect(() => { pixelColorRef.current = pixelColor }, [pixelColor])
  useEffect(() => {
    referenceImageRef.current = referenceImage
    if (referenceImage) {
      if (!refImgElementRef.current || refImgElementRef.current.src !== referenceImage.dataUrl) {
        const img = new Image()
        img.src = referenceImage.dataUrl
        refImgElementRef.current = img
      }
    } else {
      refImgElementRef.current = null
    }
  }, [referenceImage])

  // Redraw background whenever canvasColor changes
  useEffect(() => {
    const canvas = bgCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = canvasColor
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  }, [canvasColor])

  // RAF render loop
  useEffect(() => {
    function drawRef() {
      const canvas = refCanvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      const ref = referenceImageRef.current
      const img = refImgElementRef.current
      if (!ref || !img || !img.complete || !img.naturalWidth) return
      const aspect = img.naturalWidth / img.naturalHeight
      const canvasAspect = CANVAS_W / CANVAS_H
      let fitW: number, fitH: number
      if (aspect > canvasAspect) { fitW = CANVAS_W; fitH = CANVAS_W / aspect }
      else { fitH = CANVAS_H; fitW = CANVAS_H * aspect }
      const drawW = fitW * ref.scale
      const drawH = fitH * ref.scale
      ctx.globalAlpha = ref.opacity
      ctx.drawImage(img, ref.x, ref.y, drawW, drawH)
      ctx.globalAlpha = 1
    }

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

      // Previous frame: blue-ish
      if (prev) {
        ctx.globalAlpha = 0.35
        ctx.fillStyle = 'rgb(70,130,255)'
        for (let y = 0; y < CANVAS_H; y++) {
          for (let x = 0; x < CANVAS_W; x++) {
            if (prev[y * CANVAS_W + x]) ctx.fillRect(x, y, 1, 1)
          }
        }
      }
      // Next frame: gray
      if (next) {
        ctx.globalAlpha = 0.25
        ctx.fillStyle = 'rgb(160,160,160)'
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
      ctx.fillStyle = pixelColorRef.current
      for (let y = 0; y < CANVAS_H; y++) {
        for (let x = 0; x < CANVAS_W; x++) {
          if (frame[y * CANVAS_W + x]) ctx.fillRect(x, y, 1, 1)
        }
      }
    }

    function drawOverlay() {
      const canvas = overlayCanvasRef.current
      if (!canvas) return
      const z = zoomRef.current
      const W = CANVAS_W * z
      const H = CANVAS_H * z
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, W, H)

      if (showGridRef.current) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let x = 0; x <= CANVAS_W; x++) {
          ctx.moveTo(x * z, 0)
          ctx.lineTo(x * z, H)
        }
        for (let y = 0; y <= CANVAS_H; y++) {
          ctx.moveTo(0, y * z)
          ctx.lineTo(W, y * z)
        }
        ctx.stroke()
      }

      // Guides
      for (const g of guidesRef.current) {
        const isSelected = g.id === selectedGuideIdRef.current
        const isPendingDelete = g.id === pendingDeleteGuideIdRef.current
        ctx.strokeStyle = isPendingDelete
          ? 'rgba(255,80,80,0.9)'
          : isSelected
            ? 'rgba(255,200,50,0.9)'
            : guidesLockedRef.current
              ? 'rgba(220,60,60,0.35)'
              : 'rgba(220,60,60,0.75)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        if (g.axis === 'v') {
          ctx.moveTo(g.position * z, 0)
          ctx.lineTo(g.position * z, H)
        } else {
          ctx.moveTo(0, g.position * z)
          ctx.lineTo(W, g.position * z)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Cursor preview
      const cur = cursorPxRef.current
      if (cur) {
        const t = toolRef.current
        const size = t === 'eraser' ? eraserSizeRef.current : 1
        const half = Math.floor(size / 2)
        ctx.strokeStyle = t === 'eraser'
          ? 'rgba(255,100,100,0.8)'
          : 'rgba(255,255,255,0.65)'
        ctx.lineWidth = 1
        ctx.strokeRect(
          (cur.x - half) * z + 0.5,
          (cur.y - half) * z + 0.5,
          size * z,
          size * z,
        )
      }
    }

    function tick() {
      drawRef()
      drawOnion()
      drawPixels()
      const b = bloomRef.current
      const pc = pixelsCanvasRef.current
      const bc = bloomCanvasRef.current
      if (pc && bc) {
        if (b.enabled) renderBloom(pc, bc, b, zoomRef.current)
        else clearBloom(bc)
      }
      drawOverlay()
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [pixelsCanvasRef, bloomCanvasRef])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      onZoomScroll(e.deltaY > 0 ? -1 : 1, e.clientX, e.clientY)
      return
    }
    const ref = referenceImageRef.current
    if (ref && !ref.locked) {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      onScaleReferenceImage(Math.max(0.05, Math.min(20, ref.scale * factor)))
    }
  }, [onZoomScroll, onScaleReferenceImage])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.floor((e.clientX - rect.left) / zoom)
    const y = Math.floor((e.clientY - rect.top) / zoom)
    if (x >= 0 && x < CANVAS_W && y >= 0 && y < CANVAS_H) {
      onCursorChange(x, y)
      cursorPxRef.current = { x, y }
    } else {
      onCursorChange(null, null)
      cursorPxRef.current = null
    }
    onPointerMove(e, tool)
  }, [zoom, tool, onCursorChange, onPointerMove])

  const handlePointerLeave = useCallback(() => {
    onCursorChange(null, null)
    cursorPxRef.current = null
  }, [onCursorChange])

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    onDeleteHoveredGuide()
  }, [onDeleteHoveredGuide])

  let cursor = 'none'
  if (isPlaying) {
    cursor = 'default'
  } else if (isPanning || isRefDragging) {
    cursor = 'grabbing'
  } else if (referenceImage && !referenceImage.locked) {
    cursor = 'grab'
  } else if (hoveredGuideAxis === 'h') {
    cursor = 'ns-resize'
  } else if (hoveredGuideAxis === 'v') {
    cursor = 'ew-resize'
  } else if (spaceDown) {
    cursor = 'grab'
  }

  const pixelCanvasStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    imageRendering: 'pixelated',
  }

  // Bloom canvas must NOT have image-rendering: pixelated so the soft glow renders correctly
  const bloomCanvasStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
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
          cursor,
        }}
        onPointerDown={e => onPointerDown(e, tool)}
        onPointerMove={handlePointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={handleContextMenu}
      >
        {/* Pixel-art layers: physically 128×64, scaled by CSS+pixelated */}
        <canvas ref={bgCanvasRef} width={CANVAS_W} height={CANVAS_H} style={pixelCanvasStyle} />
        <canvas ref={refCanvasRef} width={CANVAS_W} height={CANVAS_H} style={pixelCanvasStyle} />
        <canvas ref={onionCanvasRef} width={CANVAS_W} height={CANVAS_H} style={pixelCanvasStyle} />
        <canvas ref={pixelsCanvasRef as React.RefObject<HTMLCanvasElement>} width={CANVAS_W} height={CANVAS_H} style={pixelCanvasStyle} />
        {/* Bloom: smooth (not pixelated) so the blur gradient is preserved after CSS scale */}
        <canvas ref={bloomCanvasRef as React.RefObject<HTMLCanvasElement>} width={CANVAS_W} height={CANVAS_H} style={bloomCanvasStyle} />
        {/* Overlay: screen-resolution canvas for grid, guides, cursor preview */}
        <canvas
          ref={overlayCanvasRef}
          width={wrapperW}
          height={wrapperH}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}
