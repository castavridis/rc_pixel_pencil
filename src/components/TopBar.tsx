import { useRef } from 'react'
import { ToolId, BloomSettings, PixelBuffer, ReferenceImageSettings, CANVAS_W, CANVAS_H } from '../types'
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
  guidesLocked: boolean
  onSetGuidesLocked: (v: boolean) => void
  pixelsCanvasRef: React.RefObject<HTMLCanvasElement | null>
  bloomCanvasRef: React.RefObject<HTMLCanvasElement | null>
  referenceImage: ReferenceImageSettings | null
  onSetReferenceImage: (img: ReferenceImageSettings | null) => void
  canvasColor: string
  onSetCanvasColor: (v: string) => void
  pixelColor: string
  onSetPixelColor: (v: string) => void
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
  guidesLocked,
  onSetGuidesLocked,
  pixelsCanvasRef,
  bloomCanvasRef,
  referenceImage,
  onSetReferenceImage,
  canvasColor,
  onSetCanvasColor,
  pixelColor,
  onSetPixelColor,
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
      const dataUrl = ev.target!.result as string
      const img = new Image()
      img.onload = () => {
        const aspect = img.naturalWidth / img.naturalHeight
        const cAspect = CANVAS_W / CANVAS_H
        let fitW: number, fitH: number
        if (aspect > cAspect) { fitW = CANVAS_W; fitH = CANVAS_W / aspect }
        else { fitH = CANVAS_H; fitW = CANVAS_H * aspect }
        onSetReferenceImage({
          dataUrl,
          opacity: 0.4,
          locked: false,
          x: Math.round((CANVAS_W - fitW) / 2),
          y: Math.round((CANVAS_H - fitH) / 2),
          scale: 1,
        })
      }
      img.src = dataUrl
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
          <button
            className={guidesLocked ? 'active' : ''}
            onClick={() => onSetGuidesLocked(!guidesLocked)}
            title="Lock guides (prevents moving/deleting)"
          >Lock</button>
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
              max={500}
              step={1}
              value={bloom.radius}
              onChange={e => setBloom({ ...bloom, radius: parseInt(e.target.value) })}
              disabled={!bloom.enabled}
            />
          </label>
        </div>

        <div className="topbar-group">
          <label title="Canvas background color">
            BG:
            <input
              type="color"
              value={canvasColor}
              onChange={e => onSetCanvasColor(e.target.value)}
              style={{ width: 28, height: 20, padding: 1, border: 'none', cursor: 'pointer', background: 'none' }}
            />
          </label>
          <label title="Pixel color">
            Px:
            <input
              type="color"
              value={pixelColor}
              onChange={e => onSetPixelColor(e.target.value)}
              style={{ width: 28, height: 20, padding: 1, border: 'none', cursor: 'pointer', background: 'none' }}
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
              <label title="Reference image scale">
                Scale:
                <input
                  type="range"
                  min={0.05}
                  max={5}
                  step={0.05}
                  value={referenceImage.scale}
                  onChange={e => onSetReferenceImage({ ...referenceImage, scale: parseFloat(e.target.value) })}
                  disabled={referenceImage.locked}
                />
              </label>
              <button
                className={referenceImage.locked ? 'active' : ''}
                onClick={() => onSetReferenceImage({ ...referenceImage, locked: !referenceImage.locked })}
                title={referenceImage.locked ? 'Unlock reference image' : 'Lock reference image'}
              >{referenceImage.locked ? 'Locked' : 'Lock'}</button>
              <button onClick={() => onSetReferenceImage(null)} title="Clear reference image">×</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
