import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Stamp } from '../types'

interface StampPanelProps {
  stamps: Stamp[]
  activeStampId: string | null
  pixelColor: string
  darkColor: string
  onSelectStamp: (id: string) => void
  onUpdateStamp: (stamp: Stamp) => void
  onCreateStamp: (name: string, width: number, height: number) => void
  onDeleteStamp: (id: string) => void
  onClose: () => void
  showLayers: boolean
}

type View = 'list' | 'editor'
type EditorTool = 'pencil' | 'eraser'

function StampThumbnail({ stamp, pixelColor, darkColor, isActive }: {
  stamp: Stamp
  pixelColor: string
  darkColor: string
  isActive: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, stamp.width, stamp.height)
    for (let y = 0; y < stamp.height; y++) {
      for (let x = 0; x < stamp.width; x++) {
        const v = stamp.buf[y * stamp.width + x]
        if (v === 1) ctx.fillStyle = pixelColor
        else if (v === 2) ctx.fillStyle = darkColor
        else continue
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }, [stamp, pixelColor, darkColor])

  const maxSize = 32
  const scale = Math.min(maxSize / stamp.width, maxSize / stamp.height, 4)
  const cssW = Math.max(8, Math.floor(stamp.width * scale))
  const cssH = Math.max(8, Math.floor(stamp.height * scale))

  return (
    <canvas
      ref={canvasRef}
      width={stamp.width}
      height={stamp.height}
      className="stamp-thumbnail"
      style={{
        width: cssW,
        height: cssH,
        border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
      }}
    />
  )
}

export function StampPanel({
  stamps,
  activeStampId,
  pixelColor,
  darkColor,
  onSelectStamp,
  onUpdateStamp,
  onCreateStamp,
  onDeleteStamp,
  onClose,
  showLayers,
}: StampPanelProps) {
  const [view, setView] = useState<View>('list')
  const [editingStampId, setEditingStampId] = useState<string | null>(null)
  const [editorTool, setEditorTool] = useState<EditorTool>('pencil')
  const [editorBuf, setEditorBuf] = useState<Uint8Array | null>(null)
  const [altDown, setAltDown] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newWidth, setNewWidth] = useState('8')
  const [newHeight, setNewHeight] = useState('8')
  const [formError, setFormError] = useState('')

  const editorCanvasRef = useRef<HTMLCanvasElement>(null)
  const isEditorDrawingRef = useRef(false)
  const altDownRef = useRef(false)

  const editingStamp = editingStampId ? stamps.find(s => s.id === editingStampId) ?? null : null

  // Alt key listeners scoped to this panel
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') { e.preventDefault(); altDownRef.current = true; setAltDown(true) }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') { altDownRef.current = false; setAltDown(false) }
    }
    document.addEventListener('keydown', onDown)
    document.addEventListener('keyup', onUp)
    return () => {
      document.removeEventListener('keydown', onDown)
      document.removeEventListener('keyup', onUp)
    }
  }, [])

  // Init editor buf when entering editor view
  useEffect(() => {
    if (editingStampId) {
      const s = stamps.find(st => st.id === editingStampId)
      if (s) setEditorBuf(s.buf.slice())
    } else {
      setEditorBuf(null)
    }
  }, [editingStampId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw editor canvas when buf changes
  useEffect(() => {
    const canvas = editorCanvasRef.current
    if (!canvas || !editorBuf || !editingStamp) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, editingStamp.width, editingStamp.height)
    for (let y = 0; y < editingStamp.height; y++) {
      for (let x = 0; x < editingStamp.width; x++) {
        const v = editorBuf[y * editingStamp.width + x]
        if (v === 1) ctx.fillStyle = pixelColor
        else if (v === 2) ctx.fillStyle = darkColor
        else continue
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }, [editorBuf, editingStamp, pixelColor, darkColor])

  function stampCoordsFromEvent(e: React.PointerEvent<HTMLCanvasElement>, stamp: Stamp): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.floor(((e.clientX - rect.left) / rect.width) * stamp.width),
      y: Math.floor(((e.clientY - rect.top) / rect.height) * stamp.height),
    }
  }

  const handleEditorPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!editingStamp || !editorBuf) return
    e.currentTarget.setPointerCapture(e.pointerId)
    isEditorDrawingRef.current = true
    const { x, y } = stampCoordsFromEvent(e, editingStamp)
    if (x < 0 || x >= editingStamp.width || y < 0 || y >= editingStamp.height) return
    const next = editorBuf.slice()
    const val = editorTool === 'eraser' ? 0 : (altDownRef.current ? 2 : 1)
    next[y * editingStamp.width + x] = val
    setEditorBuf(next)
    onUpdateStamp({ ...editingStamp, buf: next })
  }, [editingStamp, editorBuf, editorTool, onUpdateStamp])

  const handleEditorPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isEditorDrawingRef.current || !editingStamp || !editorBuf) return
    const { x, y } = stampCoordsFromEvent(e, editingStamp)
    if (x < 0 || x >= editingStamp.width || y < 0 || y >= editingStamp.height) return
    const idx = y * editingStamp.width + x
    const val = editorTool === 'eraser' ? 0 : (altDownRef.current ? 2 : 1)
    if (editorBuf[idx] === val) return
    const next = editorBuf.slice()
    next[idx] = val
    setEditorBuf(next)
    onUpdateStamp({ ...editingStamp, buf: next })
  }, [editingStamp, editorBuf, editorTool, onUpdateStamp])

  const handleEditorPointerUp = useCallback(() => {
    isEditorDrawingRef.current = false
  }, [])

  function handleCreate() {
    const w = parseInt(newWidth, 10)
    const h = parseInt(newHeight, 10)
    if (!newName.trim()) { setFormError('Name is required'); return }
    if (isNaN(w) || w < 1 || w > 128) { setFormError('Width must be 1–128'); return }
    if (isNaN(h) || h < 1 || h > 64) { setFormError('Height must be 1–64'); return }
    setFormError('')
    onCreateStamp(newName.trim(), w, h)
    setNewName(''); setNewWidth('8'); setNewHeight('8'); setShowNewForm(false)
  }

  function handleEdit(id: string) {
    setEditingStampId(id)
    setView('editor')
  }

  function handleBack() {
    setEditingStampId(null)
    setView('list')
  }

  const rightOffset = showLayers ? 236 : 8

  if (view === 'editor' && editingStamp && editorBuf) {
    const maxW = 196
    const maxH = 200
    const scale = Math.min(maxW / editingStamp.width, maxH / editingStamp.height, 8)
    const cssW = Math.max(8, Math.floor(editingStamp.width * scale))
    const cssH = Math.max(8, Math.floor(editingStamp.height * scale))

    return (
      <div className="stamp-panel" style={{ right: rightOffset }}>
        <div className="stamp-panel-header">
          <button className="stamp-back-btn" onClick={handleBack} title="Back to list">←</button>
          <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {editingStamp.name}
          </span>
          <button className="stamp-close-btn" onClick={onClose} title="Close">×</button>
        </div>
        <div className="stamp-editor-tools">
          <button
            className={editorTool === 'pencil' ? 'active' : ''}
            onClick={() => setEditorTool('pencil')}
            title="Pencil"
          >D</button>
          <button
            className={editorTool === 'eraser' ? 'active' : ''}
            onClick={() => setEditorTool('eraser')}
            title="Eraser"
          >E</button>
          <span className="stamp-editor-hint">
            {altDown ? 'Dark pixel' : 'Alt = dark'}
          </span>
        </div>
        <div className="stamp-editor-canvas-wrap">
          <canvas
            ref={editorCanvasRef}
            width={editingStamp.width}
            height={editingStamp.height}
            className="stamp-editor-canvas"
            style={{ width: cssW, height: cssH }}
            onPointerDown={handleEditorPointerDown}
            onPointerMove={handleEditorPointerMove}
            onPointerUp={handleEditorPointerUp}
          />
        </div>
        <div className="stamp-editor-hint" style={{ padding: '4px 8px', borderTop: '1px solid var(--border)' }}>
          {editingStamp.width}×{editingStamp.height}px
        </div>
      </div>
    )
  }

  return (
    <div className="stamp-panel" style={{ right: rightOffset }}>
      <div className="stamp-panel-header">
        <span>Stamps</span>
        <button
          className="stamp-add-btn"
          onClick={() => setShowNewForm(v => !v)}
          title="New stamp"
        >+</button>
        <button className="stamp-close-btn" onClick={onClose} title="Close">×</button>
      </div>

      <div className="stamp-list">
        {stamps.length === 0 && (
          <div style={{ padding: '8px', fontSize: 11, color: 'var(--text-dim)' }}>
            No stamps yet. Click + to create one.
          </div>
        )}
        {stamps.map(stamp => (
          <div
            key={stamp.id}
            className={`stamp-item${stamp.id === activeStampId ? ' stamp-item--active' : ''}`}
            onClick={() => onSelectStamp(stamp.id)}
          >
            <StampThumbnail
              stamp={stamp}
              pixelColor={pixelColor}
              darkColor={darkColor}
              isActive={stamp.id === activeStampId}
            />
            <span className="stamp-name" title={stamp.name}>{stamp.name}</span>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
              {stamp.width}×{stamp.height}
            </span>
            <button
              className="stamp-action-btn"
              onClick={e => { e.stopPropagation(); handleEdit(stamp.id) }}
              title="Edit stamp"
            >✎</button>
            <button
              className="stamp-action-btn"
              onClick={e => { e.stopPropagation(); onDeleteStamp(stamp.id) }}
              title="Delete stamp"
            >×</button>
          </div>
        ))}
      </div>

      {showNewForm && (
        <div className="stamp-new-form">
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            autoFocus
          />
          <div className="stamp-new-form-row">
            <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
              W:
              <input
                type="number"
                min={1}
                max={128}
                value={newWidth}
                onChange={e => setNewWidth(e.target.value)}
                style={{ width: 40 }}
              />
            </label>
            <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
              H:
              <input
                type="number"
                min={1}
                max={64}
                value={newHeight}
                onChange={e => setNewHeight(e.target.value)}
                style={{ width: 40 }}
              />
            </label>
            <button onClick={handleCreate} style={{ fontSize: 10, padding: '1px 6px' }}>Create</button>
          </div>
          {formError && (
            <div style={{ fontSize: 10, color: 'rgba(255,100,100,0.9)' }}>{formError}</div>
          )}
        </div>
      )}
    </div>
  )
}
