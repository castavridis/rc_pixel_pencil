import { PixelBuffer, CANVAS_W, CANVAS_H } from '../types'

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

export async function saveToIndexedDB(frames: PixelBuffer[]): Promise<void> {
  const db = await openDB()
  const encoded = frames.map(encodeFrame)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(encoded, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadFromIndexedDB(): Promise<PixelBuffer[] | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(KEY)
    req.onsuccess = () => {
      const val = req.result as string[] | undefined
      if (!val || !Array.isArray(val) || val.length === 0) {
        resolve(null)
        return
      }
      resolve(val.map(decodeFrame))
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

// Debounced save helper
let saveTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSave(frames: PixelBuffer[]): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveToIndexedDB(frames).catch(console.error)
  }, 250)
}
