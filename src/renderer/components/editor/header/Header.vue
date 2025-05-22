<script setup lang="ts">
import { useApp, useSnippets, useSnippetUpdate } from '@/composables'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'

import {
  Code,
  Eye,
  GitFork,
  Image,
  Plus,
  Presentation,
  Type,
} from 'lucide-vue-next'

const {
  selectedSnippet,
  selectedSnippetContent,
  addFragment,
  isAvailableToCodePreview,
} = useSnippets()
const {
  isFocusedSnippetName,
  state,
  isShowMarkdown,
  isShowMindmap,
  isShowMarkdownPresentation,
  isShowCodePreview,
  isShowCodeImage,
} = useApp()
const { addToUpdateQueue } = useSnippetUpdate()

const isShowDescription = ref(false)

const name = computed({
  get() {
    return selectedSnippet?.value?.name
  },
  set(v: string) {
    addToUpdateQueue(selectedSnippet.value!.id, {
      name: v,
      description: selectedSnippet.value!.description,
      folderId: selectedSnippet.value!.folder?.id || null,
      isDeleted: selectedSnippet.value!.isDeleted,
      isFavorites: selectedSnippet.value!.isFavorites,
    })
  },
})

const isShowMarkdownAction = computed(
  () => selectedSnippetContent.value?.language === 'markdown',
)

const isShowTags = computed(() => {
  return (
    !isShowMindmap.value && !isShowMarkdown.value && !isShowCodeImage.value
  )
})

function onClickTab(index: number) {
  state.snippetContentIndex = index
}

function onMarkdownToggle() {
  isShowMarkdown.value = !isShowMarkdown.value
  isShowMindmap.value = false
  isShowMarkdownPresentation.value = false
  isShowCodePreview.value = false
  isShowCodeImage.value = false
}

function onMarkdownPresentationToggle() {
  isShowMarkdownPresentation.value = !isShowMarkdownPresentation.value
  isShowMarkdown.value = false
  isShowMindmap.value = false
  isShowCodePreview.value = false
  isShowCodeImage.value = false

  router.push({ name: RouterName.markdownPresentation })
}

function onMindmapToggle() {
  isShowMindmap.value = !isShowMindmap.value
  isShowMarkdown.value = false
  isShowMarkdownPresentation.value = false
  isShowCodePreview.value = false
  isShowCodeImage.value = false
}

function onCodePreviewToggle() {
  isShowCodePreview.value = !isShowCodePreview.value
  isShowMarkdown.value = false
  isShowMarkdownPresentation.value = false
  isShowMindmap.value = false
  isShowCodeImage.value = false
}

function onCodeImageToggle() {
  isShowCodeImage.value = !isShowCodeImage.value
  isShowMarkdown.value = false
  isShowMarkdownPresentation.value = false
  isShowMindmap.value = false
  isShowCodePreview.value = false
}
</script>

<template>
  <div data-editor-header>
    <div
      class="border-border grid grid-cols-[1fr_auto] items-center border-b px-2"
    >
      <UiInput
        v-model="name"
        variant="ghost"
        class="w-full truncate px-0"
        :select="isFocusedSnippetName"
        @blur="isFocusedSnippetName = false"
      />
      <div class="ml-2 flex">
        <UiActionButton
          :tooltip="i18n.t('action.add.description')"
          :active="isShowCodeImage"
          @click="onCodeImageToggle"
        >
          <Image class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          v-if="isAvailableToCodePreview"
          :tooltip="
            isShowCodePreview
              ? `${i18n.t('action.hide')} ${i18n.t('menu:editor.previewCode')}`
              : i18n.t('menu:editor.previewCode')
          "
          :active="isShowCodePreview"
          @click="onCodePreviewToggle"
        >
          <Code class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          v-if="isShowMarkdownAction"
          :tooltip="
            isShowMarkdownPresentation
              ? i18n.t('action.hide')
              : i18n.t('menu:markdown.presentationMode')
          "
          :active="isShowMarkdownPresentation"
          @click="onMarkdownPresentationToggle"
        >
          <Presentation class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          v-if="isShowMarkdownAction"
          :tooltip="
            isShowMarkdown
              ? `${i18n.t('action.hide')} ${i18n.t('menu:markdown.previewMarkdown')}`
              : i18n.t('menu:markdown.previewMarkdown')
          "
          :active="isShowMarkdown"
          @click="onMarkdownToggle"
        >
          <Eye class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          v-if="isShowMarkdownAction"
          :tooltip="
            isShowMindmap
              ? `${i18n.t('action.hide')} ${i18n.t('menu:markdown.previewMindmap')}`
              : i18n.t('menu:markdown.previewMindmap')
          "
          :active="isShowMindmap"
          @click="onMindmapToggle"
        >
          <GitFork class="h-3 w-3 rotate-90" />
        </UiActionButton>
        <UiActionButton
          :tooltip="i18n.t('action.add.description')"
          @click="isShowDescription = !isShowDescription"
        >
          <Type class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          :tooltip="i18n.t('action.new.fragment')"
          @click="addFragment"
        >
          <Plus class="h-4 w-4" />
        </UiActionButton>
      </div>
    </div>
    <div
      v-if="selectedSnippet?.contents && selectedSnippet.contents.length > 1"
      class="border-border grid auto-cols-fr grid-flow-col border-b"
    >
      <EditorTab
        v-for="(i, index) in selectedSnippet?.contents"
        :id="i.id"
        :key="i.id"
        :index="index"
        :name="i.label"
        :class="{
          'bg-list-selection text-list-selection-fg':
            state.snippetContentIndex === index,
        }"
        @click="onClickTab(index)"
      />
    </div>
    <EditorDescription v-model:show="isShowDescription" />
    <div
      v-if="isShowTags"
      class="pt-1"
    >
      <EditorHeaderTags />
    </div>
  </div>
</template>
