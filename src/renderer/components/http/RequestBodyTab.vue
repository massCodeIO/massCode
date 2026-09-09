<script setup lang="ts">
import type { HttpRequestDraft } from '@/composables'
import type { HttpBodyType, HttpFormDataEntry } from '~/main/types/http'
import * as Select from '@/components/ui/shadcn/select'
import { useHttpSettings } from '@/composables'
import { i18n, ipc } from '@/electron'
import { readHttpFormEntries } from '~/shared/httpForm'

const draft = defineModel<HttpRequestDraft>({ required: true })
const { settings } = useHttpSettings()

const BODY_TYPES: { value: HttpBodyType, labelKey: string }[] = [
  { value: 'binary', labelKey: 'spaces.http.editor.body.typeBinary' },
  { value: 'none', labelKey: 'spaces.http.editor.body.typeNone' },
  { value: 'graphql', labelKey: 'spaces.http.graphql.title' },
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
  {
    key: 'description',
    label: i18n.t('spaces.http.editor.keyValue.description'),
    placeholder: i18n.t('spaces.http.editor.keyValue.description'),
  },
]

const formEntries = ref<HttpFormDataEntry[]>([])
watch(
  () => [draft.value.body, draft.value.formData] as const,
  () => {
    const entries = readHttpFormEntries(draft.value.body, draft.value.formData)
    if (JSON.stringify(entries) !== JSON.stringify(formEntries.value))
      formEntries.value = entries.map(entry => ({ ...entry }))
  },
  { immediate: true, deep: true },
)
watch(
  formEntries,
  (entries) => {
    if (draft.value.bodyType !== 'form-urlencoded')
      return
    if (
      JSON.stringify(entries)
      === JSON.stringify(
        readHttpFormEntries(draft.value.body, draft.value.formData),
      )
    ) {
      return
    }
    draft.value.formData = entries.map(entry => ({ ...entry }))
    draft.value.body = null
  },
  { deep: true },
)

const bodyType = computed({
  get: () => draft.value.bodyType,
  set: (value) => {
    const previous = draft.value.bodyType
    if (
      previous !== value
      && (value === 'multipart' || value === 'form-urlencoded')
    ) {
      draft.value.body = null
    }
    draft.value.bodyType = value
    if (value === 'graphql') {
      draft.value.method = 'POST'
      draft.value.body = JSON.stringify({
        query: '',
        variables: '{}',
        operationName: '',
      })
    }
  },
})

const bodyText = computed({
  get: () => draft.value.body ?? '',
  set: (value) => {
    draft.value.body = value
  },
})

async function chooseFile(entry?: HttpFormDataEntry) {
  const path = await ipc.invoke('main-menu:open-dialog', {
    properties: ['openFile'],
  })
  if (!path)
    return
  if (entry)
    entry.value = path
  else bodyText.value = path
}

function addFormDataRow(): HttpFormDataEntry {
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

    <HttpGraphqlEditor
      v-if="bodyType === 'graphql'"
      v-model="draft.body"
    />
    <HttpBodyEditor
      v-if="bodyType === 'json' || bodyType === 'text'"
      v-model="bodyText"
      :language="bodyType"
      :wrap-lines="settings.wrapLines"
      :placeholder="i18n.t('spaces.http.editor.body.placeholder')"
      class="min-h-0 flex-1"
    />

    <div
      v-if="bodyType === 'binary'"
      class="flex gap-2"
    >
      <UiInput
        v-model="bodyText"
        class="flex-1"
        :placeholder="i18n.t('spaces.http.editor.body.filePlaceholder')"
      />
      <UiButton
        variant="outline"
        @click="chooseFile()"
      >
        {{ i18n.t("spaces.http.editor.body.chooseFile") }}
      </UiButton>
    </div>
    <HttpKeyValueTable
      v-else-if="bodyType === 'form-urlencoded'"
      v-model="formEntries"
      :create-entry="addFormDataRow"
    />
    <div
      v-else-if="bodyType === 'multipart'"
      class="min-h-0 flex-1"
    >
      <HttpKeyValueTable
        v-model="draft.formData"
        :fill="false"
        :columns="FORM_DATA_COLUMNS"
        actions="delete"
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
          <div class="flex gap-1">
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
            <UiButton
              v-if="entry.type === 'file'"
              variant="ghost"
              @click="chooseFile(entry)"
            >
              {{ i18n.t("spaces.http.editor.body.chooseFile") }}
            </UiButton>
          </div>
        </template>
      </HttpKeyValueTable>
    </div>
  </div>
</template>
