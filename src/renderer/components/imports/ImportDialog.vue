<script setup lang="ts">
import type {
  ImportApplyResponse,
  ImportPreviewInput,
  ImportPreviewResponse,
} from '@/services/api/generated'
import type { ImportMarkdownFolderResponse } from '~/main/types/ipc'
import * as Alert from '@/components/ui/shadcn/alert'
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { Input } from '@/components/ui/shadcn/input'
import {
  markPersistedStorageMutation,
  useFolders,
  useImportDialog,
  useNoteFolders,
  useNotes,
  useNoteTags,
  useSnippets,
  useSonner,
  useTags,
} from '@/composables'
import { i18n, ipc } from '@/electron'
import { router, RouterName } from '@/router'
import { api } from '@/services/api'
import { AlertTriangle } from 'lucide-vue-next'

type ImportSource = ImportPreviewResponse['source']
type ImportFile = NonNullable<ImportPreviewInput['files']>[number]
type ImportSpace = NonNullable<ImportPreviewInput['space']>

const { importDialogSpace, isImportDialogOpen } = useImportDialog()
const { sonner } = useSonner()

const fileInputRef = ref<HTMLInputElement>()
const files = ref<ImportFile[]>([])
const fileReadWarnings = ref<ImportPreviewResponse['warnings']>([])
const gistUrl = ref('')
const preview = ref<ImportPreviewResponse | null>(null)
const lastSummary = ref<ImportApplyResponse | null>(null)
const errorMessage = ref('')
const isPreviewing = ref(false)
const isApplying = ref(false)
const isDraggingOver = ref(false)

const hasImportableItems = computed(
  () =>
    !!preview.value && (preview.value.snippets > 0 || preview.value.notes > 0),
)

const previewWarnings = computed(() => [
  ...fileReadWarnings.value,
  ...(preview.value?.warnings ?? []),
])

const isNotesImport = computed(() => importDialogSpace.value === 'notes')

const fileAccept = computed(() =>
  isNotesImport.value
    ? '.md,text/markdown,text/plain'
    : '.json,.code-snippets,application/json',
)

const detectedSourceLabel = computed(() =>
  preview.value ? i18n.t(`imports.sources.${preview.value.source}`) : '',
)

const importTitle = computed(() =>
  i18n.t(`imports.title.${importDialogSpace.value}`),
)

const importDescription = computed(() =>
  i18n.t(`imports.description.${importDialogSpace.value}`),
)

watch(isImportDialogOpen, (isOpen) => {
  if (isOpen)
    return

  resetDialog()
})

watch(importDialogSpace, () => {
  resetDialog()
})

function resetDialog() {
  files.value = []
  fileReadWarnings.value = []
  gistUrl.value = ''
  preview.value = null
  lastSummary.value = null
  errorMessage.value = ''
  isDraggingOver.value = false
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function openFilePicker(event?: Event) {
  if (event?.currentTarget instanceof HTMLElement) {
    event.currentTarget.blur()
  }

  if (isNotesImport.value) {
    void openMarkdownFolderPicker()
    return
  }

  fileInputRef.value?.click()
}

function getImportFileName(file: File): string {
  return (
    (file as File & { webkitRelativePath?: string }).webkitRelativePath
    || file.name
  )
}

async function readFile(file: File): Promise<ImportFile> {
  return {
    content: await file.text(),
    name: file.name,
    relativePath: getImportFileName(file),
  }
}

function toFileReadWarning(
  file: File,
): ImportPreviewResponse['warnings'][number] {
  return {
    message: i18n.t('imports.fileReadWarning'),
    source: getImportFileName(file),
  }
}

function toImportFile(
  file: ImportMarkdownFolderResponse['files'][number],
): ImportFile {
  return {
    content: file.content,
    name: file.name,
    relativePath: file.relativePath,
  }
}

async function getImportErrorMessage(error: unknown): Promise<string> {
  const response = (error as { response?: Response } | null)?.response
  if (response) {
    try {
      const data = await response.clone().json()
      if (
        data
        && typeof data === 'object'
        && 'message' in data
        && typeof data.message === 'string'
      ) {
        return data.message
      }
    }
    catch {
      // Fall back to generic error handling below.
    }
  }

  return error instanceof Error ? error.message : i18n.t('imports.error')
}

function getImportPayload(source?: ImportSource): ImportPreviewInput {
  const basePayload: Pick<ImportPreviewInput, 'source' | 'space'> = {
    ...(source ? { source } : {}),
    space: importDialogSpace.value as ImportSpace,
  }

  if (!isNotesImport.value && gistUrl.value.trim()) {
    return {
      ...basePayload,
      url: gistUrl.value.trim(),
    }
  }

  return {
    ...basePayload,
    files: files.value,
  }
}

async function previewImport(source?: ImportSource) {
  errorMessage.value = ''
  lastSummary.value = null
  isPreviewing.value = true
  try {
    const { data } = await api.imports.postImportsPreview(
      getImportPayload(source),
    )
    preview.value = data
  }
  catch (error) {
    preview.value = null
    errorMessage.value = await getImportErrorMessage(error)
  }
  finally {
    isPreviewing.value = false
  }
}

async function previewGistImport() {
  files.value = []
  fileReadWarnings.value = []
  await previewImport()
}

async function previewFiles(selectedFiles: File[]) {
  if (!selectedFiles.length)
    return

  errorMessage.value = ''
  const results = await Promise.allSettled(selectedFiles.map(readFile))
  const readableFiles: ImportFile[] = []
  const warnings: ImportPreviewResponse['warnings'] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      readableFiles.push(result.value)
      return
    }

    warnings.push(toFileReadWarning(selectedFiles[index]))
  })

  gistUrl.value = ''
  files.value = readableFiles
  fileReadWarnings.value = warnings

  if (!readableFiles.length) {
    preview.value = null
    errorMessage.value = i18n.t('imports.noReadableFiles')
    return
  }

  await previewImport()
}

async function openMarkdownFolderPicker() {
  errorMessage.value = ''
  gistUrl.value = ''
  const result = await ipc.invoke<null, ImportMarkdownFolderResponse>(
    'fs:import-markdown-folder',
    null,
  )

  if (result.canceled) {
    return
  }

  files.value = result.files.map(toImportFile)
  fileReadWarnings.value = result.warnings

  if (!files.value.length) {
    preview.value = null
    errorMessage.value = result.warnings.length
      ? i18n.t('imports.noReadableFiles')
      : i18n.t('imports.noImportableFiles')
    return
  }

  await previewImport()
}

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  await previewFiles(Array.from(input.files ?? []))
}

async function onDrop(event: DragEvent) {
  isDraggingOver.value = false

  await previewFiles(Array.from(event.dataTransfer?.files ?? []))
}

async function refreshImportedSpace(summary: ImportApplyResponse) {
  if (summary.source === 'obsidian') {
    const noteFolders = useNoteFolders()
    const notes = useNotes()
    const noteTags = useNoteTags()

    await router.push({ name: RouterName.notesSpace })
    await noteFolders.getNoteFolders()
    await notes.getNotes()
    await noteTags.getNoteTags()
    return
  }

  const folders = useFolders()
  const snippets = useSnippets()
  const tags = useTags()

  await router.push({ name: RouterName.main })
  await folders.getFolders(false)
  await snippets.getSnippets()
  await tags.getTags()
}

async function applyImport() {
  if (!preview.value || !hasImportableItems.value)
    return

  errorMessage.value = ''
  isApplying.value = true
  try {
    markPersistedStorageMutation()
    const { data } = await api.imports.postImportsApply(
      getImportPayload(preview.value.source),
    )
    lastSummary.value = data
    await refreshImportedSpace(data)
    sonner({
      message: i18n.t('imports.imported', {
        notes: data.notes,
        snippets: data.snippets,
      }),
      type: 'success',
    })
    isImportDialogOpen.value = false
  }
  catch (error) {
    errorMessage.value = await getImportErrorMessage(error)
  }
  finally {
    isApplying.value = false
  }
}
</script>

<template>
  <Dialog.Dialog v-model:open="isImportDialogOpen">
    <Dialog.DialogContent
      class="max-h-[calc(100vh-4rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-5 overflow-hidden sm:max-w-xl"
      @open-auto-focus="(e) => e.preventDefault()"
      @close-auto-focus="(e) => e.preventDefault()"
    >
      <Dialog.DialogHeader class="space-y-1.5 pr-8">
        <Dialog.DialogTitle class="text-base leading-6">
          {{ importTitle }}
        </Dialog.DialogTitle>
        <Dialog.DialogDescription class="max-w-[46rem] text-xs leading-5">
          {{ importDescription }}
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>

      <div class="flex min-h-0 flex-col gap-3 overflow-hidden">
        <template v-if="!isNotesImport">
          <input
            ref="fileInputRef"
            type="file"
            :accept="fileAccept"
            multiple
            class="hidden"
            @change="onFilesSelected"
          >

          <button
            type="button"
            class="border-border bg-muted/20 hover:bg-muted/30 focus-visible:ring-ring w-full rounded-md border border-dashed p-3 text-left transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2"
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
                  {{ i18n.t("imports.filesTitle") }}
                </UiText>
                <UiText
                  as="p"
                  variant="xs"
                  muted
                  class="max-w-[32rem]"
                >
                  {{ i18n.t("imports.fileHint") }}
                </UiText>
              </div>
              <Button
                variant="outline"
                class="shrink-0"
                :disabled="isPreviewing || isApplying"
                @click.stop="openFilePicker"
              >
                {{ i18n.t("imports.chooseFiles") }}
              </Button>
            </div>
          </button>

          <div class="space-y-2">
            <UiText
              as="div"
              variant="xs"
              muted
              weight="medium"
            >
              {{ i18n.t("imports.gistUrl") }}
            </UiText>
            <div class="flex gap-2">
              <div class="min-w-0 flex-1 p-0.5">
                <Input
                  v-model="gistUrl"
                  :placeholder="i18n.t('imports.gistUrlPlaceholder')"
                  :disabled="isPreviewing || isApplying"
                  @keydown.enter.prevent="previewGistImport"
                />
              </div>
              <Button
                variant="outline"
                :disabled="!gistUrl.trim() || isPreviewing || isApplying"
                @click="previewGistImport"
              >
                {{ i18n.t("imports.preview") }}
              </Button>
            </div>
          </div>
        </template>

        <template v-else>
          <input
            ref="fileInputRef"
            type="file"
            :accept="fileAccept"
            webkitdirectory
            multiple
            class="hidden"
            @change="onFilesSelected"
          >

          <button
            type="button"
            class="border-border bg-muted/20 hover:bg-muted/30 focus-visible:ring-ring w-full rounded-md border border-dashed p-3 text-left transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2"
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
                  {{ i18n.t("imports.folderTitle") }}
                </UiText>
                <UiText
                  as="p"
                  variant="xs"
                  muted
                  class="max-w-[32rem]"
                >
                  {{ i18n.t("imports.folderHint") }}
                </UiText>
              </div>
              <Button
                variant="outline"
                class="shrink-0"
                :disabled="isPreviewing || isApplying"
                @click.stop="openFilePicker"
              >
                {{ i18n.t("imports.chooseFolder") }}
              </Button>
            </div>
          </button>
        </template>

        <div
          v-if="isPreviewing"
          class="text-muted-foreground text-xs"
        >
          {{ i18n.t("imports.previewing") }}
        </div>

        <div
          v-if="preview"
          class="flex min-h-0 flex-1 flex-col gap-3"
        >
          <div class="border-border rounded-md border px-3 py-2">
            <UiText
              as="div"
              variant="xs"
              muted
              weight="medium"
            >
              {{ i18n.t("imports.detectedSource") }}
            </UiText>
            <UiText
              as="div"
              variant="sm"
              weight="medium"
            >
              {{ detectedSourceLabel }}
            </UiText>
          </div>

          <div class="grid shrink-0 grid-cols-3 gap-2">
            <div class="border-border rounded-md border px-3 py-2">
              <UiText
                as="div"
                variant="xs"
                muted
                weight="medium"
              >
                {{ i18n.t("imports.snippets") }}
              </UiText>
              <UiText
                as="div"
                variant="lg"
                weight="semibold"
              >
                {{ preview.snippets }}
              </UiText>
            </div>
            <div class="border-border rounded-md border px-3 py-2">
              <UiText
                as="div"
                variant="xs"
                muted
                weight="medium"
              >
                {{ i18n.t("imports.notes") }}
              </UiText>
              <UiText
                as="div"
                variant="lg"
                weight="semibold"
              >
                {{ preview.notes }}
              </UiText>
            </div>
            <div class="border-border rounded-md border px-3 py-2">
              <UiText
                as="div"
                variant="xs"
                muted
                weight="medium"
              >
                {{ i18n.t("imports.tags") }}
              </UiText>
              <UiText
                as="div"
                variant="lg"
                weight="semibold"
              >
                {{ preview.tags.length }}
              </UiText>
            </div>
          </div>

          <div
            v-if="preview.folders.length"
            class="flex min-h-0 flex-1 flex-col gap-1"
          >
            <UiText
              as="div"
              variant="xs"
              muted
              weight="medium"
            >
              {{ i18n.t("common.folders") }}
            </UiText>
            <div
              class="border-border divide-border scrollbar min-h-0 flex-1 overflow-y-auto rounded-md border"
            >
              <div
                v-for="folder in preview.folders"
                :key="folder.path"
                class="flex items-center justify-between px-3 py-2"
              >
                <UiText
                  as="div"
                  variant="sm"
                  weight="medium"
                  class="truncate"
                >
                  {{ folder.path }}
                </UiText>
                <UiText
                  as="div"
                  variant="xs"
                  muted
                  class="ml-3 shrink-0"
                >
                  {{
                    i18n.t("imports.folderMeta", {
                      count: folder.snippets,
                    })
                  }}
                </UiText>
              </div>
            </div>
          </div>

          <Alert.Alert
            v-if="previewWarnings.length"
            class="border-warning/45 bg-warning/10 text-foreground"
          >
            <AlertTriangle class="text-warning" />
            <Alert.AlertTitle>
              {{ i18n.t("imports.warnings") }}
            </Alert.AlertTitle>
            <Alert.AlertDescription class="text-foreground/80">
              <ul class="max-h-28 space-y-1 overflow-y-auto">
                <li
                  v-for="(warning, index) in previewWarnings"
                  :key="`${warning.source}-${index}`"
                  class="text-xs leading-5"
                >
                  <span class="font-medium">{{ warning.source }}</span>:
                  {{ warning.message }}
                </li>
              </ul>
            </Alert.AlertDescription>
          </Alert.Alert>
        </div>

        <div
          v-if="lastSummary"
          class="text-muted-foreground text-xs"
        >
          {{
            i18n.t("imports.createdFolder", {
              name: lastSummary.createdRootFolderName,
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
          @click="isImportDialogOpen = false"
        >
          {{ i18n.t("action.close") }}
        </Button>
        <Button
          :disabled="!hasImportableItems || isApplying || isPreviewing"
          @click="applyImport"
        >
          {{
            isApplying ? i18n.t("imports.importing") : i18n.t("imports.import")
          }}
        </Button>
      </Dialog.DialogFooter>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
