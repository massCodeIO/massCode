<script setup lang="ts">
import { cn } from '@/utils'
import chroma from 'chroma-js'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

interface Props {
  class?: string
  disabled?: boolean
  showInput?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showInput: true,
})

const model = defineModel<string>({ default: '#ff0000' })

const colorAreaRef = ref<HTMLElement>()
const hueSliderRef = ref<HTMLElement>()
const alphaSliderRef = ref<HTMLElement>()

const isDraggingColor = ref(false)
const isDraggingHue = ref(false)
const isDraggingAlpha = ref(false)

const hsv = ref({ h: 0, s: 100, v: 100 })
const alpha = ref(1)

const colorPosition = ref({ x: 100, y: 0 })
const huePosition = ref(0)
const alphaPosition = ref(100)

const isUpdatingFromModel = ref(false)

const currentChroma = computed(() => {
  try {
    return chroma
      .hsv(hsv.value.h, hsv.value.s / 100, hsv.value.v / 100)
      .alpha(alpha.value)
  }
  catch {
    return chroma('#000000')
  }
})

const currentRgb = computed(() => {
  const [r, g, b] = currentChroma.value.rgb()
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) }
})

const currentHex = computed(() => {
  const chromaColor = currentChroma.value
  return chromaColor.alpha() < 1 ? chromaColor.hex('rgba') : chromaColor.hex()
})

const pureHueColor = computed(() => {
  try {
    return chroma.hsv(hsv.value.h, 1, 1).hex()
  }
  catch {
    return '#ff0000'
  }
})

function handleColorAreaMouseDown(event: MouseEvent) {
  if (props.disabled)
    return

  event.preventDefault()

  isDraggingColor.value = true
  updateColorFromPosition(event)

  document.addEventListener('mousemove', handleColorAreaMouseMove)
  document.addEventListener('mouseup', handleColorAreaMouseUp)
}

function handleColorAreaMouseMove(event: MouseEvent) {
  if (!isDraggingColor.value)
    return

  event.preventDefault()

  updateColorFromPosition(event)
}

function handleColorAreaMouseUp() {
  isDraggingColor.value = false
  document.removeEventListener('mousemove', handleColorAreaMouseMove)
  document.removeEventListener('mouseup', handleColorAreaMouseUp)
}

function updateColorFromPosition(event: MouseEvent) {
  if (!colorAreaRef.value)
    return

  const rect = colorAreaRef.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top))

  colorPosition.value = { x, y }

  const newS = (x / rect.width) * 100
  const newV = 100 - (y / rect.height) * 100
  hsv.value.s = Math.round(newS)
  hsv.value.v = Math.round(newV)
}

function handleHueMouseDown(event: MouseEvent) {
  if (props.disabled)
    return

  event.preventDefault()

  isDraggingHue.value = true
  updateHueFromPosition(event)

  document.addEventListener('mousemove', handleHueMouseMove)
  document.addEventListener('mouseup', handleHueMouseUp)
}

function handleHueMouseMove(event: MouseEvent) {
  if (!isDraggingHue.value)
    return

  event.preventDefault()

  updateHueFromPosition(event)
}

function handleHueMouseUp() {
  isDraggingHue.value = false
  document.removeEventListener('mousemove', handleHueMouseMove)
  document.removeEventListener('mouseup', handleHueMouseUp)
}

function updateHueFromPosition(event: MouseEvent) {
  if (!hueSliderRef.value)
    return

  const rect = hueSliderRef.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))

  huePosition.value = x
  hsv.value.h = Math.min(359.99, (x / rect.width) * 360)
}

function handleAlphaMouseDown(event: MouseEvent) {
  if (props.disabled)
    return

  event.preventDefault()

  isDraggingAlpha.value = true
  updateAlphaFromPosition(event)

  document.addEventListener('mousemove', handleAlphaMouseMove)
  document.addEventListener('mouseup', handleAlphaMouseUp)
}

function handleAlphaMouseMove(event: MouseEvent) {
  if (!isDraggingAlpha.value)
    return

  event.preventDefault()

  updateAlphaFromPosition(event)
}

function handleAlphaMouseUp() {
  isDraggingAlpha.value = false
  document.removeEventListener('mousemove', handleAlphaMouseMove)
  document.removeEventListener('mouseup', handleAlphaMouseUp)
}

function updateAlphaFromPosition(event: MouseEvent) {
  if (!alphaSliderRef.value)
    return

  const rect = alphaSliderRef.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))

  alphaPosition.value = x
  alpha.value = x / rect.width
}

function updatePositions() {
  if (!colorAreaRef.value || !hueSliderRef.value || !alphaSliderRef.value)
    return

  const colorRect = colorAreaRef.value.getBoundingClientRect()
  const hueRect = hueSliderRef.value.getBoundingClientRect()
  const alphaRect = alphaSliderRef.value.getBoundingClientRect()

  colorPosition.value = {
    x: (hsv.value.s / 100) * colorRect.width,
    y: ((100 - hsv.value.v) / 100) * colorRect.height,
  }

  huePosition.value = (hsv.value.h / 360) * hueRect.width
  alphaPosition.value = alpha.value * alphaRect.width
}

function initializeFromModel() {
  isUpdatingFromModel.value = true

  try {
    const chromaColor = chroma(model.value)
    const [h, s, v] = chromaColor.hsv()

    hsv.value = {
      h: Number.isNaN(h) ? 0 : h,
      s: Math.round(s * 100),
      v: Math.round(v * 100),
    }
    alpha.value = chromaColor.alpha()

    nextTick(() => {
      updatePositions()
      nextTick(() => {
        isUpdatingFromModel.value = false
      })
    })
  }
  catch {
    hsv.value = { h: 0, s: 0, v: 0 }
    alpha.value = 1
    isUpdatingFromModel.value = false
  }
}

watch(
  () => model.value,
  () => {
    if (!isUpdatingFromModel.value) {
      initializeFromModel()
    }
  },
  { immediate: true },
)

watch([currentHex, alpha], () => {
  if (!isUpdatingFromModel.value) {
    const newHex = currentHex.value

    try {
      const currentColor = chroma(model.value)
      const newColor = chroma(newHex)

      const [r1, g1, b1] = currentColor.rgb()
      const [r2, g2, b2] = newColor.rgb()
      const a1 = currentColor.alpha()
      const a2 = newColor.alpha()

      const colorChanged
        = Math.abs(r1 - r2) > 1
          || Math.abs(g1 - g2) > 1
          || Math.abs(b1 - b2) > 1
          || Math.abs(a1 - a2) > 0.01

      if (colorChanged) {
        isUpdatingFromModel.value = true
        model.value = newHex
        nextTick(() => {
          isUpdatingFromModel.value = false
        })
      }
    }
    catch {
      isUpdatingFromModel.value = true
      model.value = newHex
      nextTick(() => {
        isUpdatingFromModel.value = false
      })
    }
  }
})

watch(
  [hsv, alpha],
  () => {
    if (!isUpdatingFromModel.value) {
      nextTick(() => {
        updatePositions()
      })
    }
  },
  { deep: true },
)

onMounted(() => {
  initializeFromModel()
})
</script>

<template>
  <div :class="cn('space-y-2', props.class)">
    <div class="relative">
      <div
        ref="colorAreaRef"
        class="border-border relative h-48 w-full cursor-crosshair overflow-hidden rounded-md border select-none"
        :class="{ 'cursor-not-allowed opacity-50': disabled }"
        :style="{ backgroundColor: pureHueColor }"
        @mousedown="handleColorAreaMouseDown"
      >
        <div
          class="absolute inset-0 bg-gradient-to-r from-white to-transparent"
        />
        <div
          class="absolute inset-0 bg-gradient-to-b from-transparent to-black"
        />
      </div>
      <div
        class="pointer-events-none absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 transform rounded-full border-2 border-white shadow-md"
        :style="{
          left: `${colorPosition.x}px`,
          top: `${colorPosition.y}px`,
          backgroundColor: currentHex,
        }"
      />
    </div>
    <div class="relative py-1">
      <div
        ref="hueSliderRef"
        class="border-border relative h-4 w-full cursor-pointer rounded-md border select-none"
        :class="{ 'cursor-not-allowed opacity-50': disabled }"
        style="
          background: linear-gradient(
            to right,
            #ff0000 0%,
            #ffff00 17%,
            #00ff00 33%,
            #00ffff 50%,
            #0000ff 67%,
            #ff00ff 83%,
            #ff0000 100%
          );
        "
        @mousedown="handleHueMouseDown"
      />
      <div
        class="pointer-events-none absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 transform rounded-full border-2 border-white shadow-md"
        :style="{
          left: `${huePosition}px`,
          backgroundColor: pureHueColor,
        }"
      />
    </div>
    <div class="relative py-1">
      <div
        class="absolute inset-x-0 top-1 bottom-1 rounded-md"
        style="
          background-image:
            linear-gradient(45deg, #ccc 25%, transparent 25%),
            linear-gradient(-45deg, #ccc 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #ccc 75%),
            linear-gradient(-45deg, transparent 75%, #ccc 75%);
          background-size: 8px 8px;
          background-position:
            0 0,
            0 4px,
            4px -4px,
            -4px 0px;
        "
      />
      <div
        ref="alphaSliderRef"
        class="border-border relative h-4 w-full cursor-pointer rounded-md border select-none"
        :class="{ 'cursor-not-allowed opacity-50': disabled }"
        :style="{
          background: `linear-gradient(to right, transparent 0%, ${chroma.rgb(currentRgb.r, currentRgb.g, currentRgb.b).hex()} 100%)`,
        }"
        @mousedown="handleAlphaMouseDown"
      />
      <div
        class="pointer-events-none absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 transform rounded-full border-2 border-white shadow-md"
        :style="{
          left: `${alphaPosition}px`,
          backgroundColor: currentHex,
        }"
      />
    </div>
    <div
      v-if="showInput"
      class="flex items-center gap-3"
    >
      <div
        class="border-border relative h-[27px] w-[27px] shrink-0 overflow-hidden rounded-md border"
      >
        <div
          class="absolute inset-0"
          style="
            background-image:
              linear-gradient(45deg, #ccc 25%, transparent 25%),
              linear-gradient(-45deg, #ccc 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #ccc 75%),
              linear-gradient(-45deg, transparent 75%, #ccc 75%);
            background-size: 4px 4px;
            background-position:
              0 0,
              0 2px,
              2px -2px,
              -2px 0px;
          "
        />
        <div
          class="absolute inset-0"
          :style="{ backgroundColor: currentHex }"
        />
      </div>
      <div class="w-full">
        <UiInput
          v-model="model"
          type="text"
          :disabled="disabled"
          placeholder="#000000"
        />
      </div>
    </div>
  </div>
</template>
