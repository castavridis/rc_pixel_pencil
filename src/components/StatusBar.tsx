interface StatusBarProps {
  cursorX: number | null
  cursorY: number | null
  zoom: number
  onZoom: (z: number) => void
  onFit: () => void
}

export function StatusBar({ cursorX, cursorY, zoom, onZoom, onFit }: StatusBarProps) {
  return (
    <div className="status-bar">
      <span className="status-cursor">
        {cursorX !== null && cursorY !== null ? `x:${cursorX} y:${cursorY}` : ''}
      </span>
      <div className="status-zoom-controls">
        <input
          type="range"
          min={1}
          max={25}
          step={1}
          value={Math.min(zoom, 25)}
          onChange={e => onZoom(parseInt(e.target.value))}
          className="zoom-slider"
          title="Zoom"
        />
        <span className="zoom-value">{zoom}×</span>
        <div className="status-zoom-btns">
          <button
            className={zoom === 1 ? 'active' : ''}
            onClick={() => onZoom(1)}
            title="1× zoom (key: 1)"
          >1×</button>
          <button
            className={zoom === 10 ? 'active' : ''}
            onClick={() => onZoom(10)}
            title="10× zoom (key: 2)"
          >10×</button>
          <button
            className={zoom === 25 ? 'active' : ''}
            onClick={() => onZoom(25)}
            title="25× zoom (key: 3)"
          >25×</button>
          <button onClick={onFit} title="Fit to window (key: 0)">Fit</button>
        </div>
      </div>
    </div>
  )
}
