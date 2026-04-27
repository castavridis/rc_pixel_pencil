import { PixelBuffer, Drawing, CANVAS_W, CANVAS_H } from '../types'

const SUPABASE_URL: string | undefined = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export function getDeviceId(): string {
  let id = localStorage.getItem('pds_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('pds_device_id', id)
  }
  return id
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

export async function saveDrawing(name: string, frames: PixelBuffer[]): Promise<Drawing> {
  const deviceId = getDeviceId()
  const encoded = frames.map(encodeFrame)
  const res = await supabaseFetch('drawings', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, name, frames: encoded }),
  })
  if (!res.ok) throw new Error(await res.text())
  const rows = await res.json() as Drawing[]
  return rows[0]
}

export async function updateDrawing(id: string, name: string, frames: PixelBuffer[]): Promise<Drawing> {
  const encoded = frames.map(encodeFrame)
  const res = await supabaseFetch(`drawings?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, frames: encoded, updated_at: new Date().toISOString() }),
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

export function drawingToFrames(drawing: Drawing): PixelBuffer[] {
  return drawing.frames.map(decodeFrame)
}
