<script setup lang="ts">
import { getJsonDiffFontVariables } from '@/components/devtools/compare/fontVariables'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import { useEditor, useJsonDiff } from '@/composables'
import { i18n } from '@/electron'

const { settings: editorSettings } = useEditor()
const {
  leftText,
  rightText,
  leftError,
  rightError,
  viewerError,
  filters,
  nodes,
  isReady,
  showEmptyState,
  scheduleLeftFormat,
  scheduleRightFormat,
  formatLeftOnBlur,
  formatRightOnBlur,
  toggleExpanded,
  isExpanded,
} = useJsonDiff()

const title = computed(() => i18n.t('devtools:compare.jsonDiff.label'))
const description = computed(() =>
  i18n.t('devtools:compare.jsonDiff.description'),
)
const fontVariables = computed(() => getJsonDiffFontVariables(editorSettings))
const leftTargetScrollTop = ref(0)
const leftTargetScrollLeft = ref(0)
const rightTargetScrollTop = ref(0)
const rightTargetScrollLeft = ref(0)

const filterButtons = computed(() => {
  return [
    {
      key: 'added' as const,
      label: i18n.t('devtools:compare.jsonDiff.filters.added'),
    },
    {
      key: 'removed' as const,
      label: i18n.t('devtools:compare.jsonDiff.filters.removed'),
    },
    {
      key: 'modified' as const,
      label: i18n.t('devtools:compare.jsonDiff.filters.modified'),
    },
  ]
})

function setFilter(
  key: 'added' | 'removed' | 'modified',
  value: boolean | 'indeterminate',
) {
  filters.value[key] = value === true
}

function localizedError(errorKey: string) {
  if (!errorKey)
    return ''

  return i18n.t(`devtools:compare.jsonDiff.errors.${errorKey}`)
}

function syncLeftEditorScroll(position: { top: number, left: number }) {
  rightTargetScrollTop.value = position.top
  rightTargetScrollLeft.value = position.left
}

function syncRightEditorScroll(position: { top: number, left: number }) {
  leftTargetScrollTop.value = position.top
  leftTargetScrollLeft.value = position.left
}
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col gap-6"
    :style="fontVariables"
  >
    <UiHeading
      :title="title"
      :description="description"
    />

    <div class="flex shrink-0 flex-wrap items-center gap-4">
      <label
        v-for="button in filterButtons"
        :key="button.key"
        class="flex cursor-pointer items-center gap-2"
      >
        <Checkbox
          :model-value="filters[button.key]"
          @update:model-value="setFilter(button.key, $event)"
        />
        <UiText as="span">
          {{ button.label }}
        </UiText>
      </label>
    </div>

    <div class="grid shrink-0 gap-3 md:grid-cols-2">
      <div class="space-y-2">
        <UiHeading
          :title="i18n.t('devtools:compare.jsonDiff.original')"
          :level="3"
        />
        <DevtoolsCompareJsonDiffInput
          v-model="leftText"
          :placeholder="i18n.t('devtools:form.placeholder.text')"
          :error="localizedError(leftError)"
          :scroll-top="leftTargetScrollTop"
          :scroll-left="leftTargetScrollLeft"
          @paste="scheduleLeftFormat"
          @blur="formatLeftOnBlur"
          @scroll="syncLeftEditorScroll"
        />
      </div>
      <div class="space-y-2">
        <UiHeading
          :title="i18n.t('devtools:compare.jsonDiff.modified')"
          :level="3"
        />
        <DevtoolsCompareJsonDiffInput
          v-model="rightText"
          :placeholder="i18n.t('devtools:form.placeholder.text')"
          :error="localizedError(rightError)"
          :scroll-top="rightTargetScrollTop"
          :scroll-left="rightTargetScrollLeft"
          @paste="scheduleRightFormat"
          @blur="formatRightOnBlur"
          @scroll="syncRightEditorScroll"
        />
      </div>
    </div>

    <UiText
      v-if="viewerError"
      as="div"
      class="text-destructive"
    >
      {{ localizedError(viewerError) }}
    </UiText>

    <DevtoolsCompareJsonDiffViewer
      v-else-if="isReady"
      class="min-h-0 flex-1"
      :nodes="nodes"
      :is-expanded="isExpanded"
      @toggle="toggleExpanded"
    />

    <UiText
      v-else-if="showEmptyState"
      as="div"
      muted
      class="flex flex-1 items-center justify-center py-8 text-center"
    >
      {{ i18n.t("devtools:compare.jsonDiff.empty") }}
    </UiText>
  </div>
</template>
