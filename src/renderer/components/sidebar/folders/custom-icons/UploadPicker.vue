<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { i18n } from '@/electron'
import { useObjectUrl } from '@vueuse/core'
import { ImageUp } from 'lucide-vue-next'

const props = defineProps<{
  isUploading: boolean
}>()

const emit = defineEmits<{
  error: [key: string]
  select: [file: File]
}>()

const fileInputRef = ref<HTMLInputElement>()
const selectedFile = shallowRef<File>()
const previewUrl = useObjectUrl(selectedFile)

function validateAndSelect(file?: File) {
  if (!file || props.isUploading)
    return

  if (!/\.(?:jpe?g|png)$/i.test(file.name)) {
    emit('error', 'folder.iconPicker.errors.unsupportedFormat')
    return
  }

  if (file.size > 10 * 1024 * 1024) {
    emit('error', 'folder.iconPicker.errors.fileTooLarge')
    return
  }

  selectedFile.value = file
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  validateAndSelect(input.files?.[0])
  input.value = ''
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  validateAndSelect(event.dataTransfer?.files[0])
}

function onUpload() {
  if (selectedFile.value && !props.isUploading)
    emit('select', selectedFile.value)
}
</script>

<template>
  <div
    class="border-border bg-muted/20 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center"
    @dragover.prevent
    @drop="onDrop"
    @keydown.enter.stop
  >
    <input
      ref="fileInputRef"
      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
      class="hidden"
      type="file"
      @change="onFileSelected"
    >
    <template v-if="previewUrl && selectedFile">
      <img
        alt=""
        class="size-32 rounded-lg object-cover"
        :src="previewUrl"
      >
      <UiText
        as="div"
        class="max-w-full truncate"
        variant="xs"
        muted
      >
        {{ selectedFile.name }}
      </UiText>
      <div class="flex gap-2">
        <Button
          :disabled="isUploading"
          type="button"
          variant="outline"
          @click="fileInputRef?.click()"
        >
          {{ i18n.t("folder.iconPicker.replaceImage") }}
        </Button>
        <Button
          :disabled="isUploading"
          type="button"
          @click="onUpload"
        >
          {{
            i18n.t(
              isUploading
                ? "folder.iconPicker.uploading"
                : "folder.iconPicker.applyImage",
            )
          }}
        </Button>
      </div>
    </template>
    <template v-else>
      <div class="bg-muted flex size-11 items-center justify-center rounded-lg">
        <ImageUp class="text-muted-foreground size-5" />
      </div>
      <div class="space-y-1">
        <UiText
          as="div"
          variant="sm"
          weight="medium"
        >
          {{ i18n.t("folder.iconPicker.uploadTitle") }}
        </UiText>
        <UiText
          as="div"
          variant="xs"
          muted
        >
          {{ i18n.t("folder.iconPicker.uploadHint") }}
        </UiText>
      </div>
      <Button
        type="button"
        variant="outline"
        @click="fileInputRef?.click()"
      >
        {{ i18n.t("folder.iconPicker.uploadImage") }}
      </Button>
    </template>
  </div>
</template>
