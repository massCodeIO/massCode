import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import LaserPointer from '../LaserPointer.vue'

vi.mock('vue', async importOriginal => ({
  ...(await importOriginal<typeof import('vue')>()),
  useSSRContext: () => ({}),
}))

interface PointerSetup {
  canvasRef: { value: unknown }
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerEnd: (event: PointerEvent) => void
}

function pointer(x: number, y: number, timeStamp = 0, extra = {}) {
  return {
    clientX: x,
    clientY: y,
    timeStamp,
    pointerId: 1,
    button: 0,
    ...extra,
  } as PointerEvent
}

function createHarness() {
  const mounted: Array<() => void> = []
  const unmounted: Array<() => void> = []
  const frames = new Map<number, FrameRequestCallback>()
  let frameId = 0
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('watch', vi.fn())
  vi.stubGlobal('onMounted', (fn: () => void) => mounted.push(fn))
  vi.stubGlobal('onUnmounted', (fn: () => void) => unmounted.push(fn))
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    frames.set(++frameId, fn)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('window', {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 2,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  const ctx = {
    globalAlpha: 1,
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    stroke: vi.fn(),
  }
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
  }
  const component = LaserPointer as unknown as {
    setup: (props: unknown, context: unknown) => PointerSetup
  }
  const setup = component.setup(
    { isActive: true, offsetBottom: 40 },
    { expose: vi.fn() },
  )
  setup.canvasRef.value = canvas
  mounted.forEach(fn => fn())

  return {
    setup,
    ctx,
    canvas,
    frames,
    unmount: () => unmounted.forEach(fn => fn()),
    frame: (now: number) => {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach(fn => fn(now))
    },
  }
}

describe('laser pointer', () => {
  beforeEach(() => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('initializes an already active canvas at device resolution', () => {
    const { canvas, ctx } = createHarness()
    expect(canvas.width).toBe(1600)
    expect(canvas.height).toBe(1120)
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
  })

  it('draws a dot for a click and renders movement only on animation frames', () => {
    const { setup, ctx, frame } = createHarness()
    setup.onPointerDown(pointer(10, 20))
    expect(ctx.arc).not.toHaveBeenCalled()
    frame(0)
    expect(ctx.arc).toHaveBeenCalledWith(10, 20, 1.5, 0, Math.PI * 2)
    setup.onPointerMove(pointer(30, 40, 16))
    expect(ctx.stroke).not.toHaveBeenCalled()
    frame(16)
    expect(ctx.stroke).toHaveBeenCalledOnce()
  })

  it('filters movement and joins curves at the midpoint of adjacent points', () => {
    const { setup, ctx, frame } = createHarness()
    setup.onPointerDown(pointer(0, 0))
    setup.onPointerMove(pointer(10, 10, 16))
    setup.onPointerMove(pointer(20, 0, 32))
    frame(32)
    const [first, end] = ctx.quadraticCurveTo.mock.calls
    expect(first[0]).toBeGreaterThan(0)
    expect(first[0]).toBeLessThan(10)
    expect(first[2]).toBeCloseTo((first[0] + end[0]) / 2)
    expect(first[3]).toBeCloseTo((first[1] + end[1]) / 2)
    expect(end[0]).toBe(end[2])
    expect(end[1]).toBe(end[3])
  })

  it('uses coalesced samples with an empty-list fallback', () => {
    const { setup, ctx, frame } = createHarness()
    setup.onPointerDown(pointer(0, 0))
    setup.onPointerMove(
      pointer(30, 0, 30, {
        getCoalescedEvents: () => [
          pointer(10, 10, 10),
          pointer(20, 0, 20),
          pointer(30, 0, 30),
        ],
      }),
    )
    frame(30)
    expect(ctx.quadraticCurveTo).toHaveBeenCalledTimes(3)
    ctx.quadraticCurveTo.mockClear()
    setup.onPointerMove(pointer(40, 10, 40, { getCoalescedEvents: () => [] }))
    frame(40)
    expect(ctx.quadraticCurveTo).toHaveBeenCalledTimes(4)
  })

  it('keeps long active gestures visible and fades only after release', () => {
    const { setup, ctx, frame, frames } = createHarness()
    setup.onPointerDown(pointer(0, 0))
    setup.onPointerMove(pointer(10, 10, 16))
    frame(4000)
    expect(ctx.stroke).toHaveBeenCalledOnce()
    vi.mocked(performance.now).mockReturnValue(4000)
    setup.onPointerEnd(pointer(10, 10, 4000, { type: 'pointerup' }))
    ctx.stroke.mockImplementation(() =>
      expect(ctx.globalAlpha).toBeCloseTo(0.5),
    )
    frame(5500)
    expect(ctx.stroke).toHaveBeenCalledTimes(2)
    frame(7000)
    expect(ctx.stroke).toHaveBeenCalledTimes(2)
    expect(frames.size).toBe(0)
  })

  it('ignores other pointers and right clicks, and handles cancellation', () => {
    const { setup, canvas, frames } = createHarness()
    setup.onPointerDown(pointer(0, 0, 0, { button: 2 }))
    expect(frames.size).toBe(0)
    setup.onPointerDown(pointer(0, 0))
    setup.onPointerDown(pointer(10, 10, 0, { pointerId: 2 }))
    setup.onPointerEnd(pointer(10, 10, 0, { pointerId: 2 }))
    expect(canvas.releasePointerCapture).not.toHaveBeenCalled()
    setup.onPointerEnd(pointer(0, 0, 0, { type: 'pointercancel' }))
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(canvas.setPointerCapture).toHaveBeenCalledOnce()
  })

  it('releases capture and cancels the animation on unmount', () => {
    const { setup, canvas, frames, unmount } = createHarness()
    setup.onPointerDown(pointer(0, 0))
    unmount()
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(frames.size).toBe(0)
  })
})
