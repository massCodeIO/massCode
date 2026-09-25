<script setup lang="ts">
import { escapeCode, highlightCode } from '@/components/ai/highlight'
import { Switch } from '@/components/ui/shadcn/switch'
import { useEditor, useSnippets } from '@/composables'
import { useNativeExportBridge } from '@/composables/ai/nativeBridges'
import { saveRenderedArtifact } from '@/composables/useRenderedArtifactExport'
import { i18n } from '@/electron'
import { useCssVar } from '@vueuse/core'
import domToImage from 'dom-to-image'
import interact from 'interactjs'
import { FileDown } from 'lucide-vue-next'
import '@/components/cm-extensions/codeTokens.css'

const {
  displayedSnippet,
  displayedSnippetContent,
  selectedSnippet,
  selectedSnippetRecordStatus,
} = useSnippets()

const MIN_WIDTH = 520
const MAX_WIDTH = 920

const { settings, cursorPosition: _cursorPosition } = useEditor()

const activeBackground = ref<
  'disco' | 'aqua' | 'salad' | 'cucumber' | 'lovely'
>('disco')

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

const highlighted = ref('')
const renderedValue = ref('')
let highlightPending: Promise<void> = Promise.resolve()
let highlightRevision = 0
watch(
  displayedSnippetContent,
  (content, _previous, onCleanup) => {
    if (content && content.value === undefined)
      return
    highlightRevision++
    let stale = false
    onCleanup(() => {
      stale = true
    })
    const value = content?.value ?? ''
    renderedValue.value = value
    highlighted.value = escapeCode(value)
    highlightPending = highlightCode(
      value,
      content?.language ?? 'plain_text',
    ).then((html) => {
      if (!stale)
        highlighted.value = html
    })
  },
  { immediate: true },
)
const highlightedLines = computed(() => highlighted.value.split(/\r\n|\r|\n/))
watch(isDarkPreview, () => {
  colorBg.value = isDarkPreview.value ? 'oklch(24.78% 0 0)' : 'oklch(100% 0 0)'
  colorBorder.value = isDarkPreview.value ? 'oklch(30% 0 0)' : 'oklch(90% 0 0)'
})
function init() {
  initInteract()
}
onBeforeUnmount(() => {
  if (backgroundRef.value)
    interact(backgroundRef.value).unset()
})

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

async function onSave(
  format: 'png' | 'svg',
  current: () => boolean = () => true,
) {
  const snippet = displayedSnippet.value
  const content = displayedSnippetContent.value
  if (
    !snippet
    || !content
    || typeof content.value !== 'string'
    || selectedSnippetRecordStatus.value !== 'ready'
    || selectedSnippet.value?.id !== snippet.id
  ) {
    return { status: 'stale' as const }
  }
  const baseline = content.value
  const language = content.language
  const revision = highlightRevision
  const isCurrent = () =>
    current()
    && revision === highlightRevision
    && selectedSnippetRecordStatus.value === 'ready'
    && selectedSnippet.value?.id === snippet.id
    && displayedSnippet.value?.id === snippet.id
    && displayedSnippetContent.value?.id === content.id
    && displayedSnippetContent.value?.language === language
    && displayedSnippetContent.value?.value === baseline
  await highlightPending
  await nextTick()
  if (!isCurrent() || renderedValue.value !== baseline)
    return { status: 'stale' as const }
  return saveRenderedArtifact(
    format,
    snippet.name,
    async () => {
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
        data = await domToImage.toSvg(backgroundRef.value!, { filter })
      }

      return data
    },
    isCurrent,
  )
}

onMounted(() => {
  init()
})
useNativeExportBridge(
  'codeImage',
  (format, current) =>
    format === 'html' ? Promise.resolve(undefined) : onSave(format, current),
  async (action, current) => {
    if (
      action.action !== 'codeImageConfigure'
      || !editorRef.value
      || !containerRef.value
    ) {
      return { status: 'unavailable' }
    }
    if (
      !current()
      || selectedSnippetRecordStatus.value !== 'ready'
      || displayedSnippet.value?.id !== action.target.id
      || (action.target.contentId !== undefined
        && displayedSnippetContent.value?.id !== action.target.contentId)
    ) {
      return { status: 'stale' }
    }
    if (action.theme !== undefined)
      isDarkPreview.value = action.theme === 'dark'
    if (action.background !== undefined)
      isBackground.value = action.background
    if (action.gradient !== undefined)
      activeBackground.value = action.gradient
    if (action.width !== undefined) {
      width.value = Math.max(
        MIN_WIDTH,
        Math.min(action.width, MAX_WIDTH, containerRef.value.clientWidth - 56),
      )
    }
    await nextTick()
    return {
      status: current() ? 'done' : 'stale',
      visual: {
        theme: isDarkPreview.value ? 'dark' : 'light',
        background: isBackground.value,
        gradient: activeBackground.value,
        width: width.value,
      },
    }
  },
)
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
        <div class="flex items-center">
          <UiActionButton
            size="iconText"
            :tooltip="`${i18n.t('button.saveAs')} PNG`"
            @click="onSave('png')"
          >
            <div class="flex items-center gap-1">
              PNG <FileDown class="h-3 w-3" />
            </div>
          </UiActionButton>
          <UiActionButton
            size="iconText"
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
    <div class="scrollbar notebook-grid h-full min-h-0 overflow-auto">
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
              class="code-image-source p-2 select-none"
              :class="isDarkPreview ? 'cm-s-oceanic-next' : 'cm-s-neo'"
              :style="{
                fontFamily: settings.fontFamily,
                fontSize: `${settings.fontSize}px`,
                tabSize: settings.tabSize,
              }"
            >
              <div
                v-for="(line, index) in highlightedLines"
                :key="index"
                class="code-image-line"
              >
                <span class="code-image-number">{{ index + 1 }}</span>
                <pre
                  :style="{
                    whiteSpace: settings.wrap ? 'pre-wrap' : 'pre',
                    overflowWrap: settings.wrap ? 'anywhere' : undefined,
                  }"
                ><code v-html="line || '&#8203;'" /></pre>
              </div>
            </div>
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
    </div>
  </div>
</template>

<style lang="scss">
@reference '../../../styles.css';

[data-editor-code-image] {
  --color-bg-transparent: oklch(50% 0 0);

  .code-image-source {
    line-height: 1.5;
  }
  .code-image-line {
    display: flex;
    align-items: baseline;
  }
  .code-image-number {
    min-width: 3em;
    padding-right: 1em;
    opacity: 0.5;
    text-align: right;
    flex-shrink: 0;
  }
  .code-image-line pre {
    margin: 0;
    min-width: 0;
    font: inherit;
    flex: 1;
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
    linear-gradient(var(--border) 2px, transparent 2px),
    linear-gradient(90deg, var(--border) 2px, transparent 2px),
    linear-gradient(var(--border) 1px, transparent 1px),
    linear-gradient(90deg, var(--border) 1px, transparent 1px);
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
