<script setup lang="ts">
import type {
  FolderIconSetPayload,
  FolderIconSpaceId,
  FolderIconWritePayload,
} from '~/main/types/ipc'
import { createFolderEmojiValue } from '@/components/ui/folder-icon/icons'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { i18n, ipc } from '@/electron'
import {
  markPersistedStorageMutation,
  useFolders,
  useSonner,
} from '~/renderer/composables'

type PickerTab = 'emoji' | 'icons' | 'upload'

interface Props {
  nodeId: number
  spaceId: FolderIconSpaceId
  onIconChanged?: () => Promise<void>
}

const props = defineProps<Props>()

const { getFolders } = useFolders()
const { sonner } = useSonner()
const activeTab = ref<PickerTab>('emoji')
const isUploading = ref(false)

const tabs = computed<Array<{ label: string, value: PickerTab }>>(() => [
  { label: i18n.t('folder.iconPicker.tabs.emoji'), value: 'emoji' },
  { label: i18n.t('folder.iconPicker.tabs.icons'), value: 'icons' },
  { label: i18n.t('folder.iconPicker.tabs.upload'), value: 'upload' },
])

async function refreshAndClose() {
  markPersistedStorageMutation()

  if (props.onIconChanged)
    await props.onIconChanged()
  else await getFolders()

  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  )
}

function showError(key: string) {
  sonner({ message: i18n.t(key), type: 'error' })
}

async function onSet(value: string) {
  if (!props.nodeId || isUploading.value)
    return

  try {
    await ipc.invoke<FolderIconSetPayload, void>('fs:folder-icon:set', {
      folderId: props.nodeId,
      icon: value,
      spaceId: props.spaceId,
    })
    await refreshAndClose()
  }
  catch {
    showError('folder.iconPicker.errors.updateFailed')
  }
}

function onEmojiSelected(emoji: string) {
  return onSet(createFolderEmojiValue(emoji))
}

async function onFileSelected(file: File) {
  isUploading.value = true

  try {
    await ipc.invoke<FolderIconWritePayload, string>('fs:folder-icon:write', {
      buffer: await file.arrayBuffer(),
      folderId: props.nodeId,
      spaceId: props.spaceId,
    })
    await refreshAndClose()
  }
  catch {
    showError('folder.iconPicker.errors.processingFailed')
  }
  finally {
    isUploading.value = false
  }
}
</script>

<template>
  <Tabs.Tabs
    v-model="activeTab"
    class="gap-4"
    @keydown.enter.stop
  >
    <Tabs.TabsList>
      <Tabs.TabsTrigger
        v-for="tab in tabs"
        :key="tab.value"
        :disabled="isUploading"
        :value="tab.value"
      >
        {{ tab.label }}
      </Tabs.TabsTrigger>
    </Tabs.TabsList>
    <Tabs.TabsContent
      class="mt-0"
      value="emoji"
    >
      <SidebarFoldersCustomIconsEmojiPicker @select="onEmojiSelected" />
    </Tabs.TabsContent>
    <Tabs.TabsContent
      class="mt-0"
      value="icons"
    >
      <SidebarFoldersCustomIconsIconsPicker @select="onSet" />
    </Tabs.TabsContent>
    <Tabs.TabsContent
      class="mt-0"
      value="upload"
    >
      <SidebarFoldersCustomIconsUploadPicker
        :is-uploading="isUploading"
        @error="showError"
        @select="onFileSelected"
      />
    </Tabs.TabsContent>
  </Tabs.Tabs>
</template>
