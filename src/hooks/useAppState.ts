import { useState, useCallback, useRef, useEffect } from 'react'
import {
  PixelBuffer, ToolId, BloomSettings, Guide, Layer, Stamp,
  ReferenceImageSettings, SelectionRect, FloatingPaste, Clipboard,
  CANVAS_W, CANVAS_H, MAX_FRAMES,
} from '../types'
import { debouncedSave, flushSave, loadFromIndexedDB, loadStamps, debouncedSaveStamps } from '../lib/storage'
import { generateId } from '../lib/uuid'

function blankFrame(): PixelBuffer {
  return new Uint8Array(CANVAS_W * CANVAS_H) as PixelBuffer
}

function makeInitialLayer(): Layer {
  return { id: generateId(), name: 'Layer 1', visible: true, frames: [blankFrame()] }
}

const DEFAULT_BLOOM: BloomSettings = {
  enabled: false,
  intensity: 0.5,
  radius: 3,
}

export function useAppState() {
  // ── Layers ────────────────────────────────────────────────────────────────
  const initialLayer = useRef(makeInitialLayer())
  const [layers, setLayersState] = useState<Layer[]>([initialLayer.current])
  const [activeLayerId, setActiveLayerIdState] = useState<string>(initialLayer.current.id)

  const layersRef = useRef(layers)
  const activeLayerIdRef = useRef(activeLayerId)

  const setLayers = useCallback((next: Layer[]) => {
    setLayersState(next)
    layersRef.current = next
    debouncedSave(next, activeLayerIdRef.current, frameGuidesRef.current)
  }, [])

  const setActiveLayerId = useCallback((id: string) => {
    activeLayerIdRef.current = id
    setActiveLayerIdState(id)
  }, [])

  // ── Frames ────────────────────────────────────────────────────────────────
  const [currentFrame, setCurrentFrame] = useState(0)
  const currentFrameRef = useRef(currentFrame)
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { layersRef.current = layers }, [layers])
  useEffect(() => { activeLayerIdRef.current = activeLayerId }, [activeLayerId])
  useEffect(() => { currentFrameRef.current = currentFrame }, [currentFrame])

  // ── Other UI state ────────────────────────────────────────────────────────
  const [tool, setTool] = useState<ToolId>('pencil')
  const [eraserSize, setEraserSize] = useState<1 | 2 | 4 | 8>(1)
  const [pencilSize, setPencilSize] = useState<1 | 2 | 4 | 8>(1)
  const [smartErase, setSmartErase] = useState(false)
  const [bloom, setBloom] = useState<BloomSettings>(DEFAULT_BLOOM)
  const [zoom, setZoomState] = useState(10)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [showGrid, setShowGrid] = useState(true)
  const [onionEnabled, setOnionEnabled] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [frameGuidesState, setFrameGuidesState] = useState<Guide[][]>([])
  const frameGuidesRef = useRef<Guide[][]>([])
  const setFrameGuides = useCallback((next: Guide[][]) => {
    setFrameGuidesState(next)
    frameGuidesRef.current = next
    debouncedSave(layersRef.current, activeLayerIdRef.current, next)
  }, [])
  const [guidesLocked, setGuidesLocked] = useState(false)
  const [referenceImage, setReferenceImage] = useState<ReferenceImageSettings | null>(null)
  const [canvasColor, setCanvasColor] = useState('#20242d')
  const [pixelColor, setPixelColor] = useState('#d2e1ff')
  const [darkColor, setDarkColor] = useState('#20242d')
  const [showPreview, setShowPreview] = useState(true)
  const [mirrorX, setMirrorX] = useState(false)

  // ── Stamps ────────────────────────────────────────────────────────────────
  const [stamps, setStampsState] = useState<Stamp[]>([])
  const [activeStampId, setActiveStampId] = useState<string | null>(null)
  const [showStamps, setShowStamps] = useState(false)

  const setStamps = useCallback((next: Stamp[]) => {
    setStampsState(next)
    debouncedSaveStamps(next)
  }, [])

  // ── Selection ─────────────────────────────────────────────────────────────
  const selectionRef = useRef<SelectionRect | null>(null)
  const [selection, setSelectionState] = useState<SelectionRect | null>(null)
  const clipboardRef = useRef<Clipboard | null>(null)
  const [clipboard, setClipboardState] = useState<Clipboard | null>(null)
  const floatingPasteRef = useRef<FloatingPaste | null>(null)
  const [floatingPaste, setFloatingPasteState] = useState<FloatingPaste | null>(null)

  const setSelection = useCallback((sel: SelectionRect | null) => {
    selectionRef.current = sel
    setSelectionState(sel)
  }, [])

  const setClipboard = useCallback((cb: Clipboard | null) => {
    clipboardRef.current = cb
    setClipboardState(cb)
  }, [])

  const setFloatingPaste = useCallback((fp: FloatingPaste | null) => {
    floatingPasteRef.current = fp
    setFloatingPasteState(fp)
  }, [])

  // ── Flush save on page hide/unload ───────────────────────────────────────
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') { flushSave() } }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
  }, [])

  // ── Load from IndexedDB ───────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([loadFromIndexedDB(), loadStamps()]).then(([loaded, loadedStamps]) => {
      if (loaded && loaded.layers.length > 0) {
        setLayersState(loaded.layers)
        layersRef.current = loaded.layers
        const restoredActiveId = loaded.activeLayerId
          && loaded.layers.some(l => l.id === loaded.activeLayerId)
          ? loaded.activeLayerId
          : loaded.layers[loaded.layers.length - 1].id
        setActiveLayerIdState(restoredActiveId)
        activeLayerIdRef.current = restoredActiveId
        if (loaded.frameGuides.length > 0) {
          setFrameGuidesState(loaded.frameGuides)
          frameGuidesRef.current = loaded.frameGuides
        }
      }
      setStampsState(loadedStamps)
      setIsLoaded(true)
    }).catch(() => setIsLoaded(true))
  }, [])

  // ── Playback ──────────────────────────────────────────────────────────────
  const startPlay = useCallback(() => {
    setIsPlaying(true)
    playIntervalRef.current = setInterval(() => {
      setCurrentFrame(f => {
        const len = layersRef.current[0]?.frames.length ?? 1
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

  // ── Frame operations (act on ALL layers) ──────────────────────────────────
  const frameCount = useCallback(() => layersRef.current[0]?.frames.length ?? 1, [])

  const addFrame = useCallback(() => {
    if (frameCount() >= MAX_FRAMES) return
    const next = layersRef.current.map(l => ({ ...l, frames: [...l.frames, blankFrame()] }))
    setLayers(next)
    setFrameGuides([...frameGuidesRef.current, []])
    setCurrentFrame(frameCount() - 1)
  }, [setLayers, setFrameGuides, frameCount])

  const deleteFrame = useCallback(() => {
    const count = frameCount()
    if (count <= 1) return
    const fi = currentFrameRef.current
    const next = layersRef.current.map(l => ({ ...l, frames: l.frames.filter((_, i) => i !== fi) }))
    setLayers(next)
    setFrameGuides(frameGuidesRef.current.filter((_, i) => i !== fi))
    setCurrentFrame(Math.min(fi, count - 2))
  }, [setLayers, setFrameGuides, frameCount])

  const duplicateFrame = useCallback(() => {
    if (frameCount() >= MAX_FRAMES) return
    const fi = currentFrameRef.current
    const next = layersRef.current.map(l => ({
      ...l,
      frames: [
        ...l.frames.slice(0, fi + 1),
        l.frames[fi].slice() as PixelBuffer,
        ...l.frames.slice(fi + 1),
      ],
    }))
    setLayers(next)
    const fg = frameGuidesRef.current
    const srcGuides = (fg[fi] ?? []).map(g => ({ ...g, id: generateId() }))
    setFrameGuides([...fg.slice(0, fi + 1), srcGuides, ...fg.slice(fi + 1)])
    setCurrentFrame(fi + 1)
  }, [setLayers, setFrameGuides, frameCount])

  const clearCanvas = useCallback(() => {
    const newLayer = makeInitialLayer()
    const next = [newLayer]
    setLayersState(next)
    layersRef.current = next
    setActiveLayerIdState(newLayer.id)
    activeLayerIdRef.current = newLayer.id
    setCurrentFrame(0)
    debouncedSave(next, newLayer.id, [])
    setFrameGuides([])
  }, [setFrameGuides])

  const loadFrames = useCallback((newFrames: PixelBuffer[]) => {
    const newId = generateId()
    const next: Layer[] = [{ id: newId, name: 'Layer 1', visible: true, frames: newFrames }]
    setLayersState(next)
    layersRef.current = next
    setActiveLayerIdState(newId)
    activeLayerIdRef.current = newId
    setCurrentFrame(0)
    debouncedSave(next, newId, [])
    setFrameGuides([])
  }, [setFrameGuides])

  const loadLayers = useCallback((newLayers: Layer[], newFrameGuides: Guide[][] = []) => {
    const next = newLayers.map(l => ({ ...l, frames: l.frames.map(f => f.slice() as PixelBuffer) }))
    setLayersState(next)
    layersRef.current = next
    const activeId = next[next.length - 1]?.id ?? next[0].id
    setActiveLayerIdState(activeId)
    activeLayerIdRef.current = activeId
    setCurrentFrame(0)
    debouncedSave(next, activeId, newFrameGuides)
    setFrameGuides(newFrameGuides)
  }, [setFrameGuides])

  // ── Layer frame helpers ───────────────────────────────────────────────────
  const setLayerFrame = useCallback((layerId: string, frameIdx: number, buf: PixelBuffer) => {
    const next = layersRef.current.map(l => {
      if (l.id !== layerId) return l
      const newFrames = [...l.frames]
      newFrames[frameIdx] = buf
      return { ...l, frames: newFrames }
    })
    setLayers(next)
  }, [setLayers])

  const restoreLayers = useCallback((restoredLayers: Layer[], activeId: string) => {
    const next = restoredLayers.map(l => ({ ...l, frames: l.frames.map(f => f.slice() as PixelBuffer) }))
    setLayers(next)
    setActiveLayerId(activeId)
  }, [setLayers, setActiveLayerId])

  // ── Active layer frame helpers ────────────────────────────────────────────
  const getFrames = useCallback(() => {
    const layer = layersRef.current.find(l => l.id === activeLayerIdRef.current) ?? layersRef.current[0]
    return layer.frames
  }, [])

  const getCurrentFrame = useCallback(() => currentFrameRef.current, [])
  const getActiveLayerId = useCallback(() => activeLayerIdRef.current, [])

  const setFrame = useCallback((frameIndex: number, buf: PixelBuffer) => {
    const layerId = activeLayerIdRef.current
    const next = layersRef.current.map(l => {
      if (l.id !== layerId) return l
      const newFrames = [...l.frames]
      newFrames[frameIndex] = buf
      return { ...l, frames: newFrames }
    })
    setLayers(next)
  }, [setLayers])

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const setZoom = useCallback((z: number) => {
    setZoomState(Math.min(50, Math.max(1, z)))
  }, [])

  const setFitZoom = useCallback((viewportW: number, viewportH: number) => {
    const z = Math.min(viewportW / CANVAS_W, viewportH / CANVAS_H)
    setZoom(Math.floor(z))
  }, [setZoom])

  // ── Pan ───────────────────────────────────────────────────────────────────
  const adjustPan = useCallback((dx: number, dy: number) => {
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }, [])

  // ── Guide operations ──────────────────────────────────────────────────────
  const guides = frameGuidesState[currentFrame] ?? []

  const addGuide = useCallback((axis: 'h' | 'v') => {
    const fi = currentFrameRef.current
    const fg = frameGuidesRef.current
    const next = [...fg]
    next[fi] = [...(next[fi] ?? []), {
      id: generateId(),
      axis,
      position: axis === 'v' ? Math.floor(CANVAS_W / 2) : Math.floor(CANVAS_H / 2),
    }]
    setFrameGuides(next)
  }, [setFrameGuides])

  const moveGuide = useCallback((id: string, position: number) => {
    const fi = currentFrameRef.current
    const fg = frameGuidesRef.current
    const next = [...fg]
    next[fi] = (next[fi] ?? []).map(x => x.id === id ? { ...x, position } : x)
    setFrameGuides(next)
  }, [setFrameGuides])

  const deleteGuide = useCallback((id: string) => {
    const fi = currentFrameRef.current
    const fg = frameGuidesRef.current
    const next = [...fg]
    next[fi] = (next[fi] ?? []).filter(x => x.id !== id)
    setFrameGuides(next)
  }, [setFrameGuides])

  // ── Layer operations ──────────────────────────────────────────────────────
  const addLayer = useCallback(() => {
    const count = layersRef.current[0]?.frames.length ?? 1
    const newLayer: Layer = {
      id: generateId(),
      name: `Layer ${layersRef.current.length + 1}`,
      visible: true,
      frames: Array.from({ length: count }, blankFrame),
    }
    const activeIdx = layersRef.current.findIndex(l => l.id === activeLayerIdRef.current)
    const insertAt = activeIdx === -1 ? layersRef.current.length : activeIdx + 1
    const next = [
      ...layersRef.current.slice(0, insertAt),
      newLayer,
      ...layersRef.current.slice(insertAt),
    ]
    setLayers(next)
    setActiveLayerId(newLayer.id)
  }, [setLayers, setActiveLayerId])

  const deleteLayer = useCallback((id: string) => {
    if (layersRef.current.length <= 1) return
    const idx = layersRef.current.findIndex(l => l.id === id)
    const next = layersRef.current.filter(l => l.id !== id)
    setLayers(next)
    if (activeLayerIdRef.current === id) {
      setActiveLayerId(next[Math.max(0, idx - 1)].id)
    }
  }, [setLayers, setActiveLayerId])

  const moveLayer = useCallback((id: string, dir: 'up' | 'down') => {
    const idx = layersRef.current.findIndex(l => l.id === id)
    if (idx === -1) return
    if (dir === 'up' && idx >= layersRef.current.length - 1) return
    if (dir === 'down' && idx <= 0) return
    const next = [...layersRef.current]
    const swapIdx = dir === 'up' ? idx + 1 : idx - 1;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    setLayers(next)
  }, [setLayers])

  const renameLayer = useCallback((id: string, name: string) => {
    setLayers(layersRef.current.map(l => l.id === id ? { ...l, name } : l))
  }, [setLayers])

  const toggleLayerVisible = useCallback((id: string) => {
    setLayers(layersRef.current.map(l => l.id === id ? { ...l, visible: !l.visible } : l))
  }, [setLayers])

  const stampLayerToAllFrames = useCallback((id: string) => {
    const layer = layersRef.current.find(l => l.id === id)
    if (!layer) return
    const src = layer.frames[currentFrameRef.current]
    setLayers(layersRef.current.map(l =>
      l.id !== id ? l : { ...l, frames: l.frames.map(() => src.slice() as PixelBuffer) }
    ))
  }, [setLayers])

  // ── Selection operations ──────────────────────────────────────────────────
  const copySelection = useCallback(() => {
    const sel = selectionRef.current
    if (!sel) return
    const layer = layersRef.current.find(l => l.id === activeLayerIdRef.current) ?? layersRef.current[0]
    const frame = layer.frames[currentFrameRef.current]
    if (!frame) return
    const { x, y, w, h } = sel
    const buf = new Uint8Array(w * h)
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const sx = x + px, sy = y + py
        if (sx >= 0 && sx < CANVAS_W && sy >= 0 && sy < CANVAS_H) {
          buf[py * w + px] = frame[sy * CANVAS_W + sx]
        }
      }
    }
    setClipboard({ w, h, buf })
  }, [setClipboard])

  const cutSelection = useCallback(() => {
    const sel = selectionRef.current
    if (!sel) return
    const layer = layersRef.current.find(l => l.id === activeLayerIdRef.current) ?? layersRef.current[0]
    const fi = currentFrameRef.current
    const frame = layer.frames[fi].slice() as PixelBuffer
    const { x, y, w, h } = sel
    const buf = new Uint8Array(w * h)
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const sx = x + px, sy = y + py
        if (sx >= 0 && sx < CANVAS_W && sy >= 0 && sy < CANVAS_H) {
          buf[py * w + px] = frame[sy * CANVAS_W + sx]
          frame[sy * CANVAS_W + sx] = 0
        }
      }
    }
    setClipboard({ w, h, buf })
    setFrame(fi, frame)
  }, [setClipboard, setFrame])

  const pasteClipboard = useCallback(() => {
    const cb = clipboardRef.current
    if (!cb) return
    setFloatingPaste({ ...cb, x: 0, y: 0 })
  }, [setFloatingPaste])

  const commitPaste = useCallback(() => {
    const fp = floatingPasteRef.current
    if (!fp) return
    const layer = layersRef.current.find(l => l.id === activeLayerIdRef.current) ?? layersRef.current[0]
    const fi = currentFrameRef.current
    const frame = layer.frames[fi].slice() as PixelBuffer
    for (let py = 0; py < fp.h; py++) {
      for (let px = 0; px < fp.w; px++) {
        const sx = fp.x + px, sy = fp.y + py
        if (sx >= 0 && sx < CANVAS_W && sy >= 0 && sy < CANVAS_H) {
          const v = fp.buf[py * fp.w + px]
          if (v) frame[sy * CANVAS_W + sx] = v
        }
      }
    }
    setFrame(fi, frame)
    setFloatingPaste(null)
  }, [setFrame, setFloatingPaste])

  const moveFloatingPaste = useCallback((x: number, y: number) => {
    const fp = floatingPasteRef.current
    if (!fp) return
    setFloatingPaste({ ...fp, x, y })
  }, [setFloatingPaste])

  const cancelPaste = useCallback(() => {
    setFloatingPaste(null)
  }, [setFloatingPaste])

  const clearSelection = useCallback(() => {
    setSelection(null)
  }, [setSelection])

  // ── Stamp CRUD ────────────────────────────────────────────────────────────
  const createStamp = useCallback((name: string, width: number, height: number) => {
    const newStamp: Stamp = {
      id: generateId(),
      name,
      width,
      height,
      buf: new Uint8Array(width * height),
    }
    const next = [...stamps, newStamp]
    setStamps(next)
    setActiveStampId(newStamp.id)
  }, [stamps, setStamps])

  const updateStamp = useCallback((updated: Stamp) => {
    setStamps(stamps.map(s => s.id === updated.id ? updated : s))
  }, [stamps, setStamps])

  const deleteStamp = useCallback((id: string) => {
    const next = stamps.filter(s => s.id !== id)
    setStamps(next)
    if (activeStampId === id) setActiveStampId(null)
  }, [stamps, setStamps, activeStampId])

  return {
    // Layers
    layers,
    activeLayerId,
    setActiveLayerId,
    addLayer,
    deleteLayer,
    moveLayer,
    renameLayer,
    toggleLayerVisible,
    stampLayerToAllFrames,
    // Frame state
    currentFrame,
    setCurrentFrame,
    // Frame ops
    addFrame,
    deleteFrame,
    duplicateFrame,
    clearCanvas,
    loadFrames,
    loadLayers,
    // Mutable helpers
    setFrame,
    setLayerFrame,
    restoreLayers,
    getFrames,
    getCurrentFrame,
    getActiveLayerId,
    // Other UI state
    tool,
    setTool,
    eraserSize,
    setEraserSize,
    pencilSize,
    setPencilSize,
    smartErase,
    setSmartErase,
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
    frameGuides: frameGuidesState,
    guidesLocked,
    setGuidesLocked,
    addGuide,
    moveGuide,
    deleteGuide,
    referenceImage,
    setReferenceImage,
    canvasColor,
    setCanvasColor,
    pixelColor,
    setPixelColor,
    darkColor,
    setDarkColor,
    showPreview,
    setShowPreview,
    mirrorX,
    setMirrorX,
    // Selection
    selection,
    setSelection,
    clipboard,
    floatingPaste,
    copySelection,
    cutSelection,
    pasteClipboard,
    moveFloatingPaste,
    commitPaste,
    cancelPaste,
    clearSelection,
    // Stamps
    stamps,
    setStamps,
    activeStampId,
    setActiveStampId,
    showStamps,
    setShowStamps,
    createStamp,
    updateStamp,
    deleteStamp,
  }
}
