<script setup lang="ts">
interface Props {
  offsetBottom?: number
  isActive: boolean
}

interface Point {
  x: number
  y: number
  timestamp: number
}

interface Stroke {
  points: Point[]
  endedAt?: number
}

const props = withDefaults(defineProps<Props>(), {
  offsetBottom: 40,
})

const canvasRef = ref<HTMLCanvasElement>()
// Canvas state does not participate in Vue rendering.
let strokes: Stroke[] = []
let currentStroke: Stroke | null = null
let previousInput: Point | null = null
let filteredPoint: Point | null = null
let activePointerId: number | null = null
let animationId: number | null = null

const FADE_DURATION = 3000
const LINE_WIDTH = 3
const LINE_COLOR = '#ff4444'

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas)
    return

  const width = window.innerWidth
  const height = Math.max(0, window.innerHeight - props.offsetBottom)
  const ratio = window.devicePixelRatio
  canvas.width = width * ratio
  canvas.height = height * ratio
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }
  drawCanvas()
}

function getCanvasPoint(event: PointerEvent): Point {
  const rect = canvasRef.value!.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    timestamp: event.timeStamp,
  }
}

function appendPoint(event: PointerEvent) {
  if (!currentStroke || !previousInput || !filteredPoint)
    return

  const point = getCanvasPoint(event)
  const elapsed = Math.max(1, point.timestamp - previousInput.timestamp)
  const speed
    = Math.hypot(point.x - previousInput.x, point.y - previousInput.y) / elapsed
  // Suppress slow jitter without making fast gestures feel sluggish.
  const timeConstant = 18 / (1 + speed * 3)
  const alpha = 1 - Math.exp(-elapsed / timeConstant)
  filteredPoint = {
    x: filteredPoint.x + (point.x - filteredPoint.x) * alpha,
    y: filteredPoint.y + (point.y - filteredPoint.y) * alpha,
    timestamp: point.timestamp,
  }
  previousInput = point

  const last = currentStroke.points[currentStroke.points.length - 1]
  if (Math.hypot(filteredPoint.x - last.x, filteredPoint.y - last.y) >= 0.5)
    currentStroke.points.push(filteredPoint)
}

function onPointerDown(event: PointerEvent) {
  if (!props.isActive || event.button !== 0 || activePointerId !== null)
    return

  canvasRef.value!.setPointerCapture(event.pointerId)
  activePointerId = event.pointerId
  const point = getCanvasPoint(event)
  previousInput = point
  filteredPoint = point
  currentStroke = { points: [point] }
  strokes.push(currentStroke)
  startAnimation()
}

function onPointerMove(event: PointerEvent) {
  if (!props.isActive || event.pointerId !== activePointerId)
    return

  const samples = event.getCoalescedEvents?.() ?? []
  for (const sample of samples.length ? samples : [event]) appendPoint(sample)
}

function stopDrawing() {
  if (currentStroke)
    currentStroke.endedAt = performance.now()

  const pointerId = activePointerId
  activePointerId = null
  currentStroke = null
  previousInput = null
  filteredPoint = null
  if (pointerId !== null && canvasRef.value?.hasPointerCapture(pointerId))
    canvasRef.value.releasePointerCapture(pointerId)
}

function onPointerEnd(event: PointerEvent) {
  if (event.pointerId !== activePointerId)
    return
  if (event.type === 'pointerup')
    appendPoint(event)
  stopDrawing()
}

function drawCanvas(now = performance.now()) {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx)
    return

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = LINE_COLOR
  ctx.fillStyle = LINE_COLOR
  ctx.lineWidth = LINE_WIDTH

  for (const stroke of strokes) {
    ctx.globalAlpha
      = stroke.endedAt === undefined
        ? 1
        : Math.max(0, 1 - (now - stroke.endedAt) / FADE_DURATION)
    const points = stroke.points
    ctx.beginPath()
    if (points.length === 1) {
      ctx.arc(points[0].x, points[0].y, LINE_WIDTH / 2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }

    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length - 1; i++) {
      const point = points[i]
      const next = points[i + 1]
      ctx.quadraticCurveTo(
        point.x,
        point.y,
        (point.x + next.x) / 2,
        (point.y + next.y) / 2,
      )
    }
    const last = points[points.length - 1]
    ctx.quadraticCurveTo(last.x, last.y, last.x, last.y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function updateStrokes(now: number) {
  animationId = null
  strokes = strokes.filter(
    stroke =>
      stroke.endedAt === undefined || now - stroke.endedAt < FADE_DURATION,
  )
  drawCanvas(now)
  if (strokes.length)
    startAnimation()
}

function startAnimation() {
  if (animationId === null)
    animationId = requestAnimationFrame(updateStrokes)
}

function clearStrokes() {
  stopDrawing()
  strokes = []
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  drawCanvas()
}

onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  window.addEventListener('blur', stopDrawing)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('blur', stopDrawing)
  clearStrokes()
})

watch(
  () => props.isActive,
  async (active) => {
    if (!active) {
      clearStrokes()
      return
    }
    await nextTick()
    if (props.isActive)
      resizeCanvas()
  },
)

watch(() => props.offsetBottom, resizeCanvas)
</script>

<template>
  <canvas
    v-if="isActive"
    ref="canvasRef"
    class="pointer-events-auto fixed top-0 left-0 z-40 w-screen cursor-crosshair touch-none"
    @pointerdown.prevent="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @lostpointercapture="onPointerEnd"
  />
</template>
