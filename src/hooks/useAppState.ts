import { useState, useCallback, useRef, useEffect } from 'react'
import { PixelBuffer, ToolId, BloomSettings, Guide, ReferenceImageSettings, CANVAS_W, CANVAS_H, MAX_FRAMES } from '../types'
import { debouncedSave, loadFromIndexedDB } from '../lib/storage'

function blankFrame(): PixelBuffer {
  return new Uint8Array(CANVAS_W * CANVAS_H) as PixelBuffer
}

const DEFAULT_BLOOM: BloomSettings = {
  enabled: false,
  intensity: 0.5,
  radius: 8,
}

export function useAppState() {
  const [frames, setFramesState] = useState<PixelBuffer[]>([blankFrame()])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [tool, setTool] = useState<ToolId>('pencil')
  const [eraserSize, setEraserSize] = useState<1 | 2 | 4 | 8>(1)
  const [bloom, setBloom] = useState<BloomSettings>(DEFAULT_BLOOM)
  const [zoom, setZoomState] = useState(10)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [showGrid, setShowGrid] = useState(true)
  const [onionEnabled, setOnionEnabled] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [guides, setGuides] = useState<Guide[]>([])
  const [guidesLocked, setGuidesLocked] = useState(false)
  const [referenceImage, setReferenceImage] = useState<ReferenceImageSettings | null>(null)
  const [canvasColor, setCanvasColor] = useState('#20242d')
  const [pixelColor, setPixelColor] = useState('#d2e1ff')

  const framesRef = useRef(frames)
  const currentFrameRef = useRef(currentFrame)
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { framesRef.current = frames }, [frames])
  useEffect(() => { currentFrameRef.current = currentFrame }, [currentFrame])

  // Load from IndexedDB on mount
  useEffect(() => {
    loadFromIndexedDB().then(loaded => {
      if (loaded && loaded.length > 0) {
        setFramesState(loaded)
        framesRef.current = loaded
      }
      setIsLoaded(true)
    }).catch(() => setIsLoaded(true))
  }, [])

  const setFrames = useCallback((next: PixelBuffer[]) => {
    setFramesState(next)
    framesRef.current = next
    debouncedSave(next)
  }, [])

  const setFrame = useCallback((frameIndex: number, buf: PixelBuffer) => {
    const next = framesRef.current.slice()
    next[frameIndex] = buf
    setFrames(next)
  }, [setFrames])

  const getFrames = useCallback(() => framesRef.current, [])
  const getCurrentFrame = useCallback(() => currentFrameRef.current, [])

  // Playback
  const startPlay = useCallback(() => {
    setIsPlaying(true)
    playIntervalRef.current = setInterval(() => {
      setCurrentFrame(f => {
        const len = framesRef.current.length
        return (f + 1) % len
      })
    }, Math.round(1000 / 12))
  }, [])

  const stopPlay = useCallback(() => {
    setIsPlaying(false)
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current)
      playIntervalRef.current = null
    }
  }, [])

  const togglePlay = useCallback(() => {
    if (isPlaying) stopPlay()
    else startPlay()
  }, [isPlaying, startPlay, stopPlay])

  // Frame operations
  const addFrame = useCallback(() => {
    const cur = framesRef.current
    if (cur.length >= MAX_FRAMES) return
    const next = [...cur, blankFrame()]
    setFrames(next)
    setCurrentFrame(next.length - 1)
  }, [setFrames])

  const deleteFrame = useCallback(() => {
    const cur = framesRef.current
    if (cur.length <= 1) return
    const fi = currentFrameRef.current
    const next = cur.filter((_, i) => i !== fi)
    setFrames(next)
    setCurrentFrame(Math.min(fi, next.length - 1))
  }, [setFrames])

  const duplicateFrame = useCallback(() => {
    const cur = framesRef.current
    if (cur.length >= MAX_FRAMES) return
    const fi = currentFrameRef.current
    const clone = cur[fi].slice() as PixelBuffer
    const next = [...cur.slice(0, fi + 1), clone, ...cur.slice(fi + 1)]
    setFrames(next)
    setCurrentFrame(fi + 1)
  }, [setFrames])

  const clearCanvas = useCallback(() => {
    const next = [blankFrame()]
    setFrames(next)
    setCurrentFrame(0)
  }, [setFrames])

  const loadFrames = useCallback((newFrames: PixelBuffer[]) => {
    setFrames(newFrames)
    setCurrentFrame(0)
  }, [setFrames])

  // Zoom
  const setZoom = useCallback((z: number) => {
    setZoomState(Math.min(50, Math.max(1, z)))
  }, [])

  const setFitZoom = useCallback((viewportW: number, viewportH: number) => {
    const z = Math.min(viewportW / CANVAS_W, viewportH / CANVAS_H)
    setZoom(Math.floor(z))
  }, [setZoom])

  // Pan
  const adjustPan = useCallback((dx: number, dy: number) => {
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }, [])

  // Guide operations
  const addGuide = useCallback((axis: 'h' | 'v') => {
    setGuides(g => [...g, {
      id: crypto.randomUUID(),
      axis,
      position: axis === 'v' ? Math.floor(CANVAS_W / 2) : Math.floor(CANVAS_H / 2),
    }])
  }, [])

  const moveGuide = useCallback((id: string, position: number) => {
    setGuides(g => g.map(x => x.id === id ? { ...x, position } : x))
  }, [])

  const deleteGuide = useCallback((id: string) => {
    setGuides(g => g.filter(x => x.id !== id))
  }, [])

  return {
    frames,
    currentFrame,
    setCurrentFrame,
    tool,
    setTool,
    eraserSize,
    setEraserSize,
    bloom,
    setBloom,
    zoom,
    setZoom,
    setFitZoom,
    pan,
    setPan,
    adjustPan,
    showGrid,
    setShowGrid,
    onionEnabled,
    setOnionEnabled,
    isPlaying,
    togglePlay,
    stopPlay,
    isLoaded,
    guides,
    guidesLocked,
    setGuidesLocked,
    addGuide,
    moveGuide,
    deleteGuide,
    // Frame ops
    addFrame,
    deleteFrame,
    duplicateFrame,
    clearCanvas,
    loadFrames,
    referenceImage,
    setReferenceImage,
    canvasColor,
    setCanvasColor,
    pixelColor,
    setPixelColor,
    // Mutable helpers
    setFrame,
    getFrames,
    getCurrentFrame,
  }
}
