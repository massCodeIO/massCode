<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { Switch } from '@/components/ui/shadcn/switch'
import { useEditor } from '@/composables'
import { i18n } from '@/electron'

const { settings } = useEditor()

const wrap = ref(settings.wrap ? 'true' : 'false')

watch(wrap, () => {
  settings.wrap = wrap.value === 'true'
})

watch(
  settings,
  () => {
    if (settings.fontSize < 1)
      settings.fontSize = 1
  },
  { deep: true },
)
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection :label="i18n.t('preferences:editor.label')">
      <UiMenuFormItem :label="i18n.t('preferences:editor.fontSize.label')">
        <UiInput
          v-model="settings.fontSize"
          type="number"
          size="sm"
        />
        <template #description>
          {{ i18n.t("preferences:editor.fontSize.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:editor.fontFamily.label')">
        <UiInput
          v-model="settings.fontFamily"
          size="sm"
        />
        <template #description>
          {{ i18n.t("preferences:editor.fontFamily.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:editor.tabSize.label')">
        <UiInput
          v-model="settings.tabSize"
          type="number"
          size="sm"
        />
        <template #description>
          {{ i18n.t("preferences:editor.tabSize.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:editor.wrap.label')">
        <Select.Select v-model="wrap">
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem value="true">
              {{ i18n.t("preferences:editor.wrap.wordWrap") }}
            </Select.SelectItem>
            <Select.SelectItem value="false">
              {{ i18n.t("preferences:editor.wrap.off") }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <template #description>
          {{ i18n.t("preferences:editor.wrap.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:editor.highlightLine.label')">
        <Switch
          :checked="settings.highlightLine"
          @update:checked="settings.highlightLine = $event"
        />
        <template #description>
          {{ i18n.t("preferences:editor.highlightLine.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:editor.matchBrackets.label')">
        <Switch
          :checked="settings.matchBrackets"
          @update:checked="settings.matchBrackets = $event"
        />
        <template #description>
          {{ i18n.t("preferences:editor.matchBrackets.description") }}
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
    <UiMenuFormSection :label="i18n.t('preferences:editor.prettier.label')">
      <UiMenuFormItem
        :label="i18n.t('preferences:editor.prettier.trailingComma.label')"
      >
        <Select.Select v-model="settings.trailingComma">
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem value="all">
              {{ i18n.t("preferences:editor.prettier.trailingComma.all") }}
            </Select.SelectItem>
            <Select.SelectItem value="none">
              {{ i18n.t("preferences:editor.prettier.trailingComma.none") }}
            </Select.SelectItem>
            <Select.SelectItem value="es5">
              {{ i18n.t("preferences:editor.prettier.trailingComma.es5") }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <template #description>
          {{ i18n.t("preferences:editor.prettier.trailingComma.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:editor.prettier.semi.label')">
        <Switch
          :checked="settings.semi"
          @update:checked="settings.semi = $event"
        />
        <template #description>
          {{ i18n.t("preferences:editor.prettier.semi.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem
        :label="i18n.t('preferences:editor.prettier.singleQuote.label')"
      >
        <Switch
          :checked="settings.singleQuote"
          @update:checked="settings.singleQuote = $event"
        />
        <template #description>
          {{ i18n.t("preferences:editor.prettier.singleQuote.description") }}
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
