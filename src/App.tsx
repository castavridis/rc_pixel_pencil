import { useRef, useState, useCallback, useEffect } from 'react'
import { TopBar } from './components/TopBar'
import { Canvas } from './components/Canvas'
import { Timeline } from './components/Timeline'
import { StatusBar } from './components/StatusBar'
import { LibraryPanel } from './components/LibraryPanel'
import { LayerPanel } from './components/LayerPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { StampPanel } from './components/StampPanel'
import { useAppState } from './hooks/useAppState'
import { useHistory } from './hooks/useHistory'
import { useTools } from './hooks/useTools'
import { PixelBuffer, Layer } from './types'
import './App.css'

export default function App() {
  const state = useAppState()
  const history = useHistory()
  const [cursorX, setCursorX] = useState<number | null>(null)
  const [cursorY, setCursorY] = useState<number | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showLayers, setShowLayers] = useState(false)

  const pixelsCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const bloomCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  const altDownRef = useRef(false)
  const [altDown, setAltDown] = useState(false)
  const isAltDown = useCallback(() => altDownRef.current, [])

  const getActiveStamp = useCallback(() => {
    if (!state.activeStampId) return null
    return state.stamps.find(s => s.id === state.activeStampId) ?? null
  }, [state.stamps, state.activeStampId])

  const handleSelectStamp = useCallback((id: string) => {
    state.setActiveStampId(id)
    state.setTool('stamp')
  }, [state])

  const handleMoveReferenceImage = useCallback((x: number, y: number) => {
    if (!state.referenceImage) return
    state.setReferenceImage({ ...state.referenceImage, x, y })
  }, [state])

  const handleScaleReferenceImage = useCallback((scale: number) => {
    if (!state.referenceImage) return
    state.setReferenceImage({ ...state.referenceImage, scale })
  }, [state])

  const tools = useTools({
    getFrames: state.getFrames,
    getCurrentFrame: state.getCurrentFrame,
    setFrame: state.setFrame,
    pushHistory: (frameIndex: number, buf: PixelBuffer) =>
      history.pushPixel(state.getActiveLayerId(), frameIndex, buf),
    zoom: state.zoom,
    pan: state.pan,
    isPlaying: state.isPlaying,
    eraserSize: state.eraserSize,
    guides: state.guides,
    guidesLocked: state.guidesLocked,
    referenceImage: state.referenceImage,
    onMoveGuide: state.moveGuide,
    onDeleteGuide: state.deleteGuide,
    onMoveReferenceImage: handleMoveReferenceImage,
    isAltDown,
    getActiveStamp,
    selection: state.selection,
    floatingPaste: state.floatingPaste,
    onSetSelection: state.setSelection,
    onMoveFloating: state.moveFloatingPaste,
    onCommitPaste: state.commitPaste,
    smartErase: state.smartErase,
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

  const getCurrentPixel = useCallback(
    (layerId: string, frameIdx: number): PixelBuffer | null => {
      const layer = state.layers.find(l => l.id === layerId)
      return layer?.frames[frameIdx] ?? null
    },
    [state.layers],
  )

  const handleUndo = useCallback(() => {
    const entry = history.undo(getCurrentPixel, () => state.layers, () => state.activeLayerId)
    if (!entry) return
    if (entry.kind === 'pixel') state.setLayerFrame(entry.layerId, entry.frameIdx, entry.snapshot)
    else state.restoreLayers(entry.snapshot, entry.activeId)
  }, [state, history, getCurrentPixel])

  const handleRedo = useCallback(() => {
    const entry = history.redo(getCurrentPixel, () => state.layers, () => state.activeLayerId)
    if (!entry) return
    if (entry.kind === 'pixel') state.setLayerFrame(entry.layerId, entry.frameIdx, entry.snapshot)
    else state.restoreLayers(entry.snapshot, entry.activeId)
  }, [state, history, getCurrentPixel])

  const handleImportFrame = useCallback((buf: PixelBuffer) => {
    const fi = state.getCurrentFrame()
    const layerId = state.getActiveLayerId()
    const frames = state.getFrames()
    history.pushPixel(layerId, fi, frames[fi])
    state.setFrame(fi, buf)
  }, [state, history])

  const handleNew = useCallback(() => {
    const hasContent = state.layers.some(l => l.frames.some(f => f.some(v => v !== 0)))
    if (hasContent && !confirm('Discard current work and start fresh?')) return
    history.clearAll()
    state.clearCanvas()
  }, [state, history])

  const handleLoadFromLibrary = useCallback((layers: Layer[]) => {
    history.clearAll()
    state.loadLayers(layers)
  }, [state, history])

  const handleDeleteHoveredGuide = useCallback(() => {
    if (state.guidesLocked) return
    const id = tools.getHoveredGuideId()
    if (id) state.deleteGuide(id)
  }, [tools, state])

  // Layer ops wrapped with history push
  const handleAddLayer = useCallback(() => {
    history.pushLayers(state.layers, state.activeLayerId)
    state.addLayer()
  }, [history, state])

  const handleDeleteLayer = useCallback((id: string) => {
    history.pushLayers(state.layers, state.activeLayerId)
    state.deleteLayer(id)
  }, [history, state])

  const handleMoveLayer = useCallback((id: string, dir: 'up' | 'down') => {
    history.pushLayers(state.layers, state.activeLayerId)
    state.moveLayer(id, dir)
  }, [history, state])

  const handleStampToAll = useCallback((id: string) => {
    history.pushLayers(state.layers, state.activeLayerId)
    state.stampLayerToAllFrames(id)
  }, [history, state])


  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const inputFocused = document.activeElement?.tagName === 'INPUT'

      // Modifier keys — handle regardless of inputFocused
      if (e.key === 'Shift') {
        tools.setShiftDown(true)
        return
      }
      if (e.key === 'Alt') {
        e.preventDefault()
        altDownRef.current = true
        setAltDown(true)
        return
      }

      if (e.code === 'Space' && !inputFocused) {
        e.preventDefault()
        tools.setSpaceDown(true)
        return
      }

      if (e.key === 'Delete' && !inputFocused) {
        handleDeleteHoveredGuide()
        return
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
        if (e.key === 'c' && !inputFocused) {
          e.preventDefault()
          if (state.tool === 'select' && state.selection) {
            state.copySelection()
          } else {
            import('./lib/svg').then(({ exportSVG }) => {
              const frame = state.getFrames()[state.getCurrentFrame()]
              const svg = exportSVG(frame)
              navigator.clipboard.writeText(svg).catch(() => {})
            })
          }
          return
        }
        if (e.key === 'x' && !inputFocused) {
          e.preventDefault()
          if (state.tool === 'select' && state.selection) {
            state.cutSelection()
          }
          return
        }
        if (e.key === 'v' && !inputFocused) {
          e.preventDefault()
          if (state.clipboard) {
            state.pasteClipboard()
          } else {
            navigator.clipboard.readText().then(async text => {
              if (text.trim().startsWith('<svg') || text.includes('<svg')) {
                const { importSVG } = await import('./lib/svg')
                const buf = await importSVG(text)
                handleImportFrame(buf)
              }
            }).catch(() => {})
          }
          return
        }
        return
      }

      if (inputFocused) return

      switch (e.key) {
        case 'd': case 'D': state.setTool('pencil'); break
        case 'e': case 'E': state.setTool('eraser'); break
        case 's': case 'S': state.setTool('select'); break
        case 't': case 'T': state.setTool('stamp'); break
        case 'b': case 'B': state.setBloom({ ...state.bloom, enabled: !state.bloom.enabled }); break
        case 'g': case 'G': state.setShowGrid(!state.showGrid); break
        case 'o': case 'O': state.setOnionEnabled(!state.onionEnabled); break
        case '1': state.setZoom(1); break
        case '2': state.setZoom(10); break
        case '3': state.setZoom(25); break
        case '0': handleFitZoom(); break
        case 'Escape':
          state.cancelPaste()
          state.clearSelection()
          break
        case 'Enter':
          if (state.floatingPaste) state.commitPaste()
          break
        case 'ArrowLeft':
          e.preventDefault()
          state.setCurrentFrame(Math.max(0, state.currentFrame - 1))
          break
        case 'ArrowRight': {
          e.preventDefault()
          const frameCount = state.layers[0]?.frames.length ?? 1
          state.setCurrentFrame(Math.min(frameCount - 1, state.currentFrame + 1))
          break
        }
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') tools.setSpaceDown(false)
      if (e.key === 'Shift') tools.setShiftDown(false)
      if (e.key === 'Alt') { altDownRef.current = false; setAltDown(false) }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
    }
  }, [state, history, tools, handleUndo, handleRedo, handleImportFrame, handleFitZoom, handleDeleteHoveredGuide])

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
        canUndo={history.canUndo()}
        canRedo={history.canRedo()}
        layers={state.layers}
        currentFrame={state.currentFrame}
        onImportFrame={handleImportFrame}
        onNew={handleNew}
        onOpenLibrary={() => setShowLibrary(true)}
        onAddGuide={state.addGuide}
        guidesLocked={state.guidesLocked}
        onSetGuidesLocked={state.setGuidesLocked}
        showLayers={showLayers}
        onToggleLayers={() => setShowLayers(v => !v)}
        showPreview={state.showPreview}
        onTogglePreview={() => state.setShowPreview(!state.showPreview)}
        pixelsCanvasRef={pixelsCanvasRef}
        bloomCanvasRef={bloomCanvasRef}
        referenceImage={state.referenceImage}
        onSetReferenceImage={state.setReferenceImage}
        canvasColor={state.canvasColor}
        onSetCanvasColor={state.setCanvasColor}
        pixelColor={state.pixelColor}
        onSetPixelColor={state.setPixelColor}
        darkColor={state.darkColor}
        onSetDarkColor={state.setDarkColor}
        showStamps={state.showStamps}
        onToggleStamps={() => state.setShowStamps(!state.showStamps)}
        activeStampName={getActiveStamp()?.name ?? null}
        selection={state.selection}
        clipboard={state.clipboard}
        floatingPaste={state.floatingPaste}
        onCopy={() => { if (state.selection) state.copySelection() }}
        onCut={() => { if (state.selection) state.cutSelection() }}
        onPaste={() => { if (state.clipboard) state.pasteClipboard() }}
        onCommitPaste={state.commitPaste}
        onCancelPaste={state.cancelPaste}
        smartErase={state.smartErase}
        onSetSmartErase={state.setSmartErase}
      />

      <div className="canvas-area" ref={viewportRef}>
        <Canvas
          layers={state.layers}
          activeLayerId={state.activeLayerId}
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
          guidesLocked={state.guidesLocked}
          hoveredGuideAxis={tools.hoveredGuideAxis}
          selectedGuideId={null}
          pendingDeleteGuideId={tools.pendingDeleteGuideId}
          spaceDown={tools.spaceDown}
          isPanning={tools.isPanning}
          isRefDragging={tools.isRefDragging}
          onCursorChange={(x, y) => { setCursorX(x); setCursorY(y) }}
          onPointerDown={tools.onPointerDown}
          onPointerMove={tools.onPointerMove}
          onPointerUp={tools.onPointerUp}
          onZoomScroll={handleZoomScroll}
          onDeleteHoveredGuide={handleDeleteHoveredGuide}
          pixelsCanvasRef={pixelsCanvasRef}
          bloomCanvasRef={bloomCanvasRef}
          referenceImage={state.referenceImage}
          canvasColor={state.canvasColor}
          pixelColor={state.pixelColor}
          onScaleReferenceImage={handleScaleReferenceImage}
          selection={state.selection}
          floatingPaste={state.floatingPaste}
          darkColor={state.darkColor}
          altDown={altDown}
          activeStamp={getActiveStamp()}
        />
        {state.showPreview && (
          <PreviewPanel
            layers={state.layers}
            currentFrame={state.currentFrame}
            pixelColor={state.pixelColor}
            darkColor={state.darkColor}
            canvasColor={state.canvasColor}
            onClose={() => state.setShowPreview(false)}
          />
        )}
        {state.showStamps && (
          <StampPanel
            stamps={state.stamps}
            activeStampId={state.activeStampId}
            pixelColor={state.pixelColor}
            darkColor={state.darkColor}
            onSelectStamp={handleSelectStamp}
            onUpdateStamp={state.updateStamp}
            onCreateStamp={state.createStamp}
            onDeleteStamp={state.deleteStamp}
            onClose={() => state.setShowStamps(false)}
            showLayers={showLayers}
          />
        )}
        {showLayers && (
          <LayerPanel
            layers={state.layers}
            activeLayerId={state.activeLayerId}
            currentFrame={state.currentFrame}
            onSetActiveLayer={state.setActiveLayerId}
            onAddLayer={handleAddLayer}
            onDeleteLayer={handleDeleteLayer}
            onMoveLayer={handleMoveLayer}
            onRenameLayer={state.renameLayer}
            onToggleVisible={state.toggleLayerVisible}
            onStampToAll={handleStampToAll}
          />
        )}
      </div>

      <Timeline
        layers={state.layers}
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
          layers={state.layers}
          onLoad={handleLoadFromLibrary}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
  )
}
