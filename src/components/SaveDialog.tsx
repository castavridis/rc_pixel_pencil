import { useState } from 'react'
import { Drawing, Layer, Guide } from '../types'
import { saveDrawing, updateDrawing, isSupabaseConfigured } from '../lib/supabase'

interface SaveDialogProps {
  currentDrawing: Drawing | null
  layers: Layer[]
  frameGuides: Guide[][]
  onSaved: (drawing: Drawing) => void
  onClose: () => void
}

export function SaveDialog({ currentDrawing, layers, frameGuides, onSaved, onClose }: SaveDialogProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const configured = isSupabaseConfigured()
  const frameCount = layers[0]?.frames.length ?? 1
  const layerCount = layers.length

  const handleSave = async () => {
    if (!configured) return
    setSaving(true)
    setError(null)
    try {
      let drawing: Drawing
      if (currentDrawing) {
        drawing = await updateDrawing(currentDrawing.id, currentDrawing.name, layers, frameGuides)
      } else {
        drawing = await saveDrawing(name.trim(), layers, frameGuides)
      }
      onSaved(drawing)
      onClose()
    } catch (e) {
      setError(String(e))
      setSaving(false)
    }
  }

  const canSave = configured && !saving && (currentDrawing != null || name.trim().length > 0)

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="save-dialog">
        <div className="save-dialog-header">
          <span className="save-dialog-title">Save Animation</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="save-dialog-body">
          {!configured ? (
            <p className="save-dialog-unconfigured">
              Supabase not configured — set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
            </p>
          ) : currentDrawing ? (
            <>
              <div className="save-dialog-name">{currentDrawing.name}</div>
              <div className="save-dialog-meta">
                {layerCount > 1 ? `${layerCount} layers · ` : ''}{frameCount} frame{frameCount !== 1 ? 's' : ''}
              </div>
              <div className="save-dialog-meta">
                Last saved {new Date(currentDrawing.updated_at).toLocaleString()}
              </div>
            </>
          ) : (
            <>
              <input
                className="save-dialog-input"
                type="text"
                placeholder="Animation name…"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave() }}
                disabled={saving}
                autoFocus
              />
              <div className="save-dialog-meta">
                {layerCount > 1 ? `${layerCount} layers · ` : ''}{frameCount} frame{frameCount !== 1 ? 's' : ''}
              </div>
            </>
          )}

          {error && <div className="save-dialog-error">{error}</div>}
        </div>

        <div className="save-dialog-actions">
          <button onClick={onClose} disabled={saving}>Cancel</button>
          <button onClick={handleSave} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
