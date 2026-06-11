<script setup lang="ts">
import type { ExcalidrawChangeKind, ExcalidrawHost } from './excalidrawHost'
import type { DrawingViewportState } from '~/main/store/types'
import { useTheme } from '@/composables'
import { i18n, store } from '@/electron'
import { useEventListener } from '@vueuse/core'
import { mountExcalidraw } from './excalidrawHost'

const props = defineProps<{
  drawingId: string
  content: string | null
  viewport: DrawingViewportState | null
  revision: number
}>()

const emit = defineEmits<{
  change: [drawingId: string, content: string]
  viewportChange: [drawingId: string, viewport: DrawingViewportState]
}>()

const SAVE_DEBOUNCE_MS = 500

const { isDark } = useTheme()
const containerRef = ref<HTMLElement | null>(null)
let host: ExcalidrawHost | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let viewportTimer: ReturnType<typeof setTimeout> | null = null
let currentDrawingId = props.drawingId

function getLangCode() {
  const locale = store.preferences.get<string>('localization.locale')
  return typeof locale === 'string' && locale ? locale.replace('_', '-') : 'en'
}

function cancelScheduledSave() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

function flushSave() {
  cancelScheduledSave()

  const content = host?.serializeScene()

  if (content != null) {
    emit('change', currentDrawingId, content)
  }
}

function flushViewportSave() {
  if (viewportTimer) {
    clearTimeout(viewportTimer)
    viewportTimer = null
  }

  const viewport = host?.getViewport()

  if (viewport) {
    emit('viewportChange', currentDrawingId, viewport)
  }
}

function scheduleSave() {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }

  saveTimer = setTimeout(() => {
    saveTimer = null
    flushSave()
  }, SAVE_DEBOUNCE_MS)
}

function scheduleViewportSave() {
  if (viewportTimer) {
    clearTimeout(viewportTimer)
  }

  viewportTimer = setTimeout(() => {
    viewportTimer = null
    flushViewportSave()
  }, SAVE_DEBOUNCE_MS)
}

function onHostChange(kind: ExcalidrawChangeKind) {
  if (kind === 'scene') {
    scheduleSave()
  }

  scheduleViewportSave()
}

watch(isDark, (value) => {
  host?.setTheme(value ? 'dark' : 'light')
})

watch(
  () => [props.revision, props.drawingId] as const,
  ([revision, drawingId], [previousRevision]) => {
    if (!host) {
      return
    }

    if (revision === previousRevision) {
      // The active drawing was renamed in place: same scene, new
      // identity. Re-target pending saves so edits are not dropped.
      cancelScheduledSave()
      currentDrawingId = drawingId
      scheduleSave()
      scheduleViewportSave()
      return
    }

    if (drawingId !== currentDrawingId) {
      // Switching to another drawing: persist pending edits first.
      flushSave()
      flushViewportSave()
      currentDrawingId = drawingId
    }
    else {
      // Same drawing reloaded from disk: discard stale pending edits.
      cancelScheduledSave()
    }

    host.loadScene(props.content, drawingId, props.viewport)
  },
)

onMounted(() => {
  if (!containerRef.value) {
    return
  }

  host = mountExcalidraw(containerRef.value, {
    initialContent: props.content,
    initialName: props.drawingId,
    initialViewport: props.viewport,
    theme: isDark.value ? 'dark' : 'light',
    langCode: getLangCode(),
    fitToContentLabel: i18n.t('spaces.drawings.fitToContent'),
    onChange: onHostChange,
  })
})

onBeforeUnmount(() => {
  flushSave()
  flushViewportSave()
  host?.destroy()
  host = null
})

// Persist pending edits when the window reloads or the app quits.
useEventListener(window, 'beforeunload', () => {
  flushSave()
  flushViewportSave()
})

defineExpose({
  openImageExport() {
    host?.openImageExportDialog()
  },
})
</script>

<template>
  <div
    ref="containerRef"
    class="canvas-host bg-background h-full w-full"
  />
</template>

<style scoped>
/* Keep only the drawing toolbar: hide the main menu, the library
   sidebar trigger and the help button. */
.canvas-host :deep(.excalidraw .main-menu-trigger),
.canvas-host :deep(.excalidraw .default-sidebar-trigger),
.canvas-host :deep(.excalidraw .help-icon) {
  display: none;
}

/* The fit-to-content button lives in Excalidraw's footer next to the
   zoom/undo islands: match their height, gap and vertical centering.
   Size is set directly (not via --button-width) so the icon inside keeps
   its default size. */
.canvas-host :deep(.excalidraw .fit-to-content-button) {
  width: var(--lg-button-size);
  height: var(--lg-button-size);
  margin-block: auto;
  margin-inline-start: 0.6rem;
}

/* Map Excalidraw theming variables to the app design tokens so its
   panels follow the massCode theme in both light and dark mode. */
.canvas-host :deep(.excalidraw),
.canvas-host :deep(.excalidraw.theme--dark) {
  /* Surfaces */
  --island-bg-color: var(--card);
  --default-bg-color: var(--background);
  --color-surface-lowest: var(--background);
  --color-surface-low: var(--card);
  --color-surface-mid: var(--accent-hover);
  --color-surface-high: var(--accent-hover);
  --color-on-surface: var(--foreground);
  --text-primary-color: var(--foreground);

  /* Active tool */
  --color-surface-primary-container: var(--accent);
  --color-on-primary-container: var(--accent-foreground);

  /* Brand and focus */
  --color-primary: var(--primary);
  --color-primary-darker: var(--primary);
  --color-primary-darkest: var(--primary);
  --color-primary-hover: var(--primary);
  --color-primary-light: var(--accent);
  --color-primary-light-darker: var(--accent);
  --color-brand-hover: var(--primary);
  --color-brand-active: var(--primary);
  --focus-highlight-color: var(--ring);

  /* Legacy button grays (zoom and undo islands) */
  --button-gray-1: var(--accent);
  --button-gray-2: var(--accent-hover);
  --button-gray-3: var(--accent);

  /* Inputs, popups, borders */
  --input-bg-color: var(--background);
  --input-hover-bg-color: var(--accent-hover);
  --input-border-color: var(--input);
  --popup-bg-color: var(--popover);
  --popup-secondary-bg-color: var(--card);
  --popup-text-color: var(--popover-foreground);
  --dialog-border-color: var(--border);
  --color-border-outline: var(--border);
  --color-border-outline-variant: var(--border);
  --keybinding-color: var(--muted-foreground);
  --scrollbar-thumb: var(--scrollbar);
  --scrollbar-thumb-hover: var(--muted-foreground);
}
</style>
