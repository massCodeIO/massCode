<script setup lang="ts">
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { i18n } from '@/electron'

interface Props {
  hasDescendantFolders: boolean
  hasSnippetContents: boolean
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  confirm: [options: { updateDescendantFolders: boolean, updateSnippetContents: boolean }]
}>()
const updateDescendantFolders = ref(false)
const updateSnippetContents = ref(false)

function confirm() {
  emit('confirm', {
    updateDescendantFolders: updateDescendantFolders.value,
    updateSnippetContents: updateSnippetContents.value,
  })
}

watch(open, (isOpen) => {
  if (!isOpen) {
    updateDescendantFolders.value = false
    updateSnippetContents.value = false
  }
})
</script>

<template>
  <Dialog.Dialog v-model:open="open">
    <Dialog.DialogContent class="cursor-default sm:max-w-[425px]">
      <Dialog.DialogHeader>
        <Dialog.DialogTitle>{{ i18n.t('folder.defaultLanguageDialog.title') }}</Dialog.DialogTitle>
      </Dialog.DialogHeader>
      <div class="space-y-3">
        <label v-if="props.hasDescendantFolders" class="flex cursor-pointer items-center gap-2">
          <Checkbox v-model="updateDescendantFolders" />
          <UiText as="span">{{ i18n.t('folder.defaultLanguageDialog.descendantFolders') }}</UiText>
        </label>
        <label v-if="props.hasSnippetContents" class="flex cursor-pointer items-center gap-2">
          <Checkbox v-model="updateSnippetContents" />
          <UiText as="span">{{ i18n.t('folder.defaultLanguageDialog.snippetContents') }}</UiText>
        </label>
      </div>
      <Dialog.DialogFooter>
        <UiButton class="cursor-pointer" variant="outline" @click="open = false">{{ i18n.t('button.cancel') }}</UiButton>
        <UiButton class="cursor-pointer" @click="confirm">{{ i18n.t('button.yes') }}</UiButton>
      </Dialog.DialogFooter>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
