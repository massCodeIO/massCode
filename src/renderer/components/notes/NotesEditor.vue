<script setup lang="ts">
import { useNotes, useTheme } from '@/composables'
import { i18n } from '@/electron'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { FileText } from 'lucide-vue-next'
import { hideMarkup } from './cm-extensions/hideMarkup'
import { markdownDecorations } from './cm-extensions/markdownDecorations'

const {
  activeNote,
  activeNoteContent,
  activeNoteId,
  updateNoteContent,
  renameNote,
} = useNotes()
const { isDark: _isDark } = useTheme()

const editorContainer = ref<HTMLElement>()
const noteName = ref('')
let view: EditorView | null = null
let isApplyingExternalContent = false

const lightTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
  },
  '.cm-content': {
    fontFamily: 'var(--font-sans)',
    padding: '16px 24px',
    caretColor: 'var(--foreground)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--foreground)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--accent) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--accent) !important',
  },
  '.cm-gutters': {
    display: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-line': {
    padding: '0',
  },
})

function createEditorState(content: string): EditorState {
  return EditorState.create({
    doc: content,
    extensions: [
      lightTheme,
      EditorView.lineWrapping,
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: GFM,
      }),
      markdownDecorations,
      hideMarkup,
      placeholder(i18n.t('notes.emptyState')),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !isApplyingExternalContent) {
          updateNoteContent(update.state.doc.toString())
        }
      }),
    ],
  })
}

function initEditor() {
  if (!editorContainer.value)
    return

  if (view) {
    view.destroy()
    view = null
  }

  view = new EditorView({
    state: createEditorState(activeNoteContent.value),
    parent: editorContainer.value,
  })
}

function applyEditorContent(content: string, force = false) {
  if (!view)
    return

  const currentValue = view.state.doc.toString()
  if (!force && currentValue === content)
    return

  isApplyingExternalContent = true
  view.setState(createEditorState(content))
  isApplyingExternalContent = false
}

function resetNameDraft() {
  noteName.value = activeNote.value?.name ?? ''
}

async function commitNameDraft() {
  const note = activeNote.value
  if (!note) {
    return
  }

  const nextName = noteName.value.trim()

  if (!nextName) {
    noteName.value = note.name
    return
  }

  if (nextName !== note.name) {
    await renameNote(note.id, nextName)
  }
}

watch(activeNoteId, () => {
  applyEditorContent(activeNoteContent.value, true)
})

watch(activeNoteContent, (content) => {
  applyEditorContent(content, false)
})

watch(activeNote, (note) => {
  noteName.value = note?.name ?? ''

  if (note && !view) {
    nextTick(initEditor)
  }
  else if (!note && view) {
    view.destroy()
    view = null
  }
})

onMounted(() => {
  if (activeNote.value) {
    noteName.value = activeNote.value.name
    initEditor()
  }
})

onUnmounted(() => {
  if (view) {
    view.destroy()
    view = null
  }
})
</script>

<template>
  <div
    class="flex h-full flex-col overflow-hidden pt-[var(--content-top-offset)]"
  >
    <template v-if="activeNote">
      <div class="border-border border-b pb-1">
        <div class="flex items-center px-1">
          <UiInput
            v-model="noteName"
            variant="ghost"
            class="w-full truncate px-0"
            :placeholder="i18n.t('notes.untitled')"
            @blur="commitNameDraft"
            @keydown.enter.prevent="commitNameDraft"
            @keydown.esc.prevent="resetNameDraft"
          />
        </div>
      </div>
      <div
        ref="editorContainer"
        class="flex-1 overflow-hidden"
      />
    </template>
    <div
      v-else
      class="flex h-full flex-col items-center justify-center gap-3"
    >
      <FileText class="text-muted-foreground/30 h-12 w-12" />
      <UiText class="text-muted-foreground">
        {{ i18n.t("notes.emptyState") }}
      </UiText>
    </div>
  </div>
</template>
