<script setup lang="ts">
import { useApp, useSnippets } from '@/composables'
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
import { ref } from 'vue'
import { useMarkdown } from './composables'

const { isShowMarkdownPresentation } = useApp()
const { selectSnippet, displayedSnippets, selectedSnippet } = useSnippets()
const { scaleToShow, onZoom } = useMarkdown()

const { isFullscreen, toggle } = useFullscreen()
const { left, right, escape, meta, ctrl, l } = useMagicKeys()

const isLaserPointerActive = ref(false)

const mdSnippetIds = computed(() => {
  return displayedSnippets.value
    ?.filter(s => s.contents[0].language === 'markdown')
    .map(i => i.id)
})

const currentIndex = computed(
  () =>
    mdSnippetIds.value?.findIndex(i => selectedSnippet.value?.id === i) || 0,
)

function onClose() {
  isShowMarkdownPresentation.value = false
  router.push({ name: RouterName.main })
}

function onPrevNext(direction: 'prev' | 'next') {
  let id

  if (direction === 'prev') {
    id = mdSnippetIds.value?.[currentIndex.value - 1]
  }
  else {
    id = mdSnippetIds.value?.[currentIndex.value + 1]
  }

  if (id) {
    selectSnippet(id)
  }
}

function onFullscreen() {
  toggle()
}

function toggleLaserPointer() {
  isLaserPointerActive.value = !isLaserPointerActive.value
}

watch(left, (v) => {
  if (v)
    onPrevNext('prev')
})

watch(right, (v) => {
  if (v)
    onPrevNext('next')
})

watch(escape, (v) => {
  if (v)
    onClose()
})

watchEffect(() => {
  if ((meta.value || ctrl.value) && l.value) {
    isLaserPointerActive.value = !isLaserPointerActive.value
  }
})
</script>

<template>
  <div class="relative grid h-screen grid-rows-[1fr_40px] overflow-hidden">
    <UiButton
      class="absolute top-6 right-2 z-50"
      variant="icon"
      @click="onClose"
    >
      <X class="h-3 w-3" />
    </UiButton>
    <PerfectScrollbar :options="{ minScrollbarLength: 20 }">
      <div class="overflow-auto p-5">
        <EditorMarkdown :key="scaleToShow" />
      </div>
    </PerfectScrollbar>
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
          {{ currentIndex + 1 }} / {{ mdSnippetIds?.length }}
        </div>
      </div>
    </div>
    <EditorMarkdownLaserPointer :is-active="isLaserPointerActive" />
  </div>
</template>
