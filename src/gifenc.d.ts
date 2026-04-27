declare module 'gifenc' {
  interface GIFEncoderInstance {
    writeFrame(
      indexed: Uint8Array,
      width: number,
      height: number,
      opts: { palette: number[][], delay: number, repeat?: number },
    ): void
    finish(): void
    bytes(): Uint8Array
  }
  export function GIFEncoder(): GIFEncoderInstance
  export function quantizePalette(data: Uint8Array, palette: number[][]): Uint8Array
  export function applyPalette(data: Uint8Array, palette: number[][]): Uint8Array
}
