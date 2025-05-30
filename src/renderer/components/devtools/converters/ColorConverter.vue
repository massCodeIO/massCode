<script setup lang="ts">
import { i18n } from '@/electron'
import { useClipboard } from '@vueuse/core'
import chroma from 'chroma-js'
// @ts-expect-error some
import { colornames } from 'color-name-list'

import { Copy } from 'lucide-vue-next'
// @ts-expect-error some
import nearestColor from 'nearest-color'

const title = computed(() =>
  i18n.t('devtools:converters.colorConverter.label'),
)
const description = computed(() =>
  i18n.t('devtools:converters.colorConverter.description'),
)

const { copy } = useClipboard()

const selectedColor = ref('#154696')

const colors = reactive({
  hex: '',
  rgb: '',
  hsl: '',
  hsv: '',
  cmyk: '',
  oklch: '',
})

const colorName = ref('')

const colorFormats = {
  hex: 'HEX',
  rgb: 'RGB',
  hsl: 'HSL',
  hsv: 'HSV',
  cmyk: 'CMYK',
  oklch: 'OKLCH',
} as const

let isUpdating = false

const activeField = ref<string | null>(null)

const contrast = computed(() => {
  const color = chroma(selectedColor.value)
  const contrast = chroma.contrast('#000', color)

  return contrast
})

function onFieldFocus(type: string) {
  activeField.value = type
}

function onFieldBlur() {
  activeField.value = null
}

function convertColor(color: string) {
  if (isUpdating)
    return

  try {
    const chromaColor = chroma(color)
    const alpha = chromaColor.alpha()

    isUpdating = true

    if (activeField.value !== 'hex') {
      if (color.startsWith('#')) {
        colors.hex = color
      }
      else {
        colors.hex = alpha < 1 ? chromaColor.hex('rgba') : chromaColor.hex()
      }
    }

    if (activeField.value !== 'rgb') {
      colors.rgb
        = alpha < 1
          ? `rgba(${chromaColor.rgb().join(', ')}, ${alpha.toFixed(2)})`
          : chromaColor.css('rgb')
    }

    if (activeField.value !== 'hsl') {
      const [h, s, l] = chromaColor.hsl()
      const hueValue = Number.isNaN(h) ? 0 : Math.round(h)
      const satValue = Math.round(s * 100)
      const lightValue = Math.round(l * 100)

      colors.hsl
        = alpha < 1
          ? `hsla(${hueValue}, ${satValue}%, ${lightValue}%, ${alpha.toFixed(2)})`
          : `hsl(${hueValue}, ${satValue}%, ${lightValue}%)`
    }

    if (activeField.value !== 'hsv') {
      const [h, s, v] = chromaColor.hsv()
      const hueValue = Number.isNaN(h) ? 0 : Math.round(h)
      const satValue = Math.round(s * 100)
      const valValue = Math.round(v * 100)

      if (alpha < 1) {
        colors.hsv = `hsva(${hueValue}, ${satValue}%, ${valValue}%, ${alpha.toFixed(2)})`
      }
      else {
        colors.hsv = `hsv(${hueValue}, ${satValue}%, ${valValue}%)`
      }
    }

    if (activeField.value !== 'cmyk') {
      const [c, m, y, k] = chromaColor.cmyk()
      const cValue = Math.round(c * 100)
      const mValue = Math.round(m * 100)
      const yValue = Math.round(y * 100)
      const kValue = Math.round(k * 100)

      if (alpha < 1) {
        colors.cmyk = `cmyka(${cValue}%, ${mValue}%, ${yValue}%, ${kValue}%, ${alpha.toFixed(2)})`
      }
      else {
        colors.cmyk = `cmyk(${cValue}%, ${mValue}%, ${yValue}%, ${kValue}%)`
      }
    }

    if (activeField.value !== 'oklch') {
      const [lightness, chroma_val, hue] = chromaColor.oklch()
      const lightnessValue = lightness.toFixed(3)
      const chromaValue = chroma_val.toFixed(3)
      const hueValue = Number.isNaN(hue) ? '0' : hue.toFixed(1)

      if (alpha < 1) {
        colors.oklch = `oklch(${lightnessValue} ${chromaValue} ${hueValue} / ${alpha.toFixed(2)})`
      }
      else {
        colors.oklch = `oklch(${lightnessValue} ${chromaValue} ${hueValue})`
      }
    }

    isUpdating = false
  }
  catch (error) {
    console.warn('Ошибка конвертации цвета:', error)
    isUpdating = false
  }
}

function onCopy(type: keyof typeof colorFormats) {
  copy(colors[type])
}

function parseHsv(hsvString: string): chroma.Color | null {
  try {
    const match = hsvString.match(
      /hsva?\((\d+),\s*(\d+)%,\s*(\d+)%(?:,\s*([\d.]+))?\)/,
    )
    if (match) {
      const [, h, s, v, a] = match
      const alpha = a ? Number.parseFloat(a) : 1
      return chroma
        .hsv(
          Number.parseInt(h),
          Number.parseInt(s) / 100,
          Number.parseInt(v) / 100,
        )
        .alpha(alpha)
    }
  }
  catch {}
  return null
}

function parseCmyk(cmykString: string): chroma.Color | null {
  try {
    const match = cmykString.match(
      /cmyka?\((\d+)%,\s*(\d+)%,\s*(\d+)%,\s*(\d+)%(?:,\s*([\d.]+))?\)/,
    )
    if (match) {
      const [, c, m, y, k, a] = match
      const alpha = a ? Number.parseFloat(a) : 1
      return chroma
        .cmyk(
          Number.parseInt(c) / 100,
          Number.parseInt(m) / 100,
          Number.parseInt(y) / 100,
          Number.parseInt(k) / 100,
        )
        .alpha(alpha)
    }
  }
  catch {}
  return null
}

function parseOklch(oklchString: string): chroma.Color | null {
  try {
    const match = oklchString.match(
      /oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/,
    )
    if (match) {
      const [, l, c, h, a] = match
      const alpha = a ? Number.parseFloat(a) : 1
      return chroma
        .oklch(Number.parseFloat(l), Number.parseFloat(c), Number.parseFloat(h))
        .alpha(alpha)
    }
  }
  catch {}
  return null
}

function getColorName(color: string) {
  // @ts-expect-error some
  const colors = colornames.reduce(
    (o, { name, hex }) => Object.assign(o, { [name]: hex }),
    {},
  )
  const nearest = nearestColor.from(colors)

  return nearest(color)?.name || ''
}

watch(
  selectedColor,
  (newColor) => {
    convertColor(newColor)

    colorName.value = getColorName(newColor)
  },
  { immediate: true },
)

watch(
  () => colors.hex,
  (newValue) => {
    if (!isUpdating && newValue && activeField.value === 'hex') {
      const normalizedHex = newValue.startsWith('#')
        ? newValue
        : `#${newValue}`

      if (chroma.valid(normalizedHex)) {
        const chromaColor = chroma(normalizedHex)
        const newHex = chromaColor.hex()

        if (selectedColor.value.toLowerCase() !== newHex.toLowerCase()) {
          selectedColor.value = newHex
        }
        convertColor(normalizedHex)
      }
    }
  },
)

watch(
  () => colors.rgb,
  (newValue) => {
    if (
      !isUpdating
      && newValue
      && chroma.valid(newValue)
      && activeField.value === 'rgb'
    ) {
      const chromaColor = chroma(newValue)
      selectedColor.value = chromaColor.hex()
      convertColor(newValue)
    }
  },
)

watch(
  () => colors.hsl,
  (newValue) => {
    if (
      !isUpdating
      && newValue
      && chroma.valid(newValue)
      && activeField.value === 'hsl'
    ) {
      const chromaColor = chroma(newValue)
      selectedColor.value = chromaColor.hex()
      convertColor(newValue)
    }
  },
)

watch(
  () => colors.hsv,
  (newValue) => {
    if (!isUpdating && newValue && activeField.value === 'hsv') {
      const chromaColor = parseHsv(newValue)
      if (chromaColor) {
        selectedColor.value = chromaColor.hex()
        convertColor(chromaColor.hex())
      }
    }
  },
)

watch(
  () => colors.cmyk,
  (newValue) => {
    if (!isUpdating && newValue && activeField.value === 'cmyk') {
      const chromaColor = parseCmyk(newValue)
      if (chromaColor) {
        selectedColor.value = chromaColor.hex()
        convertColor(chromaColor.hex())
      }
    }
  },
)

watch(
  () => colors.oklch,
  (newValue) => {
    if (!isUpdating && newValue && activeField.value === 'oklch') {
      const chromaColor = parseOklch(newValue)
      if (chromaColor) {
        selectedColor.value = chromaColor.hex()
        convertColor(chromaColor.hex())
      }
    }
  },
)
</script>

<template>
  <div class="space-y-6">
    <UiHeading
      :title="title"
      :description="description"
    />
    <div class="flex items-start gap-8">
      <div>
        <UiColorPicker
          v-model="selectedColor"
          class="w-64 shrink-0"
          :show-input="false"
        />
        <div
          class="mt-3 flex h-32 w-full items-center justify-center rounded text-lg"
          :style="{ backgroundColor: selectedColor }"
        >
          <span :class="contrast > 6 ? 'text-black' : 'text-white'">
            {{ colorName }}
          </span>
        </div>
        <div class="mt-2 w-full text-center">
          <UiButton
            size="md"
            @click="copy(colorName)"
          >
            {{ i18n.t("button.copy") }}
          </UiButton>
        </div>
      </div>

      <div
        class="grid w-full grid-cols-[max-content_1fr_max-content] items-center gap-4"
      >
        <template
          v-for="[type, label] in Object.entries(colorFormats)"
          :key="type"
        >
          <div class="text-text-secondary text-sm font-medium">
            {{ label }}
          </div>
          <UiInput
            v-model="colors[type as keyof typeof colors]"
            @focus="onFieldFocus(type)"
            @blur="onFieldBlur"
          />
          <UiButton
            variant="icon"
            size="md"
            @click="onCopy(type as keyof typeof colorFormats)"
          >
            <Copy class="h-3 w-3" />
          </UiButton>
        </template>
      </div>
    </div>
  </div>
</template>
