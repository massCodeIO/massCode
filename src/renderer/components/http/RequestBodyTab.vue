<script setup lang="ts">
import type { HttpRequestDraft } from '@/composables'
import type { HttpBodyType } from '~/main/types/http'
import * as Select from '@/components/ui/shadcn/select'
import { useHttpSettings } from '@/composables'
import { i18n } from '@/electron'

const draft = defineModel<HttpRequestDraft>({ required: true })
const { settings } = useHttpSettings()

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

const FORM_DATA_COLUMNS = [
  {
    key: 'key',
    label: i18n.t('spaces.http.editor.keyValue.key'),
    placeholder: i18n.t('spaces.http.editor.keyValue.key'),
  },
  {
    key: 'type',
    label: i18n.t('spaces.http.editor.body.fieldType.text'),
    width: '120px',
  },
  {
    key: 'value',
    label: i18n.t('spaces.http.editor.keyValue.value'),
    placeholder: i18n.t('spaces.http.editor.keyValue.value'),
  },
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
  return { key: '', type: 'text', value: '' }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
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

    <HttpBodyEditor
      v-if="
        bodyType === 'json'
          || bodyType === 'text'
          || bodyType === 'form-urlencoded'
      "
      v-model="bodyText"
      :language="bodyType"
      :wrap-lines="settings.wrapLines"
      :placeholder="i18n.t('spaces.http.editor.body.placeholder')"
      class="min-h-0 flex-1"
    />

    <div
      v-else-if="bodyType === 'multipart'"
      class="min-h-0 flex-1"
    >
      <HttpKeyValueTable
        v-model="draft.formData"
        :columns="FORM_DATA_COLUMNS"
        :show-enabled="false"
        actions="delete"
        grid-template-columns="1fr 120px 1fr 24px"
        :create-entry="addFormDataRow"
      >
        <template #cell-type="{ entry }">
          <Select.Select v-model="entry.type">
            <Select.SelectTrigger class="!h-6 w-full">
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
        </template>
        <template #cell-value="{ entry, column }">
          <UiInput
            v-model="entry.value"
            class="!h-6"
            variant="ghost"
            :placeholder="
              entry.type === 'file'
                ? i18n.t('spaces.http.editor.body.filePlaceholder')
                : column.placeholder
            "
          />
        </template>
      </HttpKeyValueTable>
    </div>
  </div>
</template>
