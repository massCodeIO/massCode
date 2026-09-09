<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { i18n } from '@/electron'
import { Trash2 } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    fill?: boolean
    context?: Pick<
      ReturnType<typeof useHttpRuntime>,
      'draft' | 'saving' | 'removeExtraction' | 'fieldError' | 'touchField'
    >
  }>(),
  { fill: true },
)
const { currentRequest } = useHttpRequests()
const { draft, saving, removeExtraction } = props.context ?? useHttpRuntime()
const unavailable = computed(
  () => !props.context && currentRequest.value?.runtimeState !== 'ready',
)
const rowsElement = useTemplateRef<HTMLElement>('rows')
async function addExtraction() {
  draft.value.extractions.push({ name: '', source: 'json', path: '' })
  await nextTick()
  rowsElement.value?.lastElementChild?.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
  })
}
</script>

<template>
  <fieldset
    :disabled="unavailable || saving"
    class="flex min-h-0 flex-col disabled:opacity-50"
    :class="{ 'flex-1': fill }"
  >
    <section
      class="flex min-h-0 flex-col"
      :class="{ 'flex-1': fill }"
    >
      <div class="mb-1 flex h-7 shrink-0 items-center">
        <UiText variant="sm">
          {{ i18n.t("spaces.http.runtime.postResponse") }}
        </UiText>
      </div>
      <UiText
        as="p"
        variant="xs"
        class="mb-3 shrink-0"
        muted
      >
        {{ i18n.t("spaces.http.runtime.extractionHint") }}
      </UiText>
      <div
        ref="rows"
        class="scrollbar min-h-0 space-y-1 overflow-y-auto"
      >
        <div
          v-for="(rule, index) in draft.extractions"
          :key="index"
          class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2 [&>div]:w-full [&>div]:min-w-0"
        >
          <HttpRuntimeInput
            v-model="rule.name"
            :context="context"
            group="extractions"
            :index="index"
            field="name"
            :placeholder="i18n.t('spaces.http.runtime.variableName')"
            :label="i18n.t('spaces.http.runtime.variableName')"
          />
          <Select.Select
            v-model="rule.source"
            :disabled="unavailable || saving"
          >
            <Select.SelectTrigger
              class="h-7 w-full min-w-0"
              :aria-label="i18n.t('spaces.http.runtime.source')"
            >
              <Select.SelectValue />
            </Select.SelectTrigger>
            <Select.SelectContent>
              <Select.SelectItem value="json">
                {{ i18n.t("spaces.http.runtime.sources.json") }}
              </Select.SelectItem>
              <Select.SelectItem value="header">
                {{ i18n.t("spaces.http.runtime.sources.header") }}
              </Select.SelectItem>
            </Select.SelectContent>
          </Select.Select>
          <HttpRuntimeInput
            v-model="rule.path"
            :context="context"
            group="extractions"
            :index="index"
            field="path"
            :placeholder="
              i18n.t(
                rule.source === 'json'
                  ? 'spaces.http.runtime.pointer'
                  : 'spaces.http.runtime.header',
              )
            "
            :label="i18n.t('spaces.http.runtime.path')"
          />
          <UiActionButton
            :tooltip="i18n.t('spaces.http.runtime.remove')"
            @click="removeExtraction(index)"
          >
            <Trash2 class="size-4" />
          </UiActionButton>
        </div>
      </div>
      <UiEditableTableFooter>
        <HttpAddRowButton
          :label="i18n.t('spaces.http.runtime.addExtraction')"
          :disabled="unavailable || saving || draft.extractions.length >= 100"
          @click="addExtraction"
        />
      </UiEditableTableFooter>
    </section>
  </fieldset>
</template>
