import { useState, useEffect, useCallback } from 'react'
import { Layer, Drawing } from '../types'
import {
  isSupabaseConfigured,
  listDrawings,
  saveDrawing,
  updateDrawing,
  deleteDrawing,
  drawingFrameCount,
  drawingLayerCount,
} from '../lib/supabase'

interface LibraryPanelProps {
  layers: Layer[]
  onLoad: (drawing: Drawing) => void
  onClose: () => void
}

export function LibraryPanel({ layers, onLoad, onClose }: LibraryPanelProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveName, setSaveName] = useState('')

  const configured = isSupabaseConfigured()

  const refresh = useCallback(async () => {
    if (!configured) return
    setLoading(true)
    setError(null)
    try {
      const list = await listDrawings()
      setDrawings(list)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [configured])

  useEffect(() => { refresh() }, [refresh])

  const handleSave = async () => {
    if (!saveName.trim()) return
    setSaving(true)
    setError(null)
    try {
      await saveDrawing(saveName.trim(), layers)
      setSaveName('')
      await refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleLoad = (drawing: Drawing) => {
    onLoad(drawing)
    onClose()
  }

  const handleUpdate = async (drawing: Drawing) => {
    if (!confirm(`Overwrite "${drawing.name}" with current animation?`)) return
    setSaving(true)
    setError(null)
    try {
      await updateDrawing(drawing.id, drawing.name, layers)
      await refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (drawing: Drawing) => {
    if (!confirm(`Delete "${drawing.name}"?`)) return
    try {
      await deleteDrawing(drawing.id)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="library-panel">
        <div className="library-header">
          <h2>Cloud Library</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {!configured ? (
          <div className="library-unconfigured">
            <p>Supabase not configured.</p>
            <p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code> file.</p>
          </div>
        ) : (
          <>
            <div className="library-save-row">
              <input
                type="text"
                placeholder="Animation name…"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                disabled={saving}
              />
              <button onClick={handleSave} disabled={saving || !saveName.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

            {error && <div className="library-error">{error}</div>}

            {loading ? (
              <div className="library-loading">Loading…</div>
            ) : drawings.length === 0 ? (
              <div className="library-empty">No saved animations yet.</div>
            ) : (
              <ul className="library-list">
                {drawings.map(d => {
                  const fc = drawingFrameCount(d)
                  const lc = drawingLayerCount(d)
                  return (
                    <li key={d.id} className="library-item">
                      <div className="library-item-info">
                        <span className="library-item-name">{d.name}</span>
                        <span className="library-item-meta">
                          {lc > 1 ? `${lc} layers · ` : ''}{fc} frame{fc !== 1 ? 's' : ''} ·{' '}
                          {new Date(d.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="library-item-actions">
                        <button onClick={() => handleLoad(d)}>Load</button>
                        <button onClick={() => handleUpdate(d)} disabled={saving}>Update</button>
                        <button className="danger" onClick={() => handleDelete(d)}>Del</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
