import { PixelBuffer, Layer, CANVAS_W, CANVAS_H } from '../types'

const DB_NAME = 'pixel-display-studio'
const STORE_NAME = 'canvas'
const KEY = 'current'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function encodeFrame(frame: PixelBuffer): string {
  return btoa(String.fromCharCode(...frame))
}

function decodeFrame(s: string): PixelBuffer {
  const bin = atob(s)
  const buf = new Uint8Array(CANVAS_W * CANVAS_H)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf
}

interface SavedState {
  version: 2
  layers: { id: string; name: string; visible: boolean; frames: string[] }[]
}

export async function saveToIndexedDB(layers: Layer[]): Promise<void> {
  const db = await openDB()
  const data: SavedState = {
    version: 2,
    layers: layers.map(l => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      frames: l.frames.map(encodeFrame),
    })),
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(data, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadFromIndexedDB(): Promise<Layer[] | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(KEY)
    req.onsuccess = () => {
      const raw = req.result
      if (!raw) { resolve(null); return }

      // v1 migration: old format was a plain string[]
      if (Array.isArray(raw)) {
        if (raw.length === 0) { resolve(null); return }
        resolve([{
          id: crypto.randomUUID(),
          name: 'Layer 1',
          visible: true,
          frames: raw.map(decodeFrame),
        }])
        return
      }

      // v2 format
      if (raw?.version === 2) {
        const state = raw as SavedState
        resolve(state.layers.map(l => ({
          id: l.id,
          name: l.name,
          visible: l.visible,
          frames: l.frames.map(decodeFrame),
        })))
        return
      }

      resolve(null)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function clearIndexedDB(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSave(layers: Layer[]): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveToIndexedDB(layers).catch(console.error)
  }, 250)
}
