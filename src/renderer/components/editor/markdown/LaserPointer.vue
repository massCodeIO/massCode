<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

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
  id: string
  points: Point[]
  opacity: number
}

const props = withDefaults(defineProps<Props>(), {
  offsetBottom: 40,
})

const canvasRef = ref<HTMLCanvasElement>()
const isDrawing = ref(false)
const strokes = ref<Stroke[]>([])
let animationId: number | null = null
let currentStroke: Stroke | null = null

const FADE_DURATION = 3000
const LINE_WIDTH = 3
const LINE_COLOR = '#ff4444'
const SMOOTHING_FACTOR = 0.3

function resizeCanvas() {
  if (!canvasRef.value)
    return

  const canvas = canvasRef.value

  canvas.width = window.innerWidth * window.devicePixelRatio
  canvas.height
    = (window.innerHeight - props.offsetBottom) * window.devicePixelRatio

  // Устанавливаем CSS размеры
  canvas.style.width = `${window.innerWidth}px`
  canvas.style.height = `${window.innerHeight - props.offsetBottom}px`

  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }
}

function getCanvasPoint(event: MouseEvent): Point {
  if (!canvasRef.value)
    return { x: 0, y: 0, timestamp: Date.now() }

  return {
    x: event.clientX,
    y: event.clientY,
    timestamp: Date.now(),
  }
}

function startDrawing(event: MouseEvent) {
  if (!props.isActive)
    return

  isDrawing.value = true
  const point = getCanvasPoint(event)

  currentStroke = {
    id: Date.now().toString(),
    points: [point],
    opacity: 1,
  }

  strokes.value.push(currentStroke)
}

function draw(event: MouseEvent) {
  if (!isDrawing.value || !currentStroke || !props.isActive)
    return

  const point = getCanvasPoint(event)
  currentStroke.points.push(point)

  drawCanvas()
}

function stopDrawing() {
  isDrawing.value = false
  currentStroke = null
}

function drawCanvas() {
  if (!canvasRef.value)
    return

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  strokes.value.forEach((stroke) => {
    if (stroke.points.length < 2)
      return

    ctx.globalAlpha = stroke.opacity
    ctx.strokeStyle = LINE_COLOR
    ctx.lineWidth = LINE_WIDTH

    ctx.beginPath()

    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)

    for (let i = 1; i < stroke.points.length - 1; i++) {
      const currentPoint = stroke.points[i]
      const nextPoint = stroke.points[i + 1]

      const controlX
        = currentPoint.x + (nextPoint.x - currentPoint.x) * SMOOTHING_FACTOR
      const controlY
        = currentPoint.y + (nextPoint.y - currentPoint.y) * SMOOTHING_FACTOR

      ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, controlX, controlY)
    }

    if (stroke.points.length > 1) {
      const lastPoint = stroke.points[stroke.points.length - 1]
      ctx.lineTo(lastPoint.x, lastPoint.y)
    }

    ctx.stroke()
  })

  ctx.globalAlpha = 1
}

function updateStrokes() {
  const now = Date.now()

  strokes.value = strokes.value.filter((stroke) => {
    if (stroke.points.length === 0)
      return false

    // Вычисляем возраст самой старой точки в штрихе
    const oldestPoint = Math.min(...stroke.points.map(p => p.timestamp))
    const age = now - oldestPoint

    if (age > FADE_DURATION) {
      return false // Удаляем полностью исчезнувшие штрихи
    }

    // Обновляем прозрачность на основе возраста
    stroke.opacity = Math.max(0, 1 - age / FADE_DURATION)

    return true
  })

  drawCanvas()

  // Продолжаем анимацию если есть штрихи
  if (strokes.value.length > 0) {
    animationId = requestAnimationFrame(updateStrokes)
  }
  else {
    animationId = null
  }
}

function startAnimation() {
  if (animationId === null) {
    animationId = requestAnimationFrame(updateStrokes)
  }
}

function clearStrokes() {
  strokes.value = []
  if (canvasRef.value) {
    const ctx = canvasRef.value.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
    }
  }
}

function onMouseDown(event: MouseEvent) {
  startDrawing(event)
  startAnimation()
}

function onMouseMove(event: MouseEvent) {
  draw(event)
}

function onMouseUp() {
  stopDrawing()
}

// Обработчики событий касания для мобильных устройств
function onTouchStart(event: TouchEvent) {
  event.preventDefault()
  const touch = event.touches[0]
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY,
  })
  onMouseDown(mouseEvent)
}

function onTouchMove(event: TouchEvent) {
  event.preventDefault()
  const touch = event.touches[0]
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY,
  })
  onMouseMove(mouseEvent)
}

function onTouchEnd(event: TouchEvent) {
  event.preventDefault()
  onMouseUp()
}

onMounted(() => {
  window.addEventListener('resize', resizeCanvas)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})

// Очищаем штрихи когда указка выключается и принудительно ресайзим при включении
watch(
  () => props.isActive,
  (newValue) => {
    if (!newValue) {
      clearStrokes()
      isDrawing.value = false
      currentStroke = null
    }
    else {
      nextTick(() => {
        resizeCanvas()
      })
    }
  },
)
</script>

<template>
  <canvas
    v-if="isActive"
    v-show="isActive"
    ref="canvasRef"
    class="pointer-events-auto fixed top-0 left-0 z-40 w-screen cursor-crosshair"
    :class="`h-[calc(100vh-${props.offsetBottom}px)]`"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  />
</template>
