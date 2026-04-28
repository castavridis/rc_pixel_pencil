import { PixelBuffer, Layer, Stamp, CANVAS_W, CANVAS_H } from '../types'

const DB_NAME = 'pixel-display-studio'
const DB_VERSION = 2
const STORE_NAME = 'canvas'
const STAMPS_STORE = 'stamps'
const KEY = 'current'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = req.result
      const oldVersion = event.oldVersion
      if (oldVersion < 1) db.createObjectStore(STORE_NAME)
      if (oldVersion < 2) db.createObjectStore(STAMPS_STORE)
      db.onversionchange = () => db.close()
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => console.warn('DB upgrade blocked by another tab')
  })
}

function encodeFrame(frame: PixelBuffer): string {
  let binary = ''
  for (let i = 0; i < frame.length; i++) binary += String.fromCharCode(frame[i])
  return btoa(binary)
}

function decodeFrame(s: string): PixelBuffer {
  const bin = atob(s)
  const buf = new Uint8Array(CANVAS_W * CANVAS_H)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf
}

function encodeBuf(buf: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i])
  return btoa(binary)
}

function decodeBuf(s: string, length: number): Uint8Array {
  const bin = atob(s)
  const buf = new Uint8Array(length)
  for (let i = 0; i < Math.min(bin.length, length); i++) buf[i] = bin.charCodeAt(i)
  return buf
}

interface SavedState {
  version: 2
  activeLayerId: string
  layers: { id: string; name: string; visible: boolean; frames: string[] }[]
}

interface StoredStamp {
  id: string
  name: string
  width: number
  height: number
  buf: string
}

export interface LoadedState {
  layers: Layer[]
  activeLayerId: string | null
}

export async function saveToIndexedDB(layers: Layer[], activeLayerId: string): Promise<void> {
  const db = await openDB()
  const data: SavedState = {
    version: 2,
    activeLayerId,
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

export async function loadFromIndexedDB(): Promise<LoadedState | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(KEY)
    req.onsuccess = () => {
      try {
        const raw = req.result
        if (!raw) { resolve(null); return }

        // v1 migration: old format was a plain string[]
        if (Array.isArray(raw)) {
          if (raw.length === 0) { resolve(null); return }
          resolve({
            layers: [{
              id: crypto.randomUUID(),
              name: 'Layer 1',
              visible: true,
              frames: raw.map(decodeFrame),
            }],
            activeLayerId: null,
          })
          return
        }

        // v2 format
        if (raw?.version === 2) {
          const state = raw as SavedState
          resolve({
            layers: state.layers.map(l => ({
              id: l.id,
              name: l.name,
              visible: l.visible,
              frames: l.frames.map(decodeFrame),
            })),
            activeLayerId: state.activeLayerId ?? null,
          })
          return
        }

        resolve(null)
      } catch (e) {
        resolve(null)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

export async function saveStamps(stamps: Stamp[]): Promise<void> {
  const db = await openDB()
  const data: StoredStamp[] = stamps.map(s => ({
    id: s.id,
    name: s.name,
    width: s.width,
    height: s.height,
    buf: encodeBuf(s.buf),
  }))
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STAMPS_STORE, 'readwrite')
    tx.objectStore(STAMPS_STORE).put(data, 'all')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadStamps(): Promise<Stamp[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STAMPS_STORE, 'readonly')
    const req = tx.objectStore(STAMPS_STORE).get('all')
    req.onsuccess = () => {
      try {
        const raw = req.result as StoredStamp[] | undefined
        if (!raw) { resolve([]); return }
        resolve(raw.map(s => ({
          id: s.id,
          name: s.name,
          width: s.width,
          height: s.height,
          buf: decodeBuf(s.buf, s.width * s.height),
        })))
      } catch (e) {
        resolve([])
      }
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
let pendingLayers: Layer[] | null = null
let pendingActiveId: string | null = null

export function debouncedSave(layers: Layer[], activeLayerId: string): void {
  pendingLayers = layers
  pendingActiveId = activeLayerId
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    pendingLayers = null
    pendingActiveId = null
    saveToIndexedDB(layers, activeLayerId).catch(console.error)
  }, 250)
}

export function flushSave(): void {
  if (!pendingLayers || !pendingActiveId) return
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  const layers = pendingLayers
  const activeLayerId = pendingActiveId
  pendingLayers = null
  pendingActiveId = null
  saveToIndexedDB(layers, activeLayerId).catch(console.error)
}

let stampSaveTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSaveStamps(stamps: Stamp[]): void {
  if (stampSaveTimer) clearTimeout(stampSaveTimer)
  stampSaveTimer = setTimeout(() => {
    stampSaveTimer = null
    saveStamps(stamps).catch(console.error)
  }, 250)
}
