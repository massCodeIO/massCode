<script setup lang="ts">
import { createCodeHighlight } from '@/components/cm-extensions/codeHighlight'
import { editorScrollbarTheme } from '@/components/cm-extensions/scrollbarTheme'
import { loadLanguageSupport } from '@/components/editor/grammars'
import { useTheme } from '@/composables/useTheme'
import { i18n } from '@/electron'
import { MergeView } from '@codemirror/merge'
import { Compartment, EditorState } from '@codemirror/state'
import { drawSelection, EditorView, lineNumbers } from '@codemirror/view'
import { lineEndingChange } from './lineEndings'

const props = defineProps<{
  before: string
  after: string
  language?: string
}>()
const { isDark } = useTheme()
const container = ref<HTMLElement>()
const endings = computed(() => lineEndingChange(props.before, props.after))
let view: MergeView | undefined
let observer: MutationObserver | undefined
const language = new Compartment()

function makeCollapseAccessible() {
  container.value
    ?.querySelectorAll<HTMLElement>('.cm-collapsedLines')
    .forEach((element) => {
      element.setAttribute('role', 'button')
      element.tabIndex = 0
      element.setAttribute(
        'aria-label',
        `${element.textContent}. ${i18n.t('ai.diff.expand')}`,
      )
    })
}
function onKeydown(event: KeyboardEvent) {
  if (
    event.target instanceof HTMLElement
    && event.target.matches('.cm-collapsedLines')
    && (event.key === 'Enter' || event.key === ' ')
  ) {
    event.preventDefault()
    const editor = event.target.closest('.cm-merge-a') ? view?.a : view?.b
    event.target.click()
    editor?.contentDOM.focus({ preventScroll: true })
  }
}
async function mountViewer() {
  view?.destroy()
  if (!container.value)
    return
  const theme = EditorView.theme(
    {
      '&': {
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)',
        fontSize: '12px',
        fontFamily: 'var(--font-mono)',
      },
      '.cm-content': { padding: '8px 0', caretColor: 'transparent' },
      '.cm-line': { padding: '0 8px' },
      '.cm-gutters': {
        backgroundColor: 'var(--muted)',
        color: 'var(--muted-foreground)',
        borderRight: '1px solid var(--border)',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        minWidth: '3em',
        padding: '0 8px',
      },
      '&.cm-merge-a .cm-changedLine': {
        backgroundColor: 'var(--diff-removed-bg)',
      },
      '&.cm-merge-b .cm-changedLine': {
        backgroundColor: 'var(--diff-added-bg)',
      },
      '&.cm-merge-a .cm-changedText': {
        background:
          'color-mix(in oklch, var(--diff-removed-bg), var(--destructive) 24%)',
        borderRadius: '2px',
      },
      '&.cm-merge-b .cm-changedText': {
        background:
          'color-mix(in oklch, var(--diff-added-bg), var(--foreground) 14%)',
        borderRadius: '2px',
      },
      '.cm-changeGutter': { width: '18px', paddingLeft: '0' },
      '.cm-changedLineGutter': {
        width: '18px',
        background: 'transparent !important',
        textAlign: 'center',
        color: 'var(--foreground)',
      },
      '&.cm-merge-a .cm-changedLineGutter::before': { content: '\'−\'' },
      '&.cm-merge-b .cm-changedLineGutter::before': { content: '\'+\'' },
      '.cm-collapsedLines': {
        background: 'var(--muted)',
        color: 'var(--muted-foreground)',
        border: 'none',
        borderBlock: '1px solid var(--border)',
        padding: '4px 8px',
        cursor: 'pointer',
      },
      '.cm-collapsedLines:focus-visible': {
        outline: '2px solid var(--ring)',
        outlineOffset: '-2px',
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor:
          'color-mix(in oklch, var(--primary) 24%, transparent) !important',
      },
      ...editorScrollbarTheme,
    },
    { dark: isDark.value },
  )
  const extensions = (label: string) => [
    theme,
    lineNumbers(),
    drawSelection(),
    createCodeHighlight(isDark.value),
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    EditorView.contentAttributes.of({ 'tabindex': '0', 'aria-label': label }),
    EditorState.phrases.of({
      '$ unchanged lines': i18n.t('ai.diff.unchangedLines'),
    }),
    language.of([]),
  ]
  const current = (view = new MergeView({
    parent: container.value,
    a: {
      doc: props.before,
      extensions: extensions(i18n.t('ai.workspace.before')),
    },
    b: {
      doc: props.after,
      extensions: extensions(i18n.t('ai.workspace.after')),
    },
    highlightChanges: true,
    gutter: true,
    collapseUnchanged: { margin: 3, minSize: 6 },
    diffConfig: { scanLimit: 1000, timeout: 100 },
  }))
  makeCollapseAccessible()
  if (!props.language || props.language === 'plain')
    return
  try {
    const support = await loadLanguageSupport(props.language)
    if (support && view === current) {
      current.a.dispatch({ effects: language.reconfigure(support) })
      current.b.dispatch({ effects: language.reconfigure(support) })
    }
  }
  catch {
    // A failed language chunk must not prevent reviewing or copying the diff.
  }
}
onMounted(() => {
  observer = new MutationObserver(makeCollapseAccessible)
  observer.observe(container.value!, { childList: true, subtree: true })
  void mountViewer()
})
watch(
  () => [props.before, props.after, props.language, isDark.value],
  mountViewer,
)
onBeforeUnmount(() => {
  observer?.disconnect()
  view?.destroy()
  view = undefined
})
</script>

<template>
  <div class="min-w-0 overflow-hidden rounded-md border">
    <div class="bg-muted grid grid-cols-2 border-b">
      <UiText
        variant="caption"
        class="border-r px-3 py-2"
      >
        {{ i18n.t("ai.workspace.before") }}
      </UiText>
      <UiText
        variant="caption"
        class="px-3 py-2"
      >
        {{ i18n.t("ai.workspace.after") }}
      </UiText>
    </div>
    <div
      v-if="endings"
      class="bg-muted/50 space-y-1 border-b px-3 py-2"
    >
      <UiText
        as="p"
        variant="caption"
      >
        {{ i18n.t("ai.diff.lineEndings.changed") }}
      </UiText>
      <div class="grid grid-cols-2 gap-3">
        <UiText
          variant="caption"
          muted
        >
          {{ i18n.t("ai.workspace.before") }}:
          {{ i18n.t(`ai.diff.lineEndings.${endings.before}`) }}
        </UiText>
        <UiText
          variant="caption"
          muted
        >
          {{ i18n.t("ai.workspace.after") }}:
          {{ i18n.t(`ai.diff.lineEndings.${endings.after}`) }}
        </UiText>
      </div>
    </div>
    <div
      ref="container"
      class="diff-viewer"
      @keydown="onKeydown"
    />
  </div>
</template>

<style scoped>
.diff-viewer :deep(.cm-mergeView) {
  max-height: 50vh;
  overflow: auto;
  scrollbar-color: var(--scrollbar) transparent;
}
.diff-viewer :deep(.cm-mergeViewEditor + .cm-mergeViewEditor) {
  border-left: 1px solid var(--border);
}
</style>
