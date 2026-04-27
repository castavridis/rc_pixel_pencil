import { useRef, useState, useCallback, useEffect } from 'react'
import { TopBar } from './components/TopBar'
import { Canvas } from './components/Canvas'
import { Timeline } from './components/Timeline'
import { StatusBar } from './components/StatusBar'
import { LibraryPanel } from './components/LibraryPanel'
import { useAppState } from './hooks/useAppState'
import { useHistory } from './hooks/useHistory'
import { useTools } from './hooks/useTools'
import { PixelBuffer } from './types'
import './App.css'

export default function App() {
  const state = useAppState()
  const history = useHistory()
  const [cursorX, setCursorX] = useState<number | null>(null)
  const [cursorY, setCursorY] = useState<number | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)

  const pixelsCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const bloomCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  const tools = useTools({
    getFrames: state.getFrames,
    getCurrentFrame: state.getCurrentFrame,
    setFrame: state.setFrame,
    pushHistory: history.pushHistory,
    zoom: state.zoom,
    pan: state.pan,
    isPlaying: state.isPlaying,
    eraserSize: state.eraserSize,
    guides: state.guides,
    onMoveGuide: state.moveGuide,
    onDeleteGuide: state.deleteGuide,
  })

  // Connect pan callback
  useEffect(() => {
    tools.setOnPan((dx, dy) => {
      state.adjustPan(dx, dy)
    })
  }, [tools, state])

  // Zoom with cursor centering
  const handleZoomScroll = useCallback((delta: number, cx: number, cy: number) => {
    const oldZoom = state.zoom
    const newZoom = Math.min(50, Math.max(1, oldZoom + delta))
    if (newZoom === oldZoom) return
    const vp = viewportRef.current?.getBoundingClientRect()
    if (vp) {
      const vpCx = vp.left + vp.width / 2
      const vpCy = vp.top + vp.height / 2
      const relX = cx - vpCx
      const relY = cy - vpCy
      const panDx = relX * (newZoom / oldZoom - 1)
      const panDy = relY * (newZoom / oldZoom - 1)
      state.adjustPan(-panDx, -panDy)
    }
    state.setZoom(newZoom)
  }, [state])

  const handleFitZoom = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const { width, height } = vp.getBoundingClientRect()
    state.setFitZoom(width, height)
    state.setPan({ x: 0, y: 0 })
  }, [state])

  // Undo/redo wrappers
  const handleUndo = useCallback(() => {
    const fi = state.currentFrame
    const result = history.undo(fi, state.frames[fi])
    if (result) state.setFrame(fi, result)
  }, [state, history])

  const handleRedo = useCallback(() => {
    const fi = state.currentFrame
    const result = history.redo(fi, state.frames[fi])
    if (result) state.setFrame(fi, result)
  }, [state, history])

  // Import SVG into current frame
  const handleImportFrame = useCallback((buf: PixelBuffer) => {
    const fi = state.currentFrame
    history.pushHistory(fi, state.frames[fi])
    state.setFrame(fi, buf)
  }, [state, history])

  // New canvas
  const handleNew = useCallback(() => {
    const hasContent = state.frames.some(f => f.some(v => v !== 0))
    if (hasContent && !confirm('Discard current work and start fresh?')) return
    history.clearAll()
    state.clearCanvas()
  }, [state, history])

  // Load from library
  const handleLoadFromLibrary = useCallback((frames: PixelBuffer[]) => {
    history.clearAll()
    state.loadFrames(frames)
  }, [state, history])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const inputFocused = document.activeElement?.tagName === 'INPUT'

      if (e.code === 'Space' && !inputFocused) {
        e.preventDefault()
        tools.setSpaceDown(true)
        return
      }

      // Delete hovered guide
      if (e.key === 'Delete' && !inputFocused) {
        const hoveredId = tools.getHoveredGuideId()
        if (hoveredId) {
          state.deleteGuide(hoveredId)
          return
        }
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          handleUndo()
          return
        }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault()
          handleRedo()
          return
        }
        if (e.key === 'c') {
          e.preventDefault()
          import('./lib/svg').then(({ exportSVG }) => {
            const svg = exportSVG(state.frames[state.currentFrame])
            navigator.clipboard.writeText(svg).catch(() => {})
          })
          return
        }
        if (e.key === 'v') {
          e.preventDefault()
          navigator.clipboard.readText().then(async text => {
            if (text.trim().startsWith('<svg') || text.includes('<svg')) {
              const { importSVG } = await import('./lib/svg')
              const buf = await importSVG(text)
              handleImportFrame(buf)
            }
          }).catch(() => {})
          return
        }
        return
      }

      if (inputFocused) return

      switch (e.key) {
        case 'p': case 'P': state.setTool('pencil'); break
        case 'e': case 'E': state.setTool('eraser'); break
        case 'b': case 'B': state.setBloom({ ...state.bloom, enabled: !state.bloom.enabled }); break
        case 'g': case 'G': state.setShowGrid(!state.showGrid); break
        case 'o': case 'O': state.setOnionEnabled(!state.onionEnabled); break
        case '1': state.setZoom(1); break
        case '2': state.setZoom(10); break
        case '3': state.setZoom(25); break
        case '0': handleFitZoom(); break
        case 'ArrowLeft':
          e.preventDefault()
          state.setCurrentFrame(Math.max(0, state.currentFrame - 1))
          break
        case 'ArrowRight':
          e.preventDefault()
          state.setCurrentFrame(Math.min(state.frames.length - 1, state.currentFrame + 1))
          break
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        tools.setSpaceDown(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
    }
  }, [state, history, tools, handleUndo, handleRedo, handleImportFrame, handleFitZoom])

  if (!state.isLoaded) {
    return <div className="loading">Loading…</div>
  }

  return (
    <div className="app">
      <TopBar
        tool={state.tool}
        setTool={state.setTool}
        eraserSize={state.eraserSize}
        setEraserSize={state.setEraserSize}
        bloom={state.bloom}
        setBloom={state.setBloom}
        showGrid={state.showGrid}
        setShowGrid={state.setShowGrid}
        onionEnabled={state.onionEnabled}
        setOnionEnabled={state.setOnionEnabled}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.canUndo(state.currentFrame)}
        canRedo={history.canRedo(state.currentFrame)}
        frames={state.frames}
        currentFrame={state.currentFrame}
        onImportFrame={handleImportFrame}
        onNew={handleNew}
        onOpenLibrary={() => setShowLibrary(true)}
        onAddGuide={state.addGuide}
        pixelsCanvasRef={pixelsCanvasRef}
        bloomCanvasRef={bloomCanvasRef}
      />

      <div className="canvas-area" ref={viewportRef}>
        <Canvas
          frames={state.frames}
          currentFrame={state.currentFrame}
          zoom={state.zoom}
          pan={state.pan}
          showGrid={state.showGrid}
          onionEnabled={state.onionEnabled}
          bloom={state.bloom}
          tool={state.tool}
          eraserSize={state.eraserSize}
          isPlaying={state.isPlaying}
          guides={state.guides}
          hoveredGuideAxis={tools.hoveredGuideAxis}
          selectedGuideId={null}
          onCursorChange={(x, y) => { setCursorX(x); setCursorY(y) }}
          onPointerDown={tools.onPointerDown}
          onPointerMove={tools.onPointerMove}
          onPointerUp={tools.onPointerUp}
          onZoomScroll={handleZoomScroll}
          pixelsCanvasRef={pixelsCanvasRef}
          bloomCanvasRef={bloomCanvasRef}
        />
      </div>

      <Timeline
        frames={state.frames}
        currentFrame={state.currentFrame}
        isPlaying={state.isPlaying}
        onSelectFrame={state.setCurrentFrame}
        onAddFrame={state.addFrame}
        onDeleteFrame={state.deleteFrame}
        onDuplicateFrame={state.duplicateFrame}
        onTogglePlay={state.togglePlay}
      />

      <StatusBar
        cursorX={cursorX}
        cursorY={cursorY}
        zoom={state.zoom}
        onZoom={state.setZoom}
        onFit={handleFitZoom}
      />

      {showLibrary && (
        <LibraryPanel
          frames={state.frames}
          onLoad={handleLoadFromLibrary}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
  )
}
