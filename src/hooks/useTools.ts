import { useCallback, useRef } from 'react'
import { ToolId, PixelBuffer } from '../types'
import { bresenhamLine, setPixel } from '../lib/bresenham'

interface UseToolsOptions {
  getFrames: () => PixelBuffer[]
  getCurrentFrame: () => number
  setFrame: (frameIndex: number, buf: PixelBuffer) => void
  pushHistory: (frameIndex: number, buf: PixelBuffer) => void
  zoom: number
  pan: { x: number; y: number }
  isPlaying: boolean
}

export function useTools(opts: UseToolsOptions) {
  const lastPxRef = useRef<{ x: number; y: number } | null>(null)
  const isDrawingRef = useRef(false)
  const isPanningRef = useRef(false)
  const panStartRef = useRef<{ mx: number; my: number } | null>(null)
  const spaceDownRef = useRef(false)

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

    const frameIndex = opts.getCurrentFrame()
    const frames = opts.getFrames()
    const buf = frames[frameIndex].slice() as PixelBuffer
    opts.pushHistory(frameIndex, buf)

    const { x, y } = canvasCoords(e)
    const val: 0 | 1 = tool === 'eraser' ? 0 : 1
    setPixel(buf, x, y, val)
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

    if (!isDrawingRef.current || opts.isPlaying) return

    const frameIndex = opts.getCurrentFrame()
    const frames = opts.getFrames()
    const buf = frames[frameIndex].slice() as PixelBuffer
    const { x, y } = canvasCoords(e)
    const val: 0 | 1 = tool === 'eraser' ? 0 : 1

    if (lastPxRef.current) {
      bresenhamLine(buf, lastPxRef.current.x, lastPxRef.current.y, x, y, val)
    } else {
      setPixel(buf, x, y, val)
    }
    opts.setFrame(frameIndex, buf)
    lastPxRef.current = { x, y }
  }, [opts])

  const onPointerUp = useCallback((_e: React.PointerEvent<HTMLElement>) => {
    isDrawingRef.current = false
    isPanningRef.current = false
    panStartRef.current = null
    lastPxRef.current = null
  }, [])

  return { onPointerDown, onPointerMove, onPointerUp, setOnPan, setSpaceDown }
}
