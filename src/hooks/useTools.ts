import { useCallback, useRef, useState } from 'react'
import { ToolId, PixelBuffer, Guide, ReferenceImageSettings, CANVAS_W, CANVAS_H } from '../types'
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
  referenceImage: ReferenceImageSettings | null
  onMoveGuide: (id: string, position: number) => void
  onDeleteGuide: (id: string) => void
  onMoveReferenceImage: (x: number, y: number) => void
}

export function useTools(opts: UseToolsOptions) {
  const lastPxRef = useRef<{ x: number; y: number } | null>(null)
  const isDrawingRef = useRef(false)
  const isPanningRef = useRef(false)
  const panStartRef = useRef<{ mx: number; my: number } | null>(null)
  const spaceDownRef = useRef(false)
  const guideDragRef = useRef<{ id: string; axis: 'h' | 'v'; pendingDelete: boolean } | null>(null)
  const refDragRef = useRef<{ startClientX: number; startClientY: number; startImgX: number; startImgY: number } | null>(null)

  // Hovered guide axis — exposed as state so Canvas can read it for cursor styling
  const [hoveredGuideAxis, setHoveredGuideAxis] = useState<'h' | 'v' | null>(null)
  const hoveredGuideIdRef = useRef<string | null>(null)
  const [pendingDeleteGuideId, setPendingDeleteGuideId] = useState<string | null>(null)
  const [spaceDown, setSpaceDownState] = useState(false)
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

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>, tool: ToolId) => {
    if (opts.isPlaying) return
    e.currentTarget.setPointerCapture(e.pointerId)

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

    // Guide drag takes priority over drawing (only when not locked)
    if (!opts.guidesLocked) {
      const hit = findGuideHit(x, y)
      if (hit) {
        guideDragRef.current = { id: hit.id, axis: hit.axis, pendingDelete: false }
        return
      }
    }

    const frameIndex = opts.getCurrentFrame()
    const frames = opts.getFrames()
    const buf = frames[frameIndex].slice() as PixelBuffer
    opts.pushHistory(frameIndex, buf)

    const val: 0 | 1 = tool === 'eraser' ? 0 : 1
    const size = tool === 'eraser' ? opts.eraserSize : 1

    if (size > 1) {
      fillSquare(buf, x, y, size, val)
    } else {
      setPixel(buf, x, y, val)
    }
    opts.setFrame(frameIndex, buf)
    lastPxRef.current = { x, y }
    isDrawingRef.current = true
  }, [opts])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>, tool: ToolId) => {
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

    const frameIndex = opts.getCurrentFrame()
    const frames = opts.getFrames()
    const buf = frames[frameIndex].slice() as PixelBuffer
    const val: 0 | 1 = tool === 'eraser' ? 0 : 1
    const size = tool === 'eraser' ? opts.eraserSize : 1

    if (lastPxRef.current) {
      if (size > 1) {
        bresenhamLineWithStamp(
          lastPxRef.current.x, lastPxRef.current.y, x, y,
          (px, py) => fillSquare(buf, px, py, size, val),
        )
      } else {
        bresenhamLineWithStamp(
          lastPxRef.current.x, lastPxRef.current.y, x, y,
          (px, py) => setPixel(buf, px, py, val),
        )
      }
    } else {
      if (size > 1) fillSquare(buf, x, y, size, val)
      else setPixel(buf, x, y, val)
    }
    opts.setFrame(frameIndex, buf)
    lastPxRef.current = { x, y }
  }, [opts, hoveredGuideAxis])

  const onPointerUp = useCallback((_e: React.PointerEvent<HTMLElement>) => {
    isDrawingRef.current = false
    isPanningRef.current = false
    setIsPanning(false)
    panStartRef.current = null
    lastPxRef.current = null
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
  }, [opts])

  const getHoveredGuideId = useCallback(() => hoveredGuideIdRef.current, [])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    setOnPan,
    setSpaceDown,
    hoveredGuideAxis,
    getHoveredGuideId,
    pendingDeleteGuideId,
    spaceDown,
    isPanning,
    isRefDragging,
  }
}
