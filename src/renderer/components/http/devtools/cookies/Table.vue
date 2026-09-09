<script setup lang="ts">
import type { EditableColumn } from '@/components/ui/editable-table/types'
import type { useHttpCookies } from '@/composables/spaces/http/devtools/useHttpCookies'
import type { HttpCookie } from '~/shared/httpCookies'
import { Button } from '@/components/ui/shadcn/button'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import { Field, FieldLabel } from '@/components/ui/shadcn/field'
import { Textarea } from '@/components/ui/shadcn/textarea'
import { i18n } from '@/electron'
import { CodeXml, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  rows: HttpCookie[]
  busy: boolean
  updateCookie: ReturnType<typeof useHttpCookies>['updateCookie']
  saveRaw: ReturnType<typeof useHttpCookies>['saveRaw']
  removeCookie: (id: string) => Promise<void>
}>()
const textFields = ['name', 'value', 'domain', 'path'] as const
const flags = ['secure', 'httpOnly'] as const
const columns: EditableColumn<HttpCookie>[] = [
  ...textFields.map(key => ({
    key,
    label: i18n.t(`spaces.http.devtools.${key}`),
    editable: true,
    width: key === 'path' ? '70px' : 'minmax(90px,1fr)',
  })),
  {
    key: 'expires',
    label: i18n.t('spaces.http.devtools.expires'),
    width: '170px',
  },
  ...flags.map(key => ({
    key,
    label: i18n.t(`spaces.http.devtools.${key}`),
    width: key === 'secure' ? '56px' : '66px',
  })),
  { key: 'actions', label: '', width: '56px' },
]
const id = useId()
const rawId = ref<string | null>(null)
const raw = ref('')
watch(
  () => props.rows,
  (rows) => {
    if (rawId.value && !rows.some(row => row.id === rawId.value))
      rawId.value = null
  },
)
function rowKey(cookie: HttpCookie) {
  return cookie.id
}
function replaceRow(cookie: HttpCookie) {
  return cookie.id === rawId.value
}
function openRaw(cookie: HttpCookie) {
  raw.value = cookie.raw
  rawId.value = cookie.id
}
async function save(cookie: HttpCookie) {
  if (await props.saveRaw(cookie, raw.value))
    rawId.value = null
}
function commit(
  cookie: HttpCookie,
  column: EditableColumn<HttpCookie>,
  value: string,
) {
  return props.updateCookie(cookie, { [column.key]: value })
}
</script>

<template>
  <UiEditableTable
    class="min-w-[850px]"
    :rows="rows"
    :columns="columns"
    :row-key="rowKey"
    :label="i18n.t('spaces.http.devtools.cookies')"
    :empty-text="i18n.t('spaces.http.devtools.noCookies')"
    :disabled="busy"
    :commit="commit"
    :replace-row="replaceRow"
  >
    <template #cell-expires="{ row }">
      <UiDateTimePicker
        :id="`${id}-${row.id}`"
        :model-value="row.expires ?? ''"
        variant="ghost"
        :label="i18n.t('spaces.http.devtools.expires')"
        :placeholder="i18n.t('spaces.http.devtools.sessionCookie')"
        :time-label="i18n.t('spaces.http.devtools.cookieTime')"
        :clear-label="i18n.t('spaces.http.devtools.clearExpiry')"
        :disabled="busy"
        @update:model-value="(expires) => updateCookie(row, { expires })"
      />
    </template>
    <template
      v-for="flag in flags"
      :key="flag"
      #[`cell-${flag}`]="{ row }"
    >
      <Checkbox
        :model-value="row[flag]"
        :aria-label="i18n.t(`spaces.http.devtools.${flag}`)"
        :disabled="busy"
        @update:model-value="
          (value) => updateCookie(row, { [flag]: value === true })
        "
      />
    </template>
    <template #cell-actions="{ row }">
      <div class="flex items-center">
        <UiActionButton
          :tooltip="i18n.t('spaces.http.devtools.cookieRaw')"
          :aria-label="i18n.t('spaces.http.devtools.cookieRaw')"
          :disabled="busy"
          @click="openRaw(row)"
        >
          <CodeXml class="size-3.5" />
        </UiActionButton>
        <UiActionButton
          :tooltip="i18n.t('spaces.http.devtools.deleteCookie')"
          :aria-label="i18n.t('spaces.http.devtools.deleteCookie')"
          :disabled="busy"
          @click="removeCookie(row.id)"
        >
          <Trash2 class="size-3.5" />
        </UiActionButton>
      </div>
    </template>
    <template #row-editor="{ row }">
      <form
        class="space-y-2 py-2"
        @submit.prevent="save(row)"
        @keydown.esc.stop="rawId = null"
      >
        <Field class="gap-1">
          <FieldLabel
            :for="`${id}-raw`"
            class="text-xs"
          >
            {{ i18n.t("spaces.http.devtools.cookieString") }}
          </FieldLabel>
          <Textarea
            :id="`${id}-raw`"
            v-model="raw"
            class="h-20 min-h-0 resize-y font-mono"
            :disabled="busy"
          />
        </Field>
        <div class="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            :disabled="busy"
            @click="rawId = null"
          >
            {{ i18n.t("spaces.http.devtools.cancelCookie") }}
          </Button>
          <Button
            type="submit"
            variant="default"
            size="sm"
            :disabled="busy || !raw.trim()"
          >
            {{ i18n.t("spaces.http.devtools.saveCookie") }}
          </Button>
        </div>
      </form>
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </UiEditableTable>
</template>
