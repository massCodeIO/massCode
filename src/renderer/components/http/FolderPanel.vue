<script setup lang="ts">
import CustomIcons from '@/components/sidebar/folders/custom-icons/CustomIcons.vue'
import { Button } from '@/components/ui/shadcn/button'
import {
  useDialog,
  useHttpApp,
  useHttpFolders,
  useHttpRequests,
  useSonner,
} from '@/composables'
import { useHttpNavigationTree } from '@/composables/spaces/http/useHttpNavigationTree'
import { useHttpRunner } from '@/composables/spaces/http/useHttpRunner'
import { i18n } from '@/electron'
import {
  getEntryNameConflictMessage,
  getEntryNameValidationMessage,
} from '@/utils'
import { Folder, Layers } from 'lucide-vue-next'

const { httpState } = useHttpApp()
const {
  folders,
  getFolderByIdFromTree,
  getHttpFolders,
  updateHttpFolder,
  createHttpFolderAndSelect,
} = useHttpFolders()
const { createHttpRequestAndSelect } = useHttpRequests()
const { nodes, open } = useHttpNavigationTree()
const { openRunner, running, preparing } = useHttpRunner()
const { sonner } = useSonner()
const folder = computed(() =>
  getFolderByIdFromTree(folders.value, httpState.folderId ?? null),
)
const children = computed(() =>
  nodes.value.filter(node => node.parentId === `folder:${folder.value?.id}`),
)
const name = ref('')
const saving = ref(false)
watch(
  () => [folder.value?.id, folder.value?.name],
  () => {
    name.value = folder.value?.name ?? ''
  },
  { immediate: true },
)
const validation = computed(() => {
  const issue = getEntryNameValidationMessage(name.value, i18n.t.bind(i18n))
  if (issue)
    return issue
  const current = nodes.value.find(
    node => node.id === `folder:${folder.value?.id}`,
  )
  return nodes.value.some(
    node =>
      node.id !== current?.id
      && node.parentId === current?.parentId
      && node.name.toLowerCase() === name.value.trim().toLowerCase(),
  )
    ? getEntryNameConflictMessage('folder', i18n.t.bind(i18n))
    : ''
})
async function save() {
  if (!folder.value || validation.value || saving.value)
    return
  saving.value = true
  const saved = await updateHttpFolder(folder.value.id, {
    name: name.value.trim(),
  })
  saving.value = false
  if (!saved) {
    sonner({
      type: 'error',
      message: i18n.t('spaces.http.folderPanel.saveFailed'),
    })
  }
}
function setIcon() {
  if (!folder.value)
    return
  useDialog().showDialog({
    title: i18n.t('action.setCustomIcon'),
    content: h(CustomIcons, {
      nodeId: folder.value.id,
      spaceId: 'http',
      onIconChanged: () => getHttpFolders(false),
    }),
  })
}
</script>

<template>
  <HttpCollectionEditor v-if="folder?.parentId === null" />
  <div
    v-else-if="folder"
    class="flex h-full flex-col overflow-hidden pt-[var(--content-top-offset)]"
  >
    <div class="flex h-8 shrink-0 items-center gap-2 border-b px-2 pb-1">
      <Layers
        v-if="folder.parentId === null"
        class="size-4"
      />
      <Folder
        v-else
        class="size-4"
      />
      <UiText
        variant="sm"
        class="truncate"
      >
        {{ folder.name }}
      </UiText>
    </div>
    <div class="space-y-6 overflow-auto p-4">
      <div class="space-y-2">
        <UiText variant="sm">
          {{ i18n.t("spaces.http.folderPanel.name") }}
        </UiText>
        <div class="flex items-center gap-2">
          <div class="min-w-0 flex-1">
            <UiInput
              v-model="name"
              class="flex-1"
              :disabled="saving"
              :aria-label="i18n.t('spaces.http.folderPanel.name')"
              @keydown.enter="save"
            />
          </div>
          <Button
            variant="outline"
            :disabled="
              saving || Boolean(validation) || name.trim() === folder.name
            "
            @click="save"
          >
            {{ i18n.t("button.save") }}
          </Button>
        </div>
        <UiText
          v-if="validation"
          variant="xs"
          class="text-destructive"
        >
          {{ validation }}
        </UiText>
        <Button
          variant="outline"
          @click="setIcon"
        >
          {{ i18n.t("action.setCustomIcon") }}
        </Button>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          @click="createHttpRequestAndSelect({ folderId: folder.id })"
        >
          {{ i18n.t("spaces.http.action.newRequest") }}
        </Button>
        <Button
          variant="outline"
          @click="createHttpFolderAndSelect(folder.id)"
        >
          {{ i18n.t("action.new.folder") }}
        </Button>
        <Button
          :disabled="running || preparing"
          @click="openRunner(folder.id)"
        >
          {{
            i18n.t(
              folder.parentId === null
                ? "spaces.http.folderPanel.runCollection"
                : "spaces.http.runner.runFolder",
            )
          }}
        </Button>
      </div>
      <div class="space-y-2">
        <UiText variant="sm">
          {{ i18n.t("spaces.http.folderPanel.contents") }}
        </UiText>
        <UiEmptyPlaceholder
          v-if="!children.length"
          :text="i18n.t('spaces.http.tree.empty')"
        />
        <Button
          v-for="child in children"
          :key="child.id"
          variant="ghost"
          class="flex w-full justify-start gap-2"
          @click="open(child)"
        >
          <HttpMethodBadge
            v-if="child.kind === 'request'"
            :method="child.method || 'GET'"
            :protocol="child.protocol"
          />
          <Folder
            v-else
            class="size-4"
          />
          <UiText
            variant="sm"
            class="truncate"
          >
            {{ child.name }}
          </UiText>
        </Button>
      </div>
    </div>
  </div>
</template>
