export const CANVAS_W = 128
export const CANVAS_H = 64
export const MAX_FRAMES = 24

export type PixelBuffer = Uint8Array   // length CANVAS_W * CANVAS_H
export type ToolId = 'pencil' | 'eraser'

export interface BloomSettings {
  enabled: boolean
  intensity: number   // 0.0–1.0
  radius: number      // 2–20
}

// One animation — stored in Supabase and IndexedDB
export interface Animation {
  frames: PixelBuffer[]   // 1–24 frames
}

export interface Guide {
  id: string
  axis: 'h' | 'v'
  position: number  // canvas pixels: 0–(CANVAS_W-1) for v, 0–(CANVAS_H-1) for h
}

// Supabase row
export interface Drawing {
  id: string
  device_id: string
  name: string
  frames: string[]        // base64-encoded PixelBuffers, one per frame
  created_at: string
  updated_at: string
}
