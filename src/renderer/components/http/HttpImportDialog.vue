<script setup lang="ts">
import type {
  HttpImportApplyResponse,
  HttpImportPreviewResponse,
} from '@/services/api/generated'
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { markPersistedStorageMutation, useSonner } from '@/composables'
import { i18n } from '@/electron'
import { api } from '@/services/api'

const emit = defineEmits<{
  imported: []
}>()
const open = defineModel<boolean>('open', { required: true })

const fileInputRef = ref<HTMLInputElement>()
const files = ref<Array<{ name: string, content: string }>>([])
const preview = ref<HttpImportPreviewResponse | null>(null)
const lastSummary = ref<HttpImportApplyResponse | null>(null)
const errorMessage = ref('')
const isPreviewing = ref(false)
const isApplying = ref(false)
const isDraggingOver = ref(false)

const { sonner } = useSonner()

const hasImportableItems = computed(() => {
  if (!preview.value)
    return false

  return (
    preview.value.collections.length > 0
    || preview.value.environments.length > 0
  )
})

const totalRequests = computed(
  () =>
    preview.value?.collections.reduce(
      (total, collection) => total + collection.requests,
      0,
    ) ?? 0,
)

watch(open, (isOpen) => {
  if (isOpen)
    return

  files.value = []
  preview.value = null
  lastSummary.value = null
  errorMessage.value = ''
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
})

function openFilePicker() {
  fileInputRef.value?.click()
}

async function readFile(file: File) {
  return {
    content: await file.text(),
    name: file.name,
  }
}

async function previewFiles(selectedFiles: File[]) {
  if (!selectedFiles.length)
    return

  errorMessage.value = ''
  lastSummary.value = null
  isPreviewing.value = true
  try {
    files.value = await Promise.all(selectedFiles.map(readFile))
    const { data } = await api.httpImport.postHttpImportPreview({
      files: files.value,
    })
    preview.value = data
  }
  catch (error) {
    preview.value = null
    errorMessage.value
      = error instanceof Error
        ? error.message
        : i18n.t('spaces.http.import.error')
  }
  finally {
    isPreviewing.value = false
  }
}

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  await previewFiles(Array.from(input.files ?? []))
}

async function onDrop(event: DragEvent) {
  isDraggingOver.value = false
  await previewFiles(Array.from(event.dataTransfer?.files ?? []))
}

async function applyImport() {
  if (!files.value.length || !preview.value)
    return

  errorMessage.value = ''
  isApplying.value = true
  try {
    markPersistedStorageMutation()
    const { data } = await api.httpImport.postHttpImportApply({
      files: files.value,
    })
    lastSummary.value = data
    sonner({
      message: i18n.t('spaces.http.import.imported', {
        collections: data.collections,
        requests: data.requests,
      }),
      type: 'success',
    })
    emit('imported')
    open.value = false
  }
  catch (error) {
    errorMessage.value
      = error instanceof Error
        ? error.message
        : i18n.t('spaces.http.import.error')
  }
  finally {
    isApplying.value = false
  }
}
</script>

<template>
  <Dialog.Dialog v-model:open="open">
    <Dialog.DialogContent
      class="grid-rows-[auto_minmax(0,1fr)_auto] gap-5 overflow-hidden sm:max-w-xl"
      @open-auto-focus="(e) => e.preventDefault()"
      @close-auto-focus="(e) => e.preventDefault()"
    >
      <Dialog.DialogHeader class="space-y-1.5 pr-8">
        <Dialog.DialogTitle class="text-base leading-6">
          {{ i18n.t("spaces.http.import.title") }}
        </Dialog.DialogTitle>
        <Dialog.DialogDescription class="max-w-[46rem] text-xs leading-5">
          {{ i18n.t("spaces.http.import.description") }}
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>

      <div class="min-h-0 space-y-3 overflow-y-auto">
        <input
          ref="fileInputRef"
          type="file"
          accept=".json,application/json"
          multiple
          class="hidden"
          @change="onFilesSelected"
        >

        <button
          type="button"
          class="border-border bg-muted/20 hover:bg-muted/30 focus:ring-ring w-full rounded-md border border-dashed p-3 text-left transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
          :class="isDraggingOver ? 'border-primary bg-muted/40' : ''"
          :disabled="isPreviewing || isApplying"
          @click="openFilePicker"
          @dragenter.prevent="isDraggingOver = true"
          @dragover.prevent="isDraggingOver = true"
          @dragleave.prevent="isDraggingOver = false"
          @drop.prevent="onDrop"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0 space-y-1">
              <UiText
                as="div"
                variant="sm"
                weight="medium"
              >
                {{ i18n.t("spaces.http.import.postman") }}
              </UiText>
              <UiText
                as="p"
                variant="xs"
                muted
                class="max-w-[32rem]"
              >
                {{ i18n.t("spaces.http.import.fileHint") }}
              </UiText>
            </div>
            <Button
              variant="outline"
              class="shrink-0"
              :disabled="isPreviewing || isApplying"
              @click.stop="openFilePicker"
            >
              {{ i18n.t("spaces.http.import.chooseFiles") }}
            </Button>
          </div>
        </button>

        <div
          v-if="isPreviewing"
          class="text-muted-foreground text-xs"
        >
          {{ i18n.t("spaces.http.import.previewing") }}
        </div>

        <div
          v-if="preview"
          class="space-y-3"
        >
          <div class="grid grid-cols-3 gap-2">
            <div class="border-border rounded-md border px-3 py-2">
              <UiText
                as="div"
                variant="xs"
                muted
                weight="medium"
              >
                {{ i18n.t("spaces.http.import.collections") }}
              </UiText>
              <UiText
                as="div"
                variant="lg"
                weight="semibold"
              >
                {{ preview.collections.length }}
              </UiText>
            </div>
            <div class="border-border rounded-md border px-3 py-2">
              <UiText
                as="div"
                variant="xs"
                muted
                weight="medium"
              >
                {{ i18n.t("spaces.http.import.requests") }}
              </UiText>
              <UiText
                as="div"
                variant="lg"
                weight="semibold"
              >
                {{ totalRequests }}
              </UiText>
            </div>
            <div class="border-border rounded-md border px-3 py-2">
              <UiText
                as="div"
                variant="xs"
                muted
                weight="medium"
              >
                {{ i18n.t("spaces.http.import.environments") }}
              </UiText>
              <UiText
                as="div"
                variant="lg"
                weight="semibold"
              >
                {{ preview.environments.length }}
              </UiText>
            </div>
          </div>

          <div
            v-if="preview.collections.length"
            class="space-y-1"
          >
            <UiText
              as="div"
              variant="xs"
              muted
              weight="medium"
            >
              {{ i18n.t("spaces.http.import.collections") }}
            </UiText>
            <div class="border-border divide-border rounded-md border">
              <div
                v-for="collection in preview.collections"
                :key="collection.index"
                class="flex items-center justify-between px-3 py-2"
              >
                <UiText
                  as="div"
                  variant="sm"
                  weight="medium"
                  class="truncate"
                >
                  {{ collection.name }}
                </UiText>
                <UiText
                  as="div"
                  variant="xs"
                  muted
                  class="ml-3 shrink-0"
                >
                  {{
                    i18n.t("spaces.http.import.collectionMeta", {
                      folders: collection.folders,
                      requests: collection.requests,
                    })
                  }}
                </UiText>
              </div>
            </div>
          </div>

          <div
            v-if="preview.environments.length"
            class="space-y-1"
          >
            <UiText
              as="div"
              variant="xs"
              muted
              weight="medium"
            >
              {{ i18n.t("spaces.http.import.environments") }}
            </UiText>
            <div class="border-border divide-border rounded-md border">
              <div
                v-for="environment in preview.environments"
                :key="environment.index"
                class="flex items-center justify-between px-3 py-2"
              >
                <UiText
                  as="div"
                  variant="sm"
                  weight="medium"
                  class="truncate"
                >
                  {{ environment.name }}
                </UiText>
                <UiText
                  as="div"
                  variant="xs"
                  muted
                  class="ml-3 shrink-0"
                >
                  {{
                    i18n.t("spaces.http.import.variablesMeta", {
                      variables: environment.variables,
                    })
                  }}
                </UiText>
              </div>
            </div>
            <UiText
              as="p"
              variant="xs"
              muted
            >
              {{ i18n.t("spaces.http.import.plainTextNotice") }}
            </UiText>
          </div>

          <div
            v-if="preview.warnings.length"
            class="border-border rounded-md border p-2"
          >
            <UiText
              as="div"
              variant="xs"
              muted
              weight="medium"
            >
              {{ i18n.t("spaces.http.import.warnings") }}
            </UiText>
            <ul class="mt-1 max-h-28 space-y-1 overflow-y-auto">
              <li
                v-for="(warning, index) in preview.warnings"
                :key="`${warning.source}-${index}`"
                class="text-muted-foreground text-xs"
              >
                {{ warning.source }}: {{ warning.message }}
              </li>
            </ul>
          </div>
        </div>

        <div
          v-if="lastSummary"
          class="text-muted-foreground text-xs"
        >
          {{
            i18n.t("spaces.http.import.createdFolders", {
              names: lastSummary.createdCollectionNames.join(", "),
            })
          }}
        </div>

        <div
          v-if="errorMessage"
          class="text-destructive text-xs"
        >
          {{ errorMessage }}
        </div>
      </div>

      <Dialog.DialogFooter class="gap-2">
        <Button
          variant="outline"
          :disabled="isApplying"
          @click="open = false"
        >
          {{ i18n.t("action.close") }}
        </Button>
        <Button
          :disabled="!hasImportableItems || isApplying || isPreviewing"
          @click="applyImport"
        >
          {{
            isApplying
              ? i18n.t("spaces.http.import.importing")
              : i18n.t("spaces.http.import.import")
          }}
        </Button>
      </Dialog.DialogFooter>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
