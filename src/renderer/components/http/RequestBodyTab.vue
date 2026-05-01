<script setup lang="ts">
import type { HttpRequestDraft } from '@/composables'
import type { HttpBodyType } from '~/main/types/http'
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import { Textarea } from '@/components/ui/shadcn/textarea'
import { i18n } from '@/electron'
import { Plus, Trash2 } from 'lucide-vue-next'

const draft = defineModel<HttpRequestDraft>({ required: true })

const BODY_TYPES: { value: HttpBodyType, labelKey: string }[] = [
  { value: 'none', labelKey: 'spaces.http.editor.body.typeNone' },
  { value: 'json', labelKey: 'spaces.http.editor.body.typeJson' },
  { value: 'text', labelKey: 'spaces.http.editor.body.typeText' },
  {
    value: 'form-urlencoded',
    labelKey: 'spaces.http.editor.body.typeFormUrlencoded',
  },
  { value: 'multipart', labelKey: 'spaces.http.editor.body.typeMultipart' },
]

const bodyType = computed({
  get: () => draft.value.bodyType,
  set: (value) => {
    draft.value.bodyType = value
  },
})

const bodyText = computed({
  get: () => draft.value.body ?? '',
  set: (value) => {
    draft.value.body = value
  },
})

function addFormDataRow() {
  draft.value.formData.push({ key: '', type: 'text', value: '' })
}

function removeFormDataRow(index: number) {
  draft.value.formData.splice(index, 1)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center">
      <Select.Select v-model="bodyType">
        <Select.SelectTrigger class="w-48">
          <Select.SelectValue />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem
            v-for="t in BODY_TYPES"
            :key="t.value"
            :value="t.value"
          >
            {{ i18n.t(t.labelKey) }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
    </div>

    <Textarea
      v-if="
        bodyType === 'json'
          || bodyType === 'text'
          || bodyType === 'form-urlencoded'
      "
      v-model="bodyText"
      class="min-h-40 font-mono"
      :placeholder="i18n.t('spaces.http.editor.body.placeholder')"
    />

    <div
      v-else-if="bodyType === 'multipart'"
      class="flex flex-col"
    >
      <div
        class="text-muted-foreground border-border grid grid-cols-[1fr_120px_1fr_24px] items-center gap-2 border-b px-2 py-1.5 text-[10px] font-semibold tracking-wider uppercase"
      >
        <span>{{ i18n.t("spaces.http.editor.keyValue.key") }}</span>
        <span>{{ i18n.t("spaces.http.editor.body.fieldType.text") }}</span>
        <span>{{ i18n.t("spaces.http.editor.keyValue.value") }}</span>
        <span />
      </div>
      <div
        v-for="(entry, index) in draft.formData"
        :key="index"
        class="border-border hover:bg-accent-hover grid grid-cols-[1fr_120px_1fr_24px] items-center gap-2 border-b px-2 py-1"
      >
        <UiInput
          v-model="entry.key"
          class="!h-7 font-mono"
          variant="ghost"
          :placeholder="i18n.t('spaces.http.editor.keyValue.key')"
        />
        <Select.Select v-model="entry.type">
          <Select.SelectTrigger class="!h-7 w-full">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem value="text">
              {{ i18n.t("spaces.http.editor.body.fieldType.text") }}
            </Select.SelectItem>
            <Select.SelectItem value="file">
              {{ i18n.t("spaces.http.editor.body.fieldType.file") }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <UiInput
          v-model="entry.value"
          class="!h-7 font-mono"
          variant="ghost"
          :placeholder="
            entry.type === 'file'
              ? i18n.t('spaces.http.editor.body.filePlaceholder')
              : i18n.t('spaces.http.editor.keyValue.value')
          "
        />
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-6 w-6 items-center justify-center rounded"
          @click="removeFormDataRow(index)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="text-muted-foreground hover:text-foreground mt-1 inline-flex h-7 w-fit items-center gap-1 rounded px-2 text-xs"
        @click="addFormDataRow"
      >
        <Plus class="h-3.5 w-3.5" />
        {{ i18n.t("spaces.http.editor.keyValue.addRow") }}
      </Button>
    </div>
  </div>
</template>
