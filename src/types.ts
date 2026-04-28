export const CANVAS_W = 128
export const CANVAS_H = 64
export const MAX_FRAMES = 24
export const GLOW_PAD = 3

export type PixelBuffer = Uint8Array   // length CANVAS_W * CANVAS_H
export type ToolId = 'pencil' | 'eraser' | 'select' | 'stamp'

export interface Stamp {
  id: string
  name: string
  width: number
  height: number
  buf: Uint8Array  // width * height; 0=transparent, 1=fg, 2=dark
}

export interface BloomSettings {
  enabled: boolean
  intensity: number   // 0.0–1.0
  radius: number
}

export interface ReferenceImageSettings {
  dataUrl: string
  opacity: number    // 0–1
  locked: boolean
  x: number         // canvas-pixel offset (can be negative)
  y: number         // canvas-pixel offset (can be negative)
  scale: number     // multiplier on aspect-ratio-fit size (1.0 = fits canvas)
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  frames: PixelBuffer[]   // one buffer per animation frame
}

export interface SelectionRect {
  x: number
  y: number
  w: number
  h: number
}

export interface FloatingPaste {
  buf: Uint8Array
  x: number
  y: number
  w: number
  h: number
}

export interface Clipboard {
  w: number
  h: number
  buf: Uint8Array
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
