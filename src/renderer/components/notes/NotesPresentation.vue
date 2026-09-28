<script setup lang="ts">
import { useMarkdown } from '@/components/editor/markdown/composables'
import {
  useNotes,
  useNotesApp,
  useNoteSearch,
  useNotesSpaceInitialization,
} from '@/composables'
import { readNativeState } from '@/composables/ai/nativeActions'
import { registerNativeBridge } from '@/composables/ai/nativeBridges'
import { useNavigationHistory } from '@/composables/useNavigationHistory'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import { useEventListener, useFullscreen } from '@vueuse/core'
import {
  ArrowLeft,
  ArrowRight,
  Expand,
  Minimize,
  Minus,
  Plus,
  X,
  Zap,
} from 'lucide-vue-next'

const { displayedNotes } = useNoteSearch()
const {
  selectedNote,
  selectNote,
  isNotesLoading,
  refreshSelectedNote,
  selectedNoteRecordStatus,
} = useNotes()
const {
  hideNotesViewModes,
  isNotesPresentationShown,
  showAllNotesPanels,
  showNotesPresentation,
} = useNotesApp()
const { initNotesSpace } = useNotesSpaceInitialization()
const { scaleToShow, onZoom } = useMarkdown()

const { isFullscreen, toggle, enter, exit } = useFullscreen()

const isLaserPointerActive = ref(false)
const isClosed = ref(false)
const isInitCompleted = ref(false)

const noteIds = computed(
  () => displayedNotes.value?.map(note => note.id) ?? [],
)

// id и контент слайда обновляются атомарно, когда контент заметки загружен:
// иначе при листании слайд мигает пустым состоянием.
const presentationNoteId = ref<number | undefined>()
const presentationContent = ref('')

watch(
  () => [selectedNote.value?.id, selectedNote.value?.content] as const,
  ([id, content]) => {
    if (selectedNote.value && content === undefined) {
      return
    }

    presentationNoteId.value = id
    presentationContent.value = content ?? ''
  },
  { immediate: true },
)

const currentIndex = computed(() => {
  const id = selectedNote.value?.id
  if (id === undefined)
    return -1

  return noteIds.value.findIndex(noteId => noteId === id)
})

async function onClose() {
  if (isClosed.value) {
    return
  }

  isClosed.value = true
  isNotesPresentationShown.value = false
  isLaserPointerActive.value = false
  showAllNotesPanels()
  await router.push({ name: RouterName.notesSpace })
}

function onPrevNext(direction: 'prev' | 'next') {
  const index = currentIndex.value
  if (index < 0) {
    return
  }

  const targetIndex = direction === 'prev' ? index - 1 : index + 1
  const id = noteIds.value[targetIndex]

  if (id !== undefined) {
    useNavigationHistory().recordNavigation(() => {
      selectNote(id)
    })
  }
}

function onFullscreen() {
  toggle()
}

function toggleLaserPointer() {
  isLaserPointerActive.value = !isLaserPointerActive.value
}

watch(
  () => [isNotesLoading.value, selectedNote.value?.id] as const,
  ([loading, id]) => {
    if (!isInitCompleted.value) {
      return
    }

    if (!loading && id === undefined) {
      onClose()
    }
  },
  { immediate: true },
)

useEventListener('keydown', (event: KeyboardEvent) => {
  const target = event.target
  if (
    event.defaultPrevented
    || event.isComposing
    || (target instanceof HTMLElement
      && (target.isContentEditable
        || target.closest('input, textarea, select, [role="textbox"]')))
  ) {
    return
  }
  if (event.key === 'ArrowLeft') {
    onPrevNext('prev')
  }
  else if (event.key === 'ArrowRight') {
    onPrevNext('next')
  }
  else if (event.key === 'Escape') {
    void onClose()
  }
  else if (
    (event.metaKey || event.ctrlKey)
    && event.key.toLowerCase() === 'l'
    && !event.repeat
  ) {
    toggleLaserPointer()
  }
})

onMounted(async () => {
  showNotesPresentation()
  await initNotesSpace()
  isInitCompleted.value = true
})

let unregisterNative: (() => void) | undefined
onMounted(() => {
  unregisterNative = registerNativeBridge(
    'presentation',
    async (action, current) => {
      if (action.action !== 'presentation' || !isInitCompleted.value)
        return { status: 'unavailable' }
      if (
        !current()
        || selectedNote.value?.id !== action.target.id
        || isClosed.value
      ) {
        return { status: 'stale' }
      }
      const command = action.command
      if (command === 'next' || command === 'previous') {
        const target
          = noteIds.value[currentIndex.value + (command === 'next' ? 1 : -1)]
        if (target === undefined)
          return { status: 'unavailable' }
        await useNavigationHistory().recordNavigation(() => selectNote(target))
        await refreshSelectedNote()
        if (!current() || selectedNote.value?.id !== target)
          return { status: 'stale' }
        if (selectedNoteRecordStatus.value !== 'ready')
          return { status: 'failed' }
      }
      else if (command === 'close') {
        await onClose()
        await nextTick()
        return {
          status:
            current()
            && router.currentRoute.value.name === RouterName.notesSpace
              ? 'done'
              : 'stale',
          state: readNativeState(),
        }
      }
      else if (command === 'fullscreenOn' || command === 'fullscreenOff') {
        await (command === 'fullscreenOn' ? enter() : exit())
        if (isFullscreen.value !== (command === 'fullscreenOn'))
          return { status: 'failed' }
      }
      else if (command === 'laserOn' || command === 'laserOff') {
        isLaserPointerActive.value = command === 'laserOn'
      }
      else {
        onZoom(command === 'zoomIn' ? 'in' : 'out')
      }
      await nextTick()
      return {
        status: current() ? 'done' : 'stale',
        state: readNativeState(),
        presentation: {
          index: currentIndex.value,
          count: noteIds.value.length,
          fullscreen: isFullscreen.value,
          laser: isLaserPointerActive.value,
          scale: scaleToShow.value,
        },
      }
    },
  )
})
onBeforeUnmount(() => unregisterNative?.())

onUnmounted(() => {
  isLaserPointerActive.value = false
  hideNotesViewModes()
})
</script>

<template>
  <div
    class="relative grid h-screen grid-rows-[1fr_40px] overflow-hidden [contain:paint]"
  >
    <UiActionButton
      class="absolute top-2 right-2 z-50"
      @click="onClose"
    >
      <X class="h-3 w-3" />
    </UiActionButton>
    <div class="h-full min-h-0 p-5">
      <NotesEditor
        :note-id="presentationNoteId"
        :content="presentationContent"
        mode="preview"
        presentation
      />
    </div>
    <div class="flex items-center justify-between px-8">
      <div class="flex items-center">
        <UiActionButton
          :tooltip="i18n.t('button.fullscreen')"
          @click="onFullscreen"
        >
          <Expand
            v-if="!isFullscreen"
            class="h-3 w-3"
          />
          <Minimize
            v-else
            class="h-3 w-3"
          />
        </UiActionButton>
        <UiActionButton
          :tooltip="i18n.t('button.prev')"
          shortcut="ArrowLeft"
          @click="onPrevNext('prev')"
        >
          <ArrowLeft class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          :tooltip="i18n.t('button.next')"
          shortcut="ArrowRight"
          @click="onPrevNext('next')"
        >
          <ArrowRight class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          :active="isLaserPointerActive"
          :tooltip="i18n.t('button.laserPointer')"
          shortcut="CommandOrControl+L"
          @click="toggleLaserPointer"
        >
          <Zap class="h-3 w-3" />
        </UiActionButton>
        <div class="flex items-center gap-2">
          <UiActionButton
            :tooltip="i18n.t('button.zoomOut')"
            @click="onZoom('out')"
          >
            <Minus class="h-3 w-3" />
          </UiActionButton>
          <div class="tabular-nums select-none">
            {{ scaleToShow }}
          </div>
          <UiActionButton
            :tooltip="i18n.t('button.zoomIn')"
            @click="onZoom('in')"
          >
            <Plus class="h-3 w-3" />
          </UiActionButton>
        </div>
      </div>
      <div>
        <div class="tabular-nums select-none">
          {{ Math.max(1, currentIndex + 1) }} / {{ noteIds.length }}
        </div>
      </div>
    </div>
    <EditorMarkdownLaserPointer
      :key="presentationNoteId"
      :is-active="isLaserPointerActive"
    />
  </div>
</template>
