import { PixelBuffer, Layer, Drawing, CANVAS_W, CANVAS_H } from '../types'
import { generateId } from './uuid'

const SUPABASE_URL: string | undefined = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export function getDeviceId(): string {
  let id = localStorage.getItem('pds_device_id')
  if (!id) {
    id = generateId()
    localStorage.setItem('pds_device_id', id)
  }
  return id
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

const LAYERS_PREFIX = '__layers__'

function encodeLayersForSupabase(layers: Layer[]): string[] {
  const data = layers.map(l => ({
    id: l.id,
    name: l.name,
    visible: l.visible,
    frames: l.frames.map(encodeFrame),
  }))
  const json = JSON.stringify(data)
  const utf8 = new TextEncoder().encode(json)
  let binary = ''
  utf8.forEach(b => { binary += String.fromCharCode(b) })
  return [`${LAYERS_PREFIX}${btoa(binary)}`]
}

function decodeLayersFromSupabase(encoded: string): Layer[] {
  const binary = atob(encoded.slice(LAYERS_PREFIX.length))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const json = new TextDecoder().decode(bytes)
  const data = JSON.parse(json) as { id: string; name: string; visible: boolean; frames: string[] }[]
  return data.map(l => ({
    id: l.id,
    name: l.name,
    visible: l.visible,
    frames: l.frames.map(decodeFrame),
  }))
}

function isMultiLayer(drawing: Drawing): boolean {
  return drawing.frames.length === 1 && drawing.frames[0].startsWith(LAYERS_PREFIX)
}

export function drawingToLayers(drawing: Drawing): Layer[] {
  if (isMultiLayer(drawing)) {
    try { return decodeLayersFromSupabase(drawing.frames[0]) } catch {}
  }
  return [{
    id: generateId(),
    name: 'Layer 1',
    visible: true,
    frames: drawing.frames.map(decodeFrame),
  }]
}

export function drawingFrameCount(drawing: Drawing): number {
  if (isMultiLayer(drawing)) {
    try {
      const binary = atob(drawing.frames[0].slice(LAYERS_PREFIX.length))
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const data = JSON.parse(new TextDecoder().decode(bytes)) as { frames: string[] }[]
      return data[0]?.frames.length ?? 1
    } catch {}
  }
  return drawing.frames.length
}

export function drawingLayerCount(drawing: Drawing): number {
  if (isMultiLayer(drawing)) {
    try {
      const binary = atob(drawing.frames[0].slice(LAYERS_PREFIX.length))
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const data = JSON.parse(new TextDecoder().decode(bytes)) as unknown[]
      return data.length
    } catch {}
  }
  return 1
}

async function supabaseFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured')
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  return fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers ?? {}),
    },
  })
}

export async function listDrawings(): Promise<Drawing[]> {
  const deviceId = getDeviceId()
  const res = await supabaseFetch(
    `drawings?device_id=eq.${encodeURIComponent(deviceId)}&order=updated_at.desc`,
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function saveDrawing(name: string, layers: Layer[]): Promise<Drawing> {
  const deviceId = getDeviceId()
  const res = await supabaseFetch('drawings', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, name, frames: encodeLayersForSupabase(layers) }),
  })
  if (!res.ok) throw new Error(await res.text())
  const rows = await res.json() as Drawing[]
  return rows[0]
}

export async function updateDrawing(id: string, name: string, layers: Layer[]): Promise<Drawing> {
  const res = await supabaseFetch(`drawings?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, frames: encodeLayersForSupabase(layers), updated_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(await res.text())
  const rows = await res.json() as Drawing[]
  return rows[0]
}

export async function deleteDrawing(id: string): Promise<void> {
  const res = await supabaseFetch(`drawings?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(await res.text())
}
