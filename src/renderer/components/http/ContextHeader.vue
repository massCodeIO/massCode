<script setup lang="ts">
import CustomIcons from '@/components/sidebar/folders/custom-icons/CustomIcons.vue'
import { useDialog, useHttpApp, useHttpFolders } from '@/composables'
import { httpRuntimeNavigation } from '@/composables/spaces/http/runtimeNavigation'
import { useHttpCollection } from '@/composables/spaces/http/useHttpCollection'
import { useHttpRunner } from '@/composables/spaces/http/useHttpRunner'
import { i18n } from '@/electron'
import { Folder, Layers, Play } from 'lucide-vue-next'

const collectionContext = useHttpCollection()
const { collection, missing } = collectionContext
const { httpState } = useHttpApp()
const { folders, getFolderByIdFromTree, getHttpFolders } = useHttpFolders()
const { open: runnerOpen, openRunner, running, preparing } = useHttpRunner()
const folder = computed(() =>
  getFolderByIdFromTree(folders.value, httpState.folderId ?? null),
)
const title = computed(() =>
  httpState.activePanel === 'runner'
    ? i18n.t('spaces.http.runner.title')
    : (folder.value?.name
      ?? collection.value?.name
      ?? i18n.t('spaces.http.title')),
)
function setIcon() {
  if (!collection.value || missing.value)
    return
  useDialog().showDialog({
    title: i18n.t('action.setCustomIcon'),
    content: h(CustomIcons, {
      nodeId: collection.value.id,
      spaceId: 'http',
      onIconChanged: () => getHttpFolders(false),
    }),
  })
}
async function showRunner() {
  if (runnerOpen.value) {
    if (await httpRuntimeNavigation.confirmLeave()) {
      httpRuntimeNavigation.transitionToken += 1
      httpState.activePanel = 'runner'
    }
  }
  else if (folder.value) {
    await openRunner(folder.value.id)
  }
}
</script>

<template>
  <div
    class="flex h-[calc(40px-var(--content-top-offset))] shrink-0 items-center gap-1 border-b px-2 pb-1"
  >
    <UiActionButton
      v-if="collection"
      :tooltip="i18n.t('action.setCustomIcon')"
      :disabled="missing"
      @click="setIcon"
    >
      <UiFolderIcon
        v-if="collection.icon"
        :folder-id="collection.id"
        :name="collection.icon"
        space-id="http"
      />
      <Folder
        v-else-if="collection.parentId !== null"
        class="size-4"
      />
      <Layers
        v-else
        class="size-4"
      />
    </UiActionButton>
    <UiText
      variant="sm"
      class="mr-auto min-w-0 truncate"
    >
      {{ title }}
    </UiText>
    <HttpRequestSaveButton
      v-if="collection"
      :context="collectionContext"
    />
    <UiActionButton
      :tooltip="i18n.t('spaces.http.runner.title')"
      :aria-label="i18n.t('spaces.http.runner.title')"
      :disabled="!runnerOpen && (!folder || running || preparing)"
      @click="showRunner"
    >
      <Play class="size-4" />
    </UiActionButton>
    <HttpPanelActions />
  </div>
</template>
