<script setup lang="ts">
import type { Language } from '../types'
import { Switch } from '@/components/ui/shadcn/switch'
import { useEditor, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { useCssVar } from '@vueuse/core'
import CodeMirror from 'codemirror'
import domToImage from 'dom-to-image'
import interact from 'interactjs'
import { FileDown } from 'lucide-vue-next'

const { selectedSnippetContent, selectedSnippet } = useSnippets()

const MIN_WIDTH = 520
const MAX_WIDTH = 920

const { settings, cursorPosition: _cursorPosition } = useEditor()

const activeBackground = ref('disco')

const isDarkPreview = ref(true)
const isBackground = ref(true)

const editorRef = useTemplateRef('editorRef')
const containerRef = useTemplateRef('containerRef')
const backgroundRef = useTemplateRef('backgroundRef')

const width = ref(MIN_WIDTH)

const isDragging = ref(false)
const showDimensions = ref(false)

const colorBg = useCssVar('--color-code-bg-preview', backgroundRef.value, {
  initialValue: 'oklch(24.78% 0 0)',
})

const colorBorder = useCssVar('--color-code-bg-border', backgroundRef.value, {
  initialValue: 'oklch(30% 0 0)',
})

let editor: CodeMirror.Editor | null = null

function init() {
  editor = CodeMirror(editorRef.value!, {
    value: selectedSnippetContent.value?.value || ' ',
    mode: selectedSnippetContent.value?.language || 'plain_text',
    theme: 'oceanic-next',
    lineWrapping: settings.wrap,
    lineNumbers: true,
    matchBrackets: settings.matchBrackets,
    scrollbarStyle: 'null',
    readOnly: true,
  })

  // Отключаем выделение текста
  editor.on('mousedown', (e) => {
    // @ts-expect-error some
    e.preventDefault()
  })

  watch(selectedSnippetContent, (v) => {
    nextTick(() => {
      setValue(v?.value || '')
    })
  })

  watch(selectedSnippetContent, (v) => {
    nextTick(() => {
      if (!v)
        return
      setLanguage(v.language as Language)
    })
  })

  watch(isDarkPreview, (v) => {
    if (v) {
      editor?.setOption('theme', 'oceanic-next')
    }
    else {
      editor?.setOption('theme', 'neo')
    }
    colorBg.value = isDarkPreview.value
      ? 'oklch(24.78% 0 0)'
      : 'oklch(100% 0 0)'
    colorBorder.value = isDarkPreview.value
      ? 'oklch(30% 0 0)'
      : 'oklch(90% 0 0)'
  })

  nextTick(() => {
    initInteract()
  })
}

function initInteract() {
  if (!backgroundRef.value)
    return

  let containerMaxWidth = MAX_WIDTH

  width.value = MIN_WIDTH

  if (containerRef.value) {
    containerMaxWidth = Math.min(
      MAX_WIDTH,
      containerRef.value.clientWidth - 56,
    )
  }

  interact(backgroundRef.value).resizable({
    edges: { left: true, right: true, bottom: false, top: false },
    invert: 'reposition',
    inertia: false,
    modifiers: [
      interact.modifiers.restrictSize({
        min: { width: MIN_WIDTH, height: 0 },
        max: { width: containerMaxWidth, height: 5000 },
      }),
    ],
    listeners: {
      start() {
        isDragging.value = true
        showDimensions.value = true
      },
      move(event) {
        // Учитываем эффект центрирования, удваивая изменение размера
        let newWidth = width.value + event.deltaRect.width * 2

        newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, containerMaxWidth))
        width.value = newWidth
      },
      end() {
        isDragging.value = false
        showDimensions.value = false
      },
    },
  })
}

function setValue(value: string) {
  if (!editor)
    return

  const cursor = editor.getCursor()

  editor?.setValue(value)

  if (cursor)
    editor.setCursor(cursor)
}

function setLanguage(language: Language) {
  editor?.setOption('mode', language)
}

async function onSave(format: 'png' | 'svg') {
  let data = ''

  const filter = (node: Node) => {
    const el = node as HTMLElement
    return (
      el.dataset?.controls !== 'resize'
      && el.dataset?.background !== 'transparent'
    )
  }

  if (format === 'png') {
    data = await domToImage.toPng(backgroundRef.value!, { filter })
  }

  if (format === 'svg') {
    data = await domToImage.toSvg(backgroundRef.value!)
  }

  const a = document.createElement('a')

  a.href = data
  a.download = `${selectedSnippet.value?.name}.${format}`
  a.click()
}

onMounted(() => {
  init()
})
</script>

<template>
  <div
    ref="containerRef"
    data-editor-code-image
    class="grid grid-rows-[auto_1fr] overflow-scroll"
  >
    <EditorHeaderTool>
      <div class="flex w-full items-center justify-between px-2">
        <div class="flex items-center gap-2 select-none">
          <div class="flex items-center gap-2">
            <Switch
              :checked="isDarkPreview"
              @update:checked="isDarkPreview = $event"
            />
            <span
              class="text-sm"
              @click="isDarkPreview = !isDarkPreview"
            >
              {{ i18n.t("button.darkMode") }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Switch
              :checked="isBackground"
              @update:checked="isBackground = $event"
            />
            <span
              class="text-sm"
              @click="isBackground = !isBackground"
            >
              {{ i18n.t("button.background") }}
            </span>
          </div>
          <EditorCodeImageBackgroundSwitch v-model:active="activeBackground" />
        </div>
        <div>
          <UiActionButton
            type="iconText"
            :tooltip="`${i18n.t('button.saveAs')} PNG`"
            @click="onSave('png')"
          >
            <div class="flex items-center gap-1">
              PNG <FileDown class="h-3 w-3" />
            </div>
          </UiActionButton>
          <UiActionButton
            type="iconText"
            :tooltip="`${i18n.t('button.saveAs')} SVG`"
            @click="onSave('svg')"
          >
            <div class="flex items-center gap-1">
              SVG <FileDown class="h-3 w-3" />
            </div>
          </UiActionButton>
        </div>
      </div>
    </EditorHeaderTool>
    <PerfectScrollbar class="notebook-grid">
      <div class="relative flex justify-center p-9">
        <div
          ref="backgroundRef"
          data-background="main"
          class="relative p-5"
          :class="{
            'bg-transparent': !isBackground,
            'gradient-disco': isBackground && activeBackground === 'disco',
            'gradient-salad': isBackground && activeBackground === 'salad',
            'gradient-cucumber':
              isBackground && activeBackground === 'cucumber',
            'gradient-aqua': isBackground && activeBackground === 'aqua',
            'gradient-lovely': isBackground && activeBackground === 'lovely',
          }"
          :style="{ width: `${width}px` }"
        >
          <div
            data-frame
            class="relative z-10 rounded-xl border p-3 shadow-lg"
            :style="{
              backgroundColor: colorBg,
              borderColor: colorBorder,
            }"
          >
            <div data-controls="traffic-light">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="54"
                height="14"
                viewBox="0 0 54 14"
              >
                <g
                  fill="none"
                  fill-rule="evenodd"
                  transform="translate(1 1)"
                >
                  <circle
                    cx="6"
                    cy="6"
                    r="6"
                    fill="#FF5F56"
                    stroke="#E0443E"
                    stroke-width=".5"
                  />
                  <circle
                    cx="26"
                    cy="6"
                    r="6"
                    fill="#FFBD2E"
                    stroke="#DEA123"
                    stroke-width=".5"
                  />
                  <circle
                    cx="46"
                    cy="6"
                    r="6"
                    fill="#27C93F"
                    stroke="#1AAB29"
                    stroke-width=".5"
                  />
                </g>
              </svg>
            </div>
            <div
              ref="editorRef"
              class="p-2 select-none"
            />
          </div>
          <div
            data-controls="resize"
            class="absolute top-1/2 left-0 z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-neutral-400 bg-white"
          />
          <div
            data-controls="resize"
            class="absolute top-1/2 right-0 z-20 h-3 w-3 translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-neutral-400 bg-white"
          />
          <div
            v-if="showDimensions"
            class="absolute right-0 -bottom-12 left-0 z-10 mt-2 flex flex-col items-center"
          >
            <div
              class="relative mb-2 flex items-center justify-center"
              :style="{ width: `${width}px` }"
            >
              <div class="border-text absolute left-0 h-2 border-l" />
              <div class="border-text absolute right-0 h-2 border-l" />
              <div class="border-text absolute top-0 right-0 left-0 border-t" />
            </div>
            <div
              class="relative -top-5 rounded bg-neutral-700 px-2 py-1 text-xs text-white tabular-nums transition-opacity"
              :class="{ 'opacity-0': !showDimensions }"
            >
              {{ Math.round(width) }}px
            </div>
          </div>
          <div
            v-if="!isBackground"
            data-background="transparent"
            class="transparent"
          />
        </div>
      </div>
    </PerfectScrollbar>
  </div>
</template>

<style lang="scss">
@reference '../../../styles.css';

[data-editor-code-image] {
  --color-bg-transparent: oklch(50% 0 0);

  .CodeMirror,
  .CodeMirror-gutters {
    background-color: var(--color-code-bg-preview) !important;
  }

  .transparent {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image:
      linear-gradient(45deg, var(--color-bg-transparent) 25%, transparent 0),
      linear-gradient(-45deg, var(--color-bg-transparent) 25%, transparent 0),
      linear-gradient(45deg, transparent 75%, var(--color-bg-transparent) 0),
      linear-gradient(-45deg, transparent 75%, var(--color-bg-transparent) 0);
    background-size: 20px 20px;
    background-position:
      0 0,
      0 10px,
      10px -10px,
      -10px 0;
    z-index: 1;
  }
}

.notebook-grid {
  background-color: transparent;

  background-image:
    linear-gradient(var(--color-border) 2px, transparent 2px),
    linear-gradient(90deg, var(--color-border) 2px, transparent 2px),
    linear-gradient(var(--color-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-border) 1px, transparent 1px);
  background-size:
    50px 50px,
    50px 50px,
    10px 10px,
    10px 10px;
  background-position:
    -2px -2px,
    -2px -2px,
    -1px -1px,
    -1px -1px;
}

.gradient-disco {
  background: linear-gradient(90deg, #fc466b 0%, #3f5efb 100%);
}

.gradient-salad {
  background: linear-gradient(90deg, #00c9ff 0%, #92fe9d 100%);
}

.gradient-cucumber {
  background: linear-gradient(90deg, #e3ffe7 0%, #d9e7ff 100%);
}

.gradient-aqua {
  background: linear-gradient(90deg, #00d2ff 0%, #3a47d5 100%);
}

.gradient-lovely {
  background: linear-gradient(90deg, #efd5ff 0%, #515ada 100%);
}
</style>
