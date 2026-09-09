<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { i18n } from '@/electron'
import { Trash2 } from 'lucide-vue-next'
import {
  httpOperatorNeedsExpected,
  httpAssertionOperators as operators,
} from '~/shared/httpRuntime'

const props = withDefaults(
  defineProps<{
    fill?: boolean
    disabled: boolean
    context?: Pick<
      ReturnType<typeof useHttpRuntime>,
      | 'draft'
      | 'expectedInputs'
      | 'setExpected'
      | 'removeAssertion'
      | 'fieldError'
      | 'touchField'
    >
  }>(),
  { fill: true },
)
const { draft, expectedInputs, setExpected, removeAssertion }
  = props.context ?? useHttpRuntime()
const sources = ['status', 'json', 'header', 'durationMs'] as const

function expectedPlaceholder(operator: string) {
  const hint = ['in', 'notIn'].includes(operator)
    ? 'list'
    : operator === 'between'
      ? 'range'
      : ['matches', 'notMatches'].includes(operator)
          ? 'regex'
          : operator === 'length'
            ? 'length'
            : null
  return i18n.t(
    hint
      ? `spaces.http.runtime.expectedHints.${hint}`
      : 'spaces.http.runtime.expected',
  )
}
const rowsElement = useTemplateRef<HTMLElement>('rows')
async function addAssertion() {
  draft.value.assertions.push({
    name: '',
    source: 'status',
    operator: 'eq',
    expected: 200,
  })
  await nextTick()
  rowsElement.value?.lastElementChild?.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
  })
}
</script>

<template>
  <section
    class="flex min-h-0 flex-col"
    :class="{ 'h-full': fill }"
  >
    <div class="mb-1 flex h-7 shrink-0 items-center">
      <UiText variant="sm">
        {{ i18n.t("spaces.http.runtime.assertions") }}
      </UiText>
    </div>
    <div
      ref="rows"
      class="scrollbar min-h-0 space-y-2 overflow-y-auto"
      :class="{ 'flex-1': fill }"
    >
      <template
        v-for="(rule, index) in draft.assertions"
        :key="index"
      >
        <div class="border-border space-y-1 rounded-md border p-2">
          <div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <HttpRuntimeInput
              v-model="rule.name"
              :context="context"
              group="assertions"
              :index="index"
              field="name"
              :placeholder="i18n.t('spaces.http.runtime.assertionName')"
              :label="i18n.t('spaces.http.runtime.assertionName')"
            />
            <UiActionButton
              :tooltip="i18n.t('spaces.http.runtime.remove')"
              @click="removeAssertion(index)"
            >
              <Trash2 class="size-4" />
            </UiActionButton>
          </div>
          <div
            class="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] items-start gap-2 [&>div]:w-full [&>div]:min-w-0"
          >
            <Select.Select
              v-model="rule.source"
              :disabled="disabled"
            >
              <Select.SelectTrigger
                class="h-7 w-full min-w-0"
                :aria-label="i18n.t('spaces.http.runtime.source')"
              >
                <Select.SelectValue />
              </Select.SelectTrigger>
              <Select.SelectContent>
                <Select.SelectItem
                  v-for="source in sources"
                  :key="source"
                  :value="source"
                >
                  {{ i18n.t(`spaces.http.runtime.sources.${source}`) }}
                </Select.SelectItem>
              </Select.SelectContent>
            </Select.Select>
            <HttpRuntimeInput
              v-if="rule.source === 'json' || rule.source === 'header'"
              v-model="rule.path"
              :context="context"
              group="assertions"
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
            <Select.Select
              v-model="rule.operator"
              :disabled="disabled"
            >
              <Select.SelectTrigger
                class="h-7 w-full min-w-0"
                :aria-label="i18n.t('spaces.http.runtime.operator')"
              >
                <Select.SelectValue />
              </Select.SelectTrigger>
              <Select.SelectContent>
                <Select.SelectItem
                  v-for="operator in operators"
                  :key="operator"
                  :value="operator"
                >
                  {{ i18n.t(`spaces.http.runtime.operators.${operator}`) }}
                </Select.SelectItem>
              </Select.SelectContent>
            </Select.Select>
            <HttpRuntimeInput
              v-if="httpOperatorNeedsExpected(rule.operator)"
              :context="context"
              group="assertions"
              :index="index"
              field="expected"
              :model-value="
                expectedInputs[index] ?? JSON.stringify(rule.expected) ?? ''
              "
              :placeholder="expectedPlaceholder(rule.operator)"
              :label="i18n.t('spaces.http.runtime.expected')"
              @update:model-value="setExpected(index, $event!)"
            />
          </div>
        </div>
      </template>
    </div>
    <UiEditableTableFooter>
      <HttpAddRowButton
        :label="i18n.t('spaces.http.runtime.addAssertion')"
        :disabled="disabled || draft.assertions.length >= 100"
        @click="addAssertion"
      />
    </UiEditableTableFooter>
  </section>
</template>
