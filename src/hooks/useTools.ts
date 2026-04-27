import { useCallback, useRef, useState } from 'react'
import { ToolId, PixelBuffer, Guide, CANVAS_W, CANVAS_H } from '../types'
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
  onMoveGuide: (id: string, position: number) => void
  onDeleteGuide: (id: string) => void
}

export function useTools(opts: UseToolsOptions) {
  const lastPxRef = useRef<{ x: number; y: number } | null>(null)
  const isDrawingRef = useRef(false)
  const isPanningRef = useRef(false)
  const panStartRef = useRef<{ mx: number; my: number } | null>(null)
  const spaceDownRef = useRef(false)
  const guideDragRef = useRef<{ id: string; axis: 'h' | 'v' } | null>(null)

  // Hovered guide axis — exposed as state so Canvas can read it for cursor styling
  const [hoveredGuideAxis, setHoveredGuideAxis] = useState<'h' | 'v' | null>(null)
  const hoveredGuideIdRef = useRef<string | null>(null)

  const onPanRef = useRef<((dx: number, dy: number) => void) | null>(null)

  const setOnPan = useCallback((fn: (dx: number, dy: number) => void) => {
    onPanRef.current = fn
  }, [])
  const setSpaceDown = useCallback((v: boolean) => { spaceDownRef.current = v }, [])

  function canvasCoords(e: React.PointerEvent<HTMLElement>): { x: number; y: number } {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / opts.zoom)
    const y = Math.floor((e.clientY - rect.top) / opts.zoom)
    return { x, y }
  }

  function findGuideHit(cx: number, cy: number): Guide | null {
    const threshold = Math.max(1, Math.round(4 / opts.zoom))
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
      panStartRef.current = { mx: e.clientX, my: e.clientY }
      return
    }

    if (e.button !== 0) return

    const { x, y } = canvasCoords(e)

    // Guide drag takes priority over drawing
    const hit = findGuideHit(x, y)
    if (hit) {
      guideDragRef.current = { id: hit.id, axis: hit.axis }
      return
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

    const { x, y } = canvasCoords(e)

    // Guide drag
    if (guideDragRef.current) {
      const { id, axis } = guideDragRef.current
      const pos = axis === 'v'
        ? Math.max(0, Math.min(CANVAS_W - 1, x))
        : Math.max(0, Math.min(CANVAS_H - 1, y))
      opts.onMoveGuide(id, pos)
      return
    }

    // Update hovered guide for cursor styling
    const hit = findGuideHit(x, y)
    const newAxis = hit ? hit.axis : null
    if (newAxis !== hoveredGuideAxis) {
      setHoveredGuideAxis(newAxis)
      hoveredGuideIdRef.current = hit ? hit.id : null
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
    panStartRef.current = null
    lastPxRef.current = null
    guideDragRef.current = null
  }, [])

  const getHoveredGuideId = useCallback(() => hoveredGuideIdRef.current, [])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    setOnPan,
    setSpaceDown,
    hoveredGuideAxis,
    getHoveredGuideId,
  }
}
