<script setup lang="ts">
import {
  useApp,
  useEditableField,
  useNavigationHistory,
  useSnippets,
  useSnippetUpdate,
} from '@/composables'
import { i18n } from '@/electron'
import { navigateBack, navigateForward } from '@/ipc/listeners/deepLinks'

import {
  ChevronLeft,
  ChevronRight,
  Code,
  Image,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Type,
} from 'lucide-vue-next'

const {
  selectedSnippet,
  selectedSnippetContent,
  addFragment,
  isAvailableToCodePreview,
} = useSnippets()
const { canGoBack, canGoForward } = useNavigationHistory()
const {
  isFocusedSnippetName,
  state,
  isShowCodePreview,
  isShowCodeImage,
  isShowJsonVisualizer,
  isSidebarHidden,
} = useApp()
const { addToUpdateQueue } = useSnippetUpdate()

const isShowDescription = ref(false)

const {
  model: name,
  onFocus: onNameFocus,
  onBlur,
} = useEditableField(
  () => selectedSnippet?.value?.name,
  (v) => {
    addToUpdateQueue(selectedSnippet.value!.id, {
      name: v,
      description: selectedSnippet.value!.description,
      folderId: selectedSnippet.value!.folder?.id || null,
      isDeleted: selectedSnippet.value!.isDeleted,
      isFavorites: selectedSnippet.value!.isFavorites,
    })
  },
)

function onNameBlur() {
  onBlur()
  isFocusedSnippetName.value = false
}

const isShowJsonVisualizerAction = computed(
  () => selectedSnippetContent.value?.language === 'json',
)

const isShowTags = computed(() => {
  return !isShowCodeImage.value && !isShowJsonVisualizer.value
})

const isHistoryVisible = computed(() => canGoBack.value || canGoForward.value)

function onClickTab(index: number) {
  state.snippetContentIndex = index
}

function onBackClick() {
  void navigateBack()
}

function onForwardClick() {
  void navigateForward()
}

function onCodePreviewToggle() {
  isShowCodePreview.value = !isShowCodePreview.value
  isShowCodeImage.value = false
  isShowJsonVisualizer.value = false
}

function onCodeImageToggle() {
  isShowCodeImage.value = !isShowCodeImage.value
  isShowCodePreview.value = false
  isShowJsonVisualizer.value = false
}

function onJsonVisualizerToggle() {
  isShowJsonVisualizer.value = !isShowJsonVisualizer.value
  isShowCodePreview.value = false
  isShowCodeImage.value = false
}
</script>

<template>
  <div data-editor-header>
    <div
      class="border-border grid grid-cols-[1fr_auto] items-center border-b px-2 pb-1"
    >
      <div class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        <div
          v-if="isHistoryVisible"
          class="flex shrink-0 items-center gap-0.5"
        >
          <UiActionButton
            :disabled="!canGoBack"
            :tooltip="i18n.t('menu:history.back')"
            @click="onBackClick"
          >
            <ChevronLeft class="h-3 w-3" />
          </UiActionButton>
          <UiActionButton
            :disabled="!canGoForward"
            :tooltip="i18n.t('menu:history.forward')"
            @click="onForwardClick"
          >
            <ChevronRight class="h-3 w-3" />
          </UiActionButton>
        </div>
        <div class="min-w-0 flex-1">
          <UiInput
            v-model="name"
            variant="ghost"
            class="w-full truncate px-0"
            :select="isFocusedSnippetName"
            @focus="onNameFocus"
            @blur="onNameBlur"
          />
        </div>
      </div>
      <div class="ml-2 flex">
        <UiActionButton
          class="mr-1"
          :tooltip="
            isSidebarHidden
              ? i18n.t('action.showSidebar')
              : i18n.t('action.hideSidebar')
          "
          @click="isSidebarHidden = !isSidebarHidden"
        >
          <PanelLeftOpen
            v-if="isSidebarHidden"
            class="h-3 w-3"
          />
          <PanelLeftClose
            v-else
            class="h-3 w-3"
          />
        </UiActionButton>
        <UiActionButton
          :tooltip="i18n.t('menu:editor.previewScreenshot')"
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
          v-if="isShowJsonVisualizerAction"
          :tooltip="i18n.t('menu:editor.previewJson')"
          :active="isShowJsonVisualizer"
          @click="onJsonVisualizerToggle"
        >
          <Network class="h-3 w-3 -rotate-90" />
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
          'bg-accent text-accent-foreground':
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
