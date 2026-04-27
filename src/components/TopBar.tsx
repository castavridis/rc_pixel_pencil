import { useRef } from 'react'
import { ToolId, BloomSettings, PixelBuffer } from '../types'
import { downloadSVG, downloadFramesSVGZip, importSVG } from '../lib/svg'
import { exportAnimatedGIF, exportPNG } from '../lib/gif'

const ERASER_SIZES = [1, 2, 4, 8] as const

interface TopBarProps {
  tool: ToolId
  setTool: (t: ToolId) => void
  eraserSize: 1 | 2 | 4 | 8
  setEraserSize: (s: 1 | 2 | 4 | 8) => void
  bloom: BloomSettings
  setBloom: (b: BloomSettings) => void
  showGrid: boolean
  setShowGrid: (v: boolean) => void
  onionEnabled: boolean
  setOnionEnabled: (v: boolean) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  frames: PixelBuffer[]
  currentFrame: number
  onImportFrame: (buf: PixelBuffer) => void
  onNew: () => void
  onOpenLibrary: () => void
  onAddGuide: (axis: 'h' | 'v') => void
  pixelsCanvasRef: React.RefObject<HTMLCanvasElement | null>
  bloomCanvasRef: React.RefObject<HTMLCanvasElement | null>
  referenceImage: { dataUrl: string; opacity: number } | null
  onSetReferenceImage: (img: { dataUrl: string; opacity: number } | null) => void
}

export function TopBar({
  tool,
  setTool,
  eraserSize,
  setEraserSize,
  bloom,
  setBloom,
  showGrid,
  setShowGrid,
  onionEnabled,
  setOnionEnabled,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  frames,
  currentFrame,
  onImportFrame,
  onNew,
  onOpenLibrary,
  onAddGuide,
  pixelsCanvasRef,
  bloomCanvasRef,
  referenceImage,
  onSetReferenceImage,
}: TopBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const refImageInputRef = useRef<HTMLInputElement>(null)

  const handleImportSVG = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const buf = await importSVG(text)
      onImportFrame(buf)
    } catch (err) {
      alert(`Import failed: ${err}`)
    }
    e.target.value = ''
  }

  const handleExportSVG = () => {
    downloadSVG(frames[currentFrame], `frame-${String(currentFrame + 1).padStart(2, '0')}.svg`)
  }

  const handleExportAllSVG = () => {
    downloadFramesSVGZip(frames)
  }

  const handleExportGIF = async () => {
    try {
      await exportAnimatedGIF(frames, 12)
    } catch (err) {
      alert(`GIF export failed: ${err}`)
    }
  }

  const handleRefImageImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      onSetReferenceImage({ dataUrl: ev.target!.result as string, opacity: 0.4 })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleExportPNG = () => {
    const pc = pixelsCanvasRef.current
    const bc = bloomCanvasRef.current
    if (!pc || !bc) return
    exportPNG(pc, bc)
  }

  return (
    <div className="topbar">
      {/* Row 1: tools + undo/redo + toggles + bloom + guides */}
      <div className="topbar-row">
        <div className="topbar-group">
          <button
            className={tool === 'pencil' ? 'active' : ''}
            onClick={() => setTool('pencil')}
            title="Draw (D)"
          >D</button>
          <button
            className={tool === 'eraser' ? 'active' : ''}
            onClick={() => setTool('eraser')}
            title="Eraser (E)"
          >E</button>
          {tool === 'eraser' && (
            <span className="eraser-sizes">
              {ERASER_SIZES.map(s => (
                <button
                  key={s}
                  className={eraserSize === s ? 'active' : ''}
                  onClick={() => setEraserSize(s)}
                  title={`Eraser size ${s}×${s}`}
                >{s}</button>
              ))}
            </span>
          )}
        </div>

        <div className="topbar-group">
          <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">Undo</button>
          <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">Redo</button>
        </div>

        <div className="topbar-group">
          <button
            className={showGrid ? 'active' : ''}
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle grid (G)"
          >G</button>
          <button
            className={onionEnabled ? 'active' : ''}
            onClick={() => setOnionEnabled(!onionEnabled)}
            title="Toggle onion skinning (O)"
          >O</button>
        </div>

        <div className="topbar-group">
          <button onClick={() => onAddGuide('h')} title="Add horizontal guide">H Guide</button>
          <button onClick={() => onAddGuide('v')} title="Add vertical guide">V Guide</button>
        </div>

        <div className="topbar-group topbar-bloom">
          <button
            className={bloom.enabled ? 'active' : ''}
            onClick={() => setBloom({ ...bloom, enabled: !bloom.enabled })}
            title="Toggle bloom (B)"
          >Bloom</button>
          <label title="Bloom intensity">
            I:
            <input
              type="range"
              min={0}
              max={5}
              step={0.05}
              value={bloom.intensity}
              onChange={e => setBloom({ ...bloom, intensity: parseFloat(e.target.value) })}
              disabled={!bloom.enabled}
            />
          </label>
          <label title="Bloom radius">
            R:
            <input
              type="range"
              min={2}
              max={100}
              step={1}
              value={bloom.radius}
              onChange={e => setBloom({ ...bloom, radius: parseInt(e.target.value) })}
              disabled={!bloom.enabled}
            />
          </label>
        </div>
      </div>

      {/* Row 2: file actions */}
      <div className="topbar-row">
        <div className="topbar-group">
          <button onClick={onNew} title="New canvas">New</button>
          <button onClick={() => fileInputRef.current?.click()} title="Import SVG into current frame">
            Import SVG
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,image/svg+xml"
            style={{ display: 'none' }}
            onChange={handleImportSVG}
          />
          <button onClick={handleExportSVG} title="Export current frame as SVG">
            Export SVG
          </button>
          <button onClick={handleExportAllSVG} title="Export all frames as SVG ZIP">
            Export SVG (all)
          </button>
          <button onClick={handleExportGIF} title="Export animated GIF">
            Export GIF
          </button>
          <button onClick={handleExportPNG} title="Export current frame as PNG">
            Export PNG
          </button>
          <button onClick={onOpenLibrary} title="Open cloud library">
            Library
          </button>
          <button onClick={() => refImageInputRef.current?.click()} title="Load reference image overlay">
            Ref Image
          </button>
          <input
            ref={refImageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleRefImageImport}
          />
          {referenceImage && (
            <>
              <label title="Reference image opacity">
                Opacity:
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={referenceImage.opacity}
                  onChange={e => onSetReferenceImage({ ...referenceImage, opacity: parseFloat(e.target.value) })}
                />
              </label>
              <button onClick={() => onSetReferenceImage(null)} title="Clear reference image">×</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
