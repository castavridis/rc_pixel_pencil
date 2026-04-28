import { useState, useRef } from 'react'
import { Layer } from '../types'

interface LayerPanelProps {
  layers: Layer[]
  activeLayerId: string
  currentFrame: number
  onSetActiveLayer: (id: string) => void
  onAddLayer: () => void
  onDeleteLayer: (id: string) => void
  onMoveLayer: (id: string, dir: 'up' | 'down') => void
  onRenameLayer: (id: string, name: string) => void
  onToggleVisible: (id: string) => void
  onStampToAll: (id: string) => void
}

export function LayerPanel({
  layers,
  activeLayerId,
  onSetActiveLayer,
  onAddLayer,
  onDeleteLayer,
  onMoveLayer,
  onRenameLayer,
  onToggleVisible,
  onStampToAll,
}: LayerPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startRename(layer: Layer) {
    setEditingId(layer.id)
    setEditValue(layer.name)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitRename(id: string) {
    const trimmed = editValue.trim()
    if (trimmed) onRenameLayer(id, trimmed)
    setEditingId(null)
  }

  // Layers are stored bottom-to-top internally; display top-to-bottom (reversed)
  const displayed = [...layers].reverse()

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">
        <span className="layer-panel-title">Layers</span>
        <button className="layer-btn" onClick={onAddLayer} title="Add layer">+</button>
      </div>
      <div className="layer-list">
        {displayed.map((layer, displayIdx) => {
          const realIdx = layers.length - 1 - displayIdx
          const isActive = layer.id === activeLayerId
          const isTop = realIdx === layers.length - 1
          const isBottom = realIdx === 0
          return (
            <div
              key={layer.id}
              className={`layer-item${isActive ? ' layer-item--active' : ''}`}
              onClick={() => onSetActiveLayer(layer.id)}
            >
              <button
                className="layer-visibility"
                title={layer.visible ? 'Hide layer' : 'Show layer'}
                onClick={e => { e.stopPropagation(); onToggleVisible(layer.id) }}
              >
                {layer.visible ? '●' : '○'}
              </button>
              {editingId === layer.id ? (
                <input
                  ref={inputRef}
                  className="layer-name-input"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => commitRename(layer.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(layer.id)
                    if (e.key === 'Escape') setEditingId(null)
                    e.stopPropagation()
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span
                  className="layer-name"
                  onDoubleClick={e => { e.stopPropagation(); startRename(layer) }}
                  title="Double-click to rename"
                >
                  {layer.name}
                </span>
              )}
              <div className="layer-actions" onClick={e => e.stopPropagation()}>
                <button
                  className="layer-btn"
                  title="Move up (toward front)"
                  disabled={isTop}
                  onClick={() => onMoveLayer(layer.id, 'up')}
                >↑</button>
                <button
                  className="layer-btn"
                  title="Move down (toward back)"
                  disabled={isBottom}
                  onClick={() => onMoveLayer(layer.id, 'down')}
                >↓</button>
                <button
                  className="layer-btn"
                  title="Stamp current frame to all frames"
                  onClick={() => onStampToAll(layer.id)}
                >⊕</button>
                <button
                  className="layer-btn layer-btn--danger"
                  title="Delete layer"
                  disabled={layers.length <= 1}
                  onClick={() => onDeleteLayer(layer.id)}
                >✕</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
