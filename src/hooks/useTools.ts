import { useCallback, useRef, useState } from 'react'
import { ToolId, PixelBuffer, Stamp, Guide, SelectionRect, FloatingPaste, CANVAS_W, CANVAS_H } from '../types'
import { bresenhamLineWithStamp, fillSquare, setPixel } from '../lib/bresenham'

interface UseToolsOptions {
  getFrames: () => PixelBuffer[]
  getCurrentFrame: () => number
  setFrame: (frameIndex: number, buf: PixelBuffer) => void
  pushHistory: (frameIndex: number, buf: PixelBuffer) => void
  zoom: number
  pan: { x: number; y: number }
  isPlaying: boolean
  eraserSize: number
  guides: Guide[]
  guidesLocked: boolean
  referenceImage: { locked: boolean; x: number; y: number } | null
  onMoveReferenceImage: (x: number, y: number) => void
  isAltDown: () => boolean
  getActiveStamp: () => Stamp | null
  // Selection
  selection: SelectionRect | null
  floatingPaste: FloatingPaste | null
  onSetSelection: (sel: SelectionRect | null) => void
  onMoveFloating: (x: number, y: number) => void
  onCommitPaste: () => void
  onMoveGuide: (id: string, position: number) => void
  onDeleteGuide: (id: string) => void
  smartErase: boolean
  mirrorX: boolean
}

export function useTools(opts: UseToolsOptions) {
  const lastPxRef = useRef<{ x: number; y: number } | null>(null)
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)
  const isDrawingRef = useRef(false)
  const isPanningRef = useRef(false)
  const panStartRef = useRef<{ mx: number; my: number } | null>(null)
  const spaceDownRef = useRef(false)
  const shiftDownRef = useRef(false)
  const strokeEraseRef = useRef(false)
  const activeTouchIdsRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const twoFingerPanActiveRef = useRef(false)
  const twoFingerCentroidRef = useRef<{ x: number; y: number } | null>(null)
  const guideDragRef = useRef<{ id: string; axis: 'h' | 'v'; pendingDelete: boolean } | null>(null)
  const refDragRef = useRef<{ startClientX: number; startClientY: number; startImgX: number; startImgY: number } | null>(null)
  // Selection drag
  const selectStartRef = useRef<{ x: number; y: number } | null>(null)
  const isSelectingRef = useRef(false)
  const floatingDragStartRef = useRef<{ mx: number; my: number; fx: number; fy: number } | null>(null)
  const isDraggingFloatingRef = useRef(false)

  const [hoveredGuideAxis, setHoveredGuideAxis] = useState<'h' | 'v' | null>(null)
  const hoveredGuideIdRef = useRef<string | null>(null)
  const [pendingDeleteGuideId, setPendingDeleteGuideId] = useState<string | null>(null)
  const [spaceDown, setSpaceDownState] = useState(false)
  const [shiftDown, setShiftDownState] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [isRefDragging, setIsRefDragging] = useState(false)

  const onPanRef = useRef<((dx: number, dy: number) => void) | null>(null)

  const setOnPan = useCallback((fn: (dx: number, dy: number) => void) => {
    onPanRef.current = fn
  }, [])

  const setSpaceDown = useCallback((v: boolean) => {
    spaceDownRef.current = v
    setSpaceDownState(v)
  }, [])

  const setShiftDown = useCallback((v: boolean) => {
    shiftDownRef.current = v
    setShiftDownState(v)
  }, [])

  function canvasCoords(e: React.PointerEvent<HTMLElement>): { x: number; y: number } {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / opts.zoom)
    const y = Math.floor((e.clientY - rect.top) / opts.zoom)
    return { x, y }
  }

  function findGuideHit(cx: number, cy: number): Guide | null {
    const threshold = Math.max(1, Math.round(2 / opts.zoom))
    for (const g of opts.guides) {
      const dist = g.axis === 'v'
        ? Math.abs(cx - g.position)
        : Math.abs(cy - g.position)
      if (dist <= threshold) return g
    }
    return null
  }

  function applyStamp(buf: PixelBuffer, stamp: Stamp, cx: number, cy: number): void {
    for (let sy = 0; sy < stamp.height; sy++) {
      for (let sx = 0; sx < stamp.width; sx++) {
        const v = stamp.buf[sy * stamp.width + sx]
        if (v === 0) continue
        const px = cx + sx
        const py = cy + sy
        if (px >= 0 && px < CANVAS_W && py >= 0 && py < CANVAS_H) {
          buf[py * CANVAS_W + px] = v
        }
      }
    }
  }

  function drawPixel(buf: PixelBuffer, x: number, y: number, val: 0 | 1 | 2): void {
    setPixel(buf, x, y, val)
    if (opts.mirrorX) setPixel(buf, CANVAS_W - 1 - x, y, val)
  }

  function drawSquare(buf: PixelBuffer, x: number, y: number, size: number, val: 0 | 1 | 2): void {
    fillSquare(buf, x, y, size, val)
    if (opts.mirrorX) fillSquare(buf, CANVAS_W - 1 - x, y, size, val)
  }

  function isOverFloating(cx: number, cy: number): boolean {
    const fp = opts.floatingPaste
    if (!fp) return false
    return cx >= fp.x && cx < fp.x + fp.w && cy >= fp.y && cy < fp.y + fp.h
  }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>, tool: ToolId) => {
    if (opts.isPlaying) return
    e.currentTarget.setPointerCapture(e.pointerId)

    // Two-finger touch = pan
    if (e.pointerType === 'touch') {
      activeTouchIdsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (activeTouchIdsRef.current.size >= 2) {
        isDrawingRef.current = false
        lastPxRef.current = null
        drawStartRef.current = null
        twoFingerPanActiveRef.current = true
        isPanningRef.current = true
        setIsPanning(true)
        const pts = [...activeTouchIdsRef.current.values()]
        twoFingerCentroidRef.current = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
        return
      }
      if (twoFingerPanActiveRef.current) return
    }

    // Middle mouse or Space+left = pan
    if (e.button === 1 || (e.button === 0 && spaceDownRef.current)) {
      isPanningRef.current = true
      setIsPanning(true)
      panStartRef.current = { mx: e.clientX, my: e.clientY }
      return
    }

    if (e.button !== 0) return

    const { x, y } = canvasCoords(e)

    // Reference image drag (all clicks when unlocked)
    if (opts.referenceImage && !opts.referenceImage.locked) {
      refDragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startImgX: opts.referenceImage.x,
        startImgY: opts.referenceImage.y,
      }
      setIsRefDragging(true)
      return
    }

    // Select tool
    if (tool === 'select') {
      if (opts.floatingPaste) {
        if (isOverFloating(x, y)) {
          isDraggingFloatingRef.current = true
          floatingDragStartRef.current = {
            mx: e.clientX, my: e.clientY,
            fx: opts.floatingPaste.x, fy: opts.floatingPaste.y,
          }
        } else {
          // Clicking outside floating → commit it
          opts.onCommitPaste()
        }
      } else {
        // Start new selection
        selectStartRef.current = { x, y }
        isSelectingRef.current = true
        opts.onSetSelection(null)
      }
      return
    }

    // Guide drag (only when not locked)
    if (!opts.guidesLocked) {
      const hit = findGuideHit(x, y)
      if (hit) {
        guideDragRef.current = { id: hit.id, axis: hit.axis, pendingDelete: false }
        return
      }
    }

    // Stamp tool
    if (tool === 'stamp') {
      const stamp = opts.getActiveStamp()
      if (!stamp) return
      const frameIndex = opts.getCurrentFrame()
      const frames = opts.getFrames()
      const buf = frames[frameIndex].slice() as PixelBuffer
      opts.pushHistory(frameIndex, buf)
      applyStamp(buf, stamp, x, y)
      if (opts.mirrorX) applyStamp(buf, stamp, CANVAS_W - x - stamp.width, y)
      opts.setFrame(frameIndex, buf)
      lastPxRef.current = { x, y }
      isDrawingRef.current = true
      return
    }

    // Drawing
    const frameIndex = opts.getCurrentFrame()
    const frames = opts.getFrames()
    const buf = frames[frameIndex].slice() as PixelBuffer
    opts.pushHistory(frameIndex, buf)

    const currentVal = buf[y * CANVAS_W + x]
    const tapOnFilled = tool === 'pencil' && opts.smartErase && currentVal !== 0
    strokeEraseRef.current = tapOnFilled
    const val: 0 | 1 | 2 = tool === 'eraser'
      ? 0
      : tapOnFilled
        ? 0
        : (opts.isAltDown() ? 2 : 1)
    const size = tool === 'eraser' ? opts.eraserSize : 1

    if (size > 1) drawSquare(buf, x, y, size, val)
    else drawPixel(buf, x, y, val)
    opts.setFrame(frameIndex, buf)
    lastPxRef.current = { x, y }
    drawStartRef.current = { x, y }
    isDrawingRef.current = true
  }, [opts])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>, tool: ToolId) => {
    if (e.pointerType === 'touch' && activeTouchIdsRef.current.has(e.pointerId)) {
      activeTouchIdsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    if (twoFingerPanActiveRef.current && activeTouchIdsRef.current.size >= 2) {
      const pts = [...activeTouchIdsRef.current.values()]
      const cx = (pts[0].x + pts[1].x) / 2
      const cy = (pts[0].y + pts[1].y) / 2
      const prev = twoFingerCentroidRef.current
      if (prev) onPanRef.current?.(cx - prev.x, cy - prev.y)
      twoFingerCentroidRef.current = { x: cx, y: cy }
      return
    }

    if (isPanningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.mx
      const dy = e.clientY - panStartRef.current.my
      panStartRef.current = { mx: e.clientX, my: e.clientY }
      onPanRef.current?.(dx, dy)
      return
    }

    // Reference image drag
    if (refDragRef.current) {
      const dx = (e.clientX - refDragRef.current.startClientX) / opts.zoom
      const dy = (e.clientY - refDragRef.current.startClientY) / opts.zoom
      opts.onMoveReferenceImage(refDragRef.current.startImgX + dx, refDragRef.current.startImgY + dy)
      return
    }

    const { x, y } = canvasCoords(e)

    // Floating paste drag
    if (isDraggingFloatingRef.current && floatingDragStartRef.current) {
      const dx = Math.round((e.clientX - floatingDragStartRef.current.mx) / opts.zoom)
      const dy = Math.round((e.clientY - floatingDragStartRef.current.my) / opts.zoom)
      opts.onMoveFloating(floatingDragStartRef.current.fx + dx, floatingDragStartRef.current.fy + dy)
      return
    }

    // Selection drag
    if (isSelectingRef.current && selectStartRef.current) {
      const sx = selectStartRef.current.x
      const sy = selectStartRef.current.y
      const x0 = Math.min(sx, x), y0 = Math.min(sy, y)
      const x1 = Math.max(sx, x), y1 = Math.max(sy, y)
      const w = Math.max(1, x1 - x0 + 1)
      const h = Math.max(1, y1 - y0 + 1)
      // Clamp to canvas
      const cx0 = Math.max(0, x0), cy0 = Math.max(0, y0)
      const cw = Math.min(CANVAS_W - cx0, w), ch = Math.min(CANVAS_H - cy0, h)
      if (cw > 0 && ch > 0) opts.onSetSelection({ x: cx0, y: cy0, w: cw, h: ch })
      return
    }

    // Guide drag (only when not locked)
    if (!opts.guidesLocked && guideDragRef.current) {
      const { id, axis } = guideDragRef.current
      const raw = axis === 'v' ? x : y
      const max = axis === 'v' ? CANVAS_W : CANVAS_H
      const pendingDelete = raw < 0 || raw >= max
      guideDragRef.current.pendingDelete = pendingDelete
      setPendingDeleteGuideId(pendingDelete ? id : null)
      const pos = pendingDelete ? raw : Math.max(0, Math.min(max - 1, raw))
      opts.onMoveGuide(id, pos)
      return
    }

    // Update hovered guide for cursor styling (only when not locked)
    if (!opts.guidesLocked) {
      const hit = findGuideHit(x, y)
      const newAxis = hit ? hit.axis : null
      if (newAxis !== hoveredGuideAxis) {
        setHoveredGuideAxis(newAxis)
        hoveredGuideIdRef.current = hit ? hit.id : null
      }
    } else if (hoveredGuideAxis !== null) {
      setHoveredGuideAxis(null)
      hoveredGuideIdRef.current = null
    }

    if (!isDrawingRef.current || opts.isPlaying) return

    // Stamp tool drag-to-paint
    if (tool === 'stamp') {
      const stamp = opts.getActiveStamp()
      if (!stamp) return
      const frameIndex = opts.getCurrentFrame()
      const frames = opts.getFrames()
      const buf = frames[frameIndex].slice() as PixelBuffer
      applyStamp(buf, stamp, x, y)
      if (opts.mirrorX) applyStamp(buf, stamp, CANVAS_W - x - stamp.width, y)
      opts.setFrame(frameIndex, buf)
      lastPxRef.current = { x, y }
      return
    }

    // Apply SHIFT constraint for straight lines
    let cx = x, cy = y
    if (shiftDownRef.current && drawStartRef.current) {
      const dx = Math.abs(x - drawStartRef.current.x)
      const dy = Math.abs(y - drawStartRef.current.y)
      if (dx >= dy) cy = drawStartRef.current.y
      else cx = drawStartRef.current.x
    }

    const frameIndex = opts.getCurrentFrame()
    const frames = opts.getFrames()
    const buf = frames[frameIndex].slice() as PixelBuffer
    const val: 0 | 1 | 2 = tool === 'eraser'
      ? 0
      : strokeEraseRef.current
        ? 0
        : (opts.isAltDown() ? 2 : 1)
    const size = tool === 'eraser' ? opts.eraserSize : 1

    if (lastPxRef.current) {
      if (size > 1) {
        bresenhamLineWithStamp(
          lastPxRef.current.x, lastPxRef.current.y, cx, cy,
          (px, py) => drawSquare(buf, px, py, size, val),
        )
      } else {
        bresenhamLineWithStamp(
          lastPxRef.current.x, lastPxRef.current.y, cx, cy,
          (px, py) => drawPixel(buf, px, py, val),
        )
      }
    } else {
      if (size > 1) drawSquare(buf, cx, cy, size, val)
      else drawPixel(buf, cx, cy, val)
    }
    opts.setFrame(frameIndex, buf)
    lastPxRef.current = { x: cx, y: cy }
  }, [opts, hoveredGuideAxis])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch') {
      activeTouchIdsRef.current.delete(e.pointerId)
      if (activeTouchIdsRef.current.size === 0) {
        twoFingerPanActiveRef.current = false
        twoFingerCentroidRef.current = null
        isPanningRef.current = false
        setIsPanning(false)
      }
      if (twoFingerPanActiveRef.current) return
    }

    strokeEraseRef.current = false
    isDrawingRef.current = false
    isPanningRef.current = false
    setIsPanning(false)
    panStartRef.current = null
    lastPxRef.current = null
    drawStartRef.current = null

    if (refDragRef.current) {
      refDragRef.current = null
      setIsRefDragging(false)
    }
    if (guideDragRef.current) {
      const { id, pendingDelete } = guideDragRef.current
      if (pendingDelete) opts.onDeleteGuide(id)
      guideDragRef.current = null
      setPendingDeleteGuideId(null)
    }
    if (isSelectingRef.current) {
      isSelectingRef.current = false
      selectStartRef.current = null
    }
    if (isDraggingFloatingRef.current) {
      isDraggingFloatingRef.current = false
      floatingDragStartRef.current = null
    }
  }, [opts])

  const getHoveredGuideId = useCallback(() => hoveredGuideIdRef.current, [])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    setOnPan,
    setSpaceDown,
    setShiftDown,
    hoveredGuideAxis,
    getHoveredGuideId,
    pendingDeleteGuideId,
    spaceDown,
    shiftDown,
    isPanning,
    isRefDragging,
  }
}
