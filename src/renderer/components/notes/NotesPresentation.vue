<script setup lang="ts">
import { useMarkdown } from '@/components/editor/markdown/composables'
import {
  useNotes,
  useNotesApp,
  useNoteSearch,
  useNotesSpaceInitialization,
} from '@/composables'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import { useFullscreen, useMagicKeys } from '@vueuse/core'
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
const { selectedNote, selectNote, isNotesLoading } = useNotes()
const {
  hideNotesViewModes,
  isNotesPresentationShown,
  showAllNotesPanels,
  showNotesPresentation,
} = useNotesApp()
const { initNotesSpace } = useNotesSpaceInitialization()
const { scaleToShow, onZoom } = useMarkdown()

const { isFullscreen, toggle } = useFullscreen()
const { left, right, escape, meta, ctrl, l } = useMagicKeys()

const isLaserPointerActive = ref(false)
const isClosed = ref(false)
const isInitCompleted = ref(false)

const noteIds = computed(
  () => displayedNotes.value?.map(note => note.id) ?? [],
)

const currentIndex = computed(() => {
  const id = selectedNote.value?.id
  if (id === undefined)
    return -1

  return noteIds.value.findIndex(noteId => noteId === id)
})

function onClose() {
  if (isClosed.value) {
    return
  }

  isClosed.value = true
  isNotesPresentationShown.value = false
  isLaserPointerActive.value = false
  showAllNotesPanels()
  router.push({ name: RouterName.notesSpace })
}

function onPrevNext(direction: 'prev' | 'next') {
  const index = currentIndex.value
  if (index < 0) {
    return
  }

  const targetIndex = direction === 'prev' ? index - 1 : index + 1
  const id = noteIds.value[targetIndex]

  if (id !== undefined) {
    selectNote(id)
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

watch(left, (value) => {
  if (value)
    onPrevNext('prev')
})

watch(right, (value) => {
  if (value)
    onPrevNext('next')
})

watch(escape, (value) => {
  if (value)
    onClose()
})

watchEffect(() => {
  if ((meta.value || ctrl.value) && l.value) {
    isLaserPointerActive.value = !isLaserPointerActive.value
  }
})

onMounted(async () => {
  showNotesPresentation()
  await initNotesSpace()
  isInitCompleted.value = true
})

onUnmounted(() => {
  isLaserPointerActive.value = false
  hideNotesViewModes()
})
</script>

<template>
  <div class="relative grid h-screen grid-rows-[1fr_40px] overflow-hidden">
    <UiActionButton
      class="absolute top-2 right-2 z-50"
      @click="onClose"
    >
      <X class="h-3 w-3" />
    </UiActionButton>
    <div class="h-full min-h-0 p-5">
      <NotesEditor
        :note-id="selectedNote?.id"
        :content="selectedNote?.content ?? ''"
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
          @click="onPrevNext('prev')"
        >
          <ArrowLeft class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          :tooltip="i18n.t('button.next')"
          @click="onPrevNext('next')"
        >
          <ArrowRight class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          :active="isLaserPointerActive"
          :tooltip="i18n.t('button.laserPointer')"
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
    <EditorMarkdownLaserPointer :is-active="isLaserPointerActive" />
  </div>
</template>
