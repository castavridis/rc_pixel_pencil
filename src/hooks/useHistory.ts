import { useCallback, useRef } from 'react'
import { PixelBuffer, MAX_FRAMES } from '../types'

const MAX_HISTORY = 100

interface FrameStack {
  undo: PixelBuffer[]
  redo: PixelBuffer[]
}

function emptyStack(): FrameStack {
  return { undo: [], redo: [] }
}

export function useHistory() {
  // One stack per frame slot
  const stacksRef = useRef<FrameStack[]>(
    Array.from({ length: MAX_FRAMES }, emptyStack),
  )

  const pushHistory = useCallback((frameIndex: number, buffer: PixelBuffer) => {
    const stack = stacksRef.current[frameIndex]
    stack.undo.push(buffer.slice() as PixelBuffer)
    if (stack.undo.length > MAX_HISTORY) stack.undo.shift()
    stack.redo = []
  }, [])

  const undo = useCallback(
    (frameIndex: number, current: PixelBuffer): PixelBuffer | null => {
      const stack = stacksRef.current[frameIndex]
      if (stack.undo.length === 0) return null
      const prev = stack.undo.pop()!
      stack.redo.push(current.slice() as PixelBuffer)
      return prev
    },
    [],
  )

  const redo = useCallback(
    (frameIndex: number, current: PixelBuffer): PixelBuffer | null => {
      const stack = stacksRef.current[frameIndex]
      if (stack.redo.length === 0) return null
      const next = stack.redo.pop()!
      stack.undo.push(current.slice() as PixelBuffer)
      return next
    },
    [],
  )

  const initStack = useCallback((frameIndex: number) => {
    stacksRef.current[frameIndex] = emptyStack()
  }, [])

  const deleteStack = useCallback((frameIndex: number) => {
    stacksRef.current.splice(frameIndex, 1)
    stacksRef.current.push(emptyStack())
  }, [])

  const clearAll = useCallback(() => {
    stacksRef.current = Array.from({ length: MAX_FRAMES }, emptyStack)
  }, [])

  const canUndo = useCallback((frameIndex: number) =>
    stacksRef.current[frameIndex].undo.length > 0, [])

  const canRedo = useCallback((frameIndex: number) =>
    stacksRef.current[frameIndex].redo.length > 0, [])

  return { pushHistory, undo, redo, initStack, deleteStack, clearAll, canUndo, canRedo }
}
