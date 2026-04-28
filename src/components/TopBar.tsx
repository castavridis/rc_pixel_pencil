import { useRef } from 'react'
import { ToolId, BloomSettings, PixelBuffer, Layer, ReferenceImageSettings, SelectionRect, Clipboard, FloatingPaste, CANVAS_W, CANVAS_H } from '../types'
import { downloadSVG, downloadFramesSVGZip, importSVG } from '../lib/svg'
import { exportAnimatedGIF, exportPNG } from '../lib/gif'

const ERASER_SIZES = [1, 2, 4, 8] as const
const PENCIL_SIZES = [1, 2, 4, 8] as const

interface TopBarProps {
  tool: ToolId
  setTool: (t: ToolId) => void
  eraserSize: 1 | 2 | 4 | 8
  setEraserSize: (s: 1 | 2 | 4 | 8) => void
  pencilSize: 1 | 2 | 4 | 8
  setPencilSize: (s: 1 | 2 | 4 | 8) => void
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
  layers: Layer[]
  currentFrame: number
  onImportFrame: (buf: PixelBuffer) => void
  onNew: () => void
  onOpenLibrary: () => void
  onAddGuide: (axis: 'h' | 'v') => void
  guidesLocked: boolean
  onSetGuidesLocked: (v: boolean) => void
  showLayers: boolean
  onToggleLayers: () => void
  showPreview: boolean
  onTogglePreview: () => void
  showStamps: boolean
  onToggleStamps: () => void
  activeStampName: string | null
  darkColor: string
  onSetDarkColor: (v: string) => void
  pixelsCanvasRef: React.RefObject<HTMLCanvasElement | null>
  bloomCanvasRef: React.RefObject<HTMLCanvasElement | null>
  referenceImage: ReferenceImageSettings | null
  onSetReferenceImage: (img: ReferenceImageSettings | null) => void
  canvasColor: string
  onSetCanvasColor: (v: string) => void
  pixelColor: string
  onSetPixelColor: (v: string) => void
  selection: SelectionRect | null
  clipboard: Clipboard | null
  floatingPaste: FloatingPaste | null
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onCommitPaste: () => void
  onCancelPaste: () => void
  smartErase: boolean
  onSetSmartErase: (v: boolean) => void
  mirrorX: boolean
  onSetMirrorX: (v: boolean) => void
  altDown: boolean
  onToggleAltDown: () => void
}

export function TopBar({
  tool,
  setTool,
  eraserSize,
  setEraserSize,
  pencilSize,
  setPencilSize,
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
  layers,
  currentFrame,
  onImportFrame,
  onNew,
  onOpenLibrary,
  onAddGuide,
  guidesLocked,
  onSetGuidesLocked,
  showLayers,
  onToggleLayers,
  showPreview,
  onTogglePreview,
  showStamps,
  onToggleStamps,
  activeStampName,
  darkColor,
  onSetDarkColor,
  pixelsCanvasRef,
  bloomCanvasRef,
  referenceImage,
  onSetReferenceImage,
  canvasColor,
  onSetCanvasColor,
  pixelColor,
  onSetPixelColor,
  selection,
  clipboard,
  floatingPaste,
  onCopy,
  onCut,
  onPaste,
  onCommitPaste,
  onCancelPaste,
  smartErase,
  onSetSmartErase,
  mirrorX,
  onSetMirrorX,
  altDown,
  onToggleAltDown,
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
    downloadSVG(layers, currentFrame, `frame-${String(currentFrame + 1).padStart(2, '0')}.svg`)
  }

  const handleExportAllSVG = () => {
    downloadFramesSVGZip(layers)
  }

  const handleExportGIF = async () => {
    try {
      await exportAnimatedGIF(layers, 12, pixelColor, darkColor, canvasColor)
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
      {/* Row 1: tools + undo/redo + toggles + glow + guides */}
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
          <button
            className={tool === 'select' ? 'active' : ''}
            onClick={() => setTool('select')}
            title="Select (S)"
          >S</button>
          <button
            className={tool === 'stamp' ? 'active' : ''}
            onClick={() => setTool('stamp')}
            title="Stamp tool (T)"
          >T</button>
          {tool === 'pencil' && (
            <button
              className={smartErase ? 'active' : ''}
              onClick={() => onSetSmartErase(!smartErase)}
              title="Smart erase: tap a filled pixel to erase it"
            >Smart&#8209;E</button>
          )}
          {tool === 'pencil' && (
            <button
              className={altDown ? 'active' : ''}
              onClick={onToggleAltDown}
              title="Draw with dark color (Alt)"
            >Dk</button>
          )}
          {tool === 'select' && (
            <>
              <button onClick={onCopy} disabled={!selection} title="Copy selection (Ctrl+C)">Copy</button>
              <button onClick={onCut} disabled={!selection} title="Cut selection (Ctrl+X)">Cut</button>
              <button onClick={onPaste} disabled={!clipboard} title="Paste (Ctrl+V)">Paste</button>
              {floatingPaste && (
                <>
                  <button onClick={onCommitPaste} title="Commit paste (Enter)">&#10003;</button>
                  <button onClick={onCancelPaste} title="Cancel paste (Esc)">&#10005;</button>
                </>
              )}
            </>
          )}
          {tool === 'stamp' && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)', alignSelf: 'center' }}>
              {activeStampName ?? 'no stamp'}
            </span>
          )}
          {tool === 'pencil' && (
            <span className="pencil-sizes">
              {PENCIL_SIZES.map(s => (
                <button
                  key={s}
                  className={pencilSize === s ? 'active' : ''}
                  onClick={() => setPencilSize(s)}
                  title={`Brush size ${s}×${s}`}
                >{s}</button>
              ))}
            </span>
          )}
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
          <button
            className={mirrorX ? 'active' : ''}
            onClick={() => onSetMirrorX(!mirrorX)}
            title="Mirror drawing horizontally (M)"
          >MX</button>
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
            title="Toggle glow (B)"
          >Glow</button>
          <label title="Glow intensity">
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
          <label title="Glow radius">
            R:
            <input
              type="range"
              min={1}
              max={5}
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
          <label title="Dark pixel color (Alt+draw)">
            Dk:
            <input
              type="color"
              value={darkColor}
              onChange={e => onSetDarkColor(e.target.value)}
              style={{ width: 28, height: 20, padding: 1, border: 'none', cursor: 'pointer', background: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Row 2: file actions + layers toggle */}
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
          <button
            className={showLayers ? 'active' : ''}
            onClick={onToggleLayers}
            title="Toggle layer panel"
          >Layers</button>
          <button
            className={showStamps ? 'active' : ''}
            onClick={onToggleStamps}
            title="Toggle stamp panel"
          >Stamps</button>
          <button
            className={showPreview ? 'active' : ''}
            onClick={onTogglePreview}
            title="Toggle 1x preview"
          >1x</button>
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
