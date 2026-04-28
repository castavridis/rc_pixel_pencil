import { useCallback, useRef } from 'react'
import { PixelBuffer, Layer } from '../types'

const MAX_HISTORY = 100

type PixelEntry = { kind: 'pixel'; layerId: string; frameIdx: number; snapshot: PixelBuffer }
type LayersEntry = { kind: 'layers'; snapshot: Layer[]; activeId: string }
type HistoryEntry = PixelEntry | LayersEntry

function deepCopyLayers(layers: Layer[]): Layer[] {
  return layers.map(l => ({ ...l, frames: l.frames.map(f => f.slice() as PixelBuffer) }))
}

export function useHistory() {
  const undoRef = useRef<HistoryEntry[]>([])
  const redoRef = useRef<HistoryEntry[]>([])

  const pushPixel = useCallback((layerId: string, frameIdx: number, snapshot: PixelBuffer) => {
    undoRef.current.push({ kind: 'pixel', layerId, frameIdx, snapshot: snapshot.slice() as PixelBuffer })
    if (undoRef.current.length > MAX_HISTORY) undoRef.current.shift()
    redoRef.current = []
  }, [])

  const pushLayers = useCallback((layers: Layer[], activeId: string) => {
    undoRef.current.push({ kind: 'layers', snapshot: deepCopyLayers(layers), activeId })
    if (undoRef.current.length > MAX_HISTORY) undoRef.current.shift()
    redoRef.current = []
  }, [])

  const undo = useCallback((
    getCurrentPixel: (layerId: string, frameIdx: number) => PixelBuffer | null,
    getCurrentLayers: () => Layer[],
    getCurrentActiveId: () => string,
  ): HistoryEntry | null => {
    if (undoRef.current.length === 0) return null
    const entry = undoRef.current.pop()!

    if (entry.kind === 'pixel') {
      const current = getCurrentPixel(entry.layerId, entry.frameIdx)
      if (current === null) return null
      redoRef.current.push({ kind: 'pixel', layerId: entry.layerId, frameIdx: entry.frameIdx, snapshot: current.slice() as PixelBuffer })
    } else {
      redoRef.current.push({ kind: 'layers', snapshot: deepCopyLayers(getCurrentLayers()), activeId: getCurrentActiveId() })
    }

    return entry
  }, [])

  const redo = useCallback((
    getCurrentPixel: (layerId: string, frameIdx: number) => PixelBuffer | null,
    getCurrentLayers: () => Layer[],
    getCurrentActiveId: () => string,
  ): HistoryEntry | null => {
    if (redoRef.current.length === 0) return null
    const entry = redoRef.current.pop()!

    if (entry.kind === 'pixel') {
      const current = getCurrentPixel(entry.layerId, entry.frameIdx)
      if (current === null) return null
      undoRef.current.push({ kind: 'pixel', layerId: entry.layerId, frameIdx: entry.frameIdx, snapshot: current.slice() as PixelBuffer })
    } else {
      undoRef.current.push({ kind: 'layers', snapshot: deepCopyLayers(getCurrentLayers()), activeId: getCurrentActiveId() })
    }

    return entry
  }, [])

  const canUndo = useCallback(() => undoRef.current.length > 0, [])
  const canRedo = useCallback(() => redoRef.current.length > 0, [])

  const clearAll = useCallback(() => {
    undoRef.current = []
    redoRef.current = []
  }, [])

  return { pushPixel, pushLayers, undo, redo, canUndo, canRedo, clearAll }
}
