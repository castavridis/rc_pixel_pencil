import React, { useRef, useEffect, useCallback } from 'react'
import { BloomSettings, ToolId, Stamp, Guide, Layer, ReferenceImageSettings, SelectionRect, FloatingPaste, CANVAS_W, CANVAS_H, GLOW_PAD } from '../types'
import { renderGlow, clearGlow } from '../lib/glow'

interface CanvasProps {
  layers: Layer[]
  activeLayerId: string
  currentFrame: number
  zoom: number
  pan: { x: number; y: number }
  showGrid: boolean
  onionEnabled: boolean
  bloom: BloomSettings
  tool: ToolId
  eraserSize: number
  pencilSize: number
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
  selection: SelectionRect | null
  floatingPaste: FloatingPaste | null
  darkColor: string
  altDown: boolean
  activeStamp: Stamp | null
  mirrorX: boolean
}

export function Canvas({
  layers,
  activeLayerId,
  currentFrame,
  zoom,
  pan,
  showGrid,
  onionEnabled,
  bloom,
  tool,
  eraserSize,
  pencilSize,
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
  selection,
  floatingPaste,
  darkColor,
  altDown,
  activeStamp,
  mirrorX,
}: CanvasProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const refCanvasRef = useRef<HTMLCanvasElement>(null)
  const onionCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const dashOffsetRef = useRef(0)

  // Refs for RAF loop
  const layersRef = useRef(layers)
  const activeLayerIdRef = useRef(activeLayerId)
  const currentFrameRef = useRef(currentFrame)
  const bloomRef = useRef(bloom)
  const showGridRef = useRef(showGrid)
  const onionEnabledRef = useRef(onionEnabled)
  const zoomRef = useRef(zoom)
  const guidesRef = useRef(guides)
  const guidesLockedRef = useRef(guidesLocked)
  const selectedGuideIdRef = useRef(selectedGuideId)
  const pendingDeleteGuideIdRef = useRef(pendingDeleteGuideId)
  const toolRef = useRef(tool)
  const eraserSizeRef = useRef(eraserSize)
  const pencilSizeRef = useRef(pencilSize)
  const cursorPxRef = useRef<{ x: number; y: number } | null>(null)
  const referenceImageRef = useRef(referenceImage)
  const refImgElementRef = useRef<HTMLImageElement | null>(null)
  const pixelColorRef = useRef(pixelColor)
  const darkColorRef = useRef(darkColor)
  const altDownRef = useRef(altDown)
  const activeStampRef = useRef(activeStamp)
  const selectionRef = useRef(selection)
  const floatingPasteRef = useRef(floatingPaste)
  const mirrorXRef = useRef(mirrorX)

  useEffect(() => { layersRef.current = layers }, [layers])
  useEffect(() => { activeLayerIdRef.current = activeLayerId }, [activeLayerId])
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
  useEffect(() => { pencilSizeRef.current = pencilSize }, [pencilSize])
  useEffect(() => { pixelColorRef.current = pixelColor }, [pixelColor])
  useEffect(() => { darkColorRef.current = darkColor }, [darkColor])
  useEffect(() => { altDownRef.current = altDown }, [altDown])
  useEffect(() => { activeStampRef.current = activeStamp }, [activeStamp])
  useEffect(() => { selectionRef.current = selection }, [selection])
  useEffect(() => { floatingPasteRef.current = floatingPaste }, [floatingPaste])
  useEffect(() => { mirrorXRef.current = mirrorX }, [mirrorX])
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

  // Background canvas — reactive to canvasColor
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
      const activeLayer = layersRef.current.find(l => l.id === activeLayerIdRef.current) ?? layersRef.current[0]

      // Previous frames: blue, stepping from close (bright) to far (dim)
      const prevOffsets: { offset: number; alpha: number }[] = [
        { offset: -1, alpha: 0.35 },
        { offset: -2, alpha: 0.20 },
        { offset: -3, alpha: 0.10 },
      ]
      // Next frames: gray, stepping from close (bright) to far (dim)
      const nextOffsets: { offset: number; alpha: number }[] = [
        { offset: +1, alpha: 0.25 },
        { offset: +2, alpha: 0.12 },
      ]

      for (const { offset, alpha } of prevOffsets) {
        const frame = activeLayer.frames[fi + offset]
        if (!frame) continue
        ctx.globalAlpha = alpha
        ctx.fillStyle = 'rgb(70,130,255)'
        for (let y = 0; y < CANVAS_H; y++) {
          for (let x = 0; x < CANVAS_W; x++) {
            if (frame[y * CANVAS_W + x]) ctx.fillRect(x, y, 1, 1)
          }
        }
      }
      for (const { offset, alpha } of nextOffsets) {
        const frame = activeLayer.frames[fi + offset]
        if (!frame) continue
        ctx.globalAlpha = alpha
        ctx.fillStyle = 'rgb(160,160,160)'
        for (let y = 0; y < CANVAS_H; y++) {
          for (let x = 0; x < CANVAS_W; x++) {
            if (frame[y * CANVAS_W + x]) ctx.fillRect(x, y, 1, 1)
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
      const activeId = activeLayerIdRef.current

      for (const layer of layersRef.current) {
        if (!layer.visible) continue
        const frame = layer.frames[fi]
        if (!frame) continue
        ctx.globalAlpha = layer.id === activeId ? 1.0 : 0.4
        for (let y = 0; y < CANVAS_H; y++) {
          for (let x = 0; x < CANVAS_W; x++) {
            const v = frame[y * CANVAS_W + x]
            if (v === 1) {
              ctx.fillStyle = pixelColorRef.current
              ctx.fillRect(x, y, 1, 1)
            } else if (v === 2) {
              ctx.fillStyle = darkColorRef.current
              ctx.fillRect(x, y, 1, 1)
            }
          }
        }
      }
      ctx.globalAlpha = 1
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
          ctx.moveTo(x * z, 0); ctx.lineTo(x * z, H)
        }
        for (let y = 0; y <= CANVAS_H; y++) {
          ctx.moveTo(0, y * z); ctx.lineTo(W, y * z)
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
          ctx.moveTo(g.position * z, 0); ctx.lineTo(g.position * z, H)
        } else {
          ctx.moveTo(0, g.position * z); ctx.lineTo(W, g.position * z)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Mirror axis line
      if (mirrorXRef.current) {
        ctx.strokeStyle = 'rgba(100,200,255,0.6)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(CANVAS_W / 2 * z, 0)
        ctx.lineTo(CANVAS_W / 2 * z, H)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Selection rectangle
      const sel = selectionRef.current
      if (sel && toolRef.current === 'select') {
        dashOffsetRef.current = (dashOffsetRef.current - 0.3) % 8
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.lineDashOffset = dashOffsetRef.current
        ctx.strokeRect(sel.x * z + 0.5, sel.y * z + 0.5, sel.w * z, sel.h * z)
        ctx.setLineDash([])
        ctx.lineDashOffset = 0
      }

      // Floating paste preview
      const fp = floatingPasteRef.current
      if (fp) {
        ctx.fillStyle = pixelColorRef.current
        ctx.globalAlpha = 0.75
        for (let py = 0; py < fp.h; py++) {
          for (let px = 0; px < fp.w; px++) {
            if (fp.buf[py * fp.w + px]) {
              ctx.fillRect((fp.x + px) * z, (fp.y + py) * z, z, z)
            }
          }
        }
        ctx.globalAlpha = 1
        ctx.strokeStyle = 'rgba(255,220,0,0.85)'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])
        ctx.strokeRect(fp.x * z + 0.5, fp.y * z + 0.5, fp.w * z, fp.h * z)
        ctx.setLineDash([])
      }

      // Cursor preview
      const cur = cursorPxRef.current
      if (cur && toolRef.current !== 'select') {
        const t = toolRef.current
        if (t === 'stamp') {
          const stamp = activeStampRef.current
          if (stamp) {
            ctx.globalAlpha = 0.55
            for (let sy = 0; sy < stamp.height; sy++) {
              for (let sx = 0; sx < stamp.width; sx++) {
                const v = stamp.buf[sy * stamp.width + sx]
                if (v === 1) ctx.fillStyle = pixelColorRef.current
                else if (v === 2) ctx.fillStyle = darkColorRef.current
                else continue
                ctx.fillRect((cur.x + sx) * z, (cur.y + sy) * z, z, z)
              }
            }
            ctx.globalAlpha = 1
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'
            ctx.lineWidth = 1
            ctx.strokeRect(cur.x * z + 0.5, cur.y * z + 0.5, stamp.width * z, stamp.height * z)
          }
        } else {
          const size = t === 'eraser' ? eraserSizeRef.current : pencilSizeRef.current
          const half = Math.floor(size / 2)
          ctx.strokeStyle = t === 'eraser'
            ? 'rgba(255,100,100,0.8)'
            : altDownRef.current
              ? darkColorRef.current
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
    }

    function tick() {
      drawRef()
      drawOnion()
      drawPixels()
      const b = bloomRef.current
      const pc = pixelsCanvasRef.current
      const bc = bloomCanvasRef.current
      if (pc && bc) {
        if (b.enabled) renderGlow(pc, bc, b)
        else clearGlow(bc)
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
  } else if (tool === 'select') {
    cursor = 'crosshair'
  } else if (hoveredGuideAxis === 'h') {
    cursor = 'ns-resize'
  } else if (hoveredGuideAxis === 'v') {
    cursor = 'ew-resize'
  } else if (spaceDown) {
    cursor = 'grab'
  }

  const pixelCanvasStyle: React.CSSProperties = {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    imageRendering: 'pixelated',
  }

  const bloomCanvasStyle: React.CSSProperties = {
    position: 'absolute',
    top: -GLOW_PAD * zoom,
    left: -GLOW_PAD * zoom,
    width: (CANVAS_W + GLOW_PAD * 2) * zoom,
    height: (CANVAS_H + GLOW_PAD * 2) * zoom,
  }

  const wrapperW = CANVAS_W * zoom
  const wrapperH = CANVAS_H * zoom

  return (
    <div className="canvas-viewport" onWheel={handleWheel}>
      <div
        ref={wrapperRef}
        className="canvas-wrapper"
        style={{
          width: wrapperW, height: wrapperH,
          position: 'absolute',
          left: '50%', top: '50%',
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
          cursor,
        }}
        onPointerDown={e => onPointerDown(e, tool)}
        onPointerMove={handlePointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={handleContextMenu}
      >
        <canvas ref={bgCanvasRef} width={CANVAS_W} height={CANVAS_H} style={pixelCanvasStyle} />
        <canvas ref={refCanvasRef} width={CANVAS_W} height={CANVAS_H} style={pixelCanvasStyle} />
        <canvas ref={onionCanvasRef} width={CANVAS_W} height={CANVAS_H} style={pixelCanvasStyle} />
        <canvas ref={pixelsCanvasRef as React.RefObject<HTMLCanvasElement>} width={CANVAS_W} height={CANVAS_H} style={pixelCanvasStyle} />
        <canvas ref={bloomCanvasRef as React.RefObject<HTMLCanvasElement>} width={CANVAS_W + GLOW_PAD * 2} height={CANVAS_H + GLOW_PAD * 2} style={bloomCanvasStyle} />
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
