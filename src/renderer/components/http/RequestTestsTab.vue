<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/shadcn/native-select'
import { useHttpExecute } from '@/composables/spaces/http/useHttpExecute'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { useHttpSession } from '@/composables/spaces/http/useHttpSession'
import { i18n } from '@/electron'
import { Plus, Trash2 } from 'lucide-vue-next'

const { currentRequest } = useHttpRequests()
const {
  draft,
  dirty,
  valid,
  saving,
  saveError,
  conflict,
  saveRuntime,
  expectedInputs,
  expectedErrors,
  setExpected,
  removeAssertion,
} = useHttpRuntime()
const { sessionNames, clearHttpSession, refreshHttpSessionNames }
  = useHttpSession()
const { resetHttpExecuteState } = useHttpExecute()
const unavailable = computed(
  () => currentRequest.value?.runtimeState !== 'ready',
)
const operators = [
  'eq',
  'neq',
  'exists',
  'contains',
  'gt',
  'gte',
  'lt',
  'lte',
] as const
const sources = ['status', 'json', 'header', 'durationMs'] as const

async function clearSession() {
  resetHttpExecuteState()
  await clearHttpSession()
}

onMounted(() => {
  void refreshHttpSessionNames()
})
</script>

<template>
  <div class="space-y-4 pb-2">
    <div class="flex items-center justify-between gap-3">
      <UiText
        as="p"
        variant="xs"
        muted
      >
        {{ i18n.t("spaces.http.runtime.hint") }}
      </UiText>
      <Button
        :disabled="unavailable || !dirty || !valid || saving"
        @click="saveRuntime"
      >
        {{ i18n.t("spaces.http.runtime.save") }}
      </Button>
    </div>
    <UiText
      v-if="unavailable"
      variant="sm"
      class="text-destructive"
    >
      {{
        i18n.t(
          `spaces.http.runtime.states.${currentRequest?.runtimeState ?? "pending"}`,
        )
      }}
    </UiText>
    <UiText
      v-else-if="saveError || !valid"
      variant="sm"
      class="text-destructive"
    >
      {{
        i18n.t(
          conflict
            ? "spaces.http.runtime.conflict"
            : saveError
              ? "spaces.http.runtime.saveError"
              : "spaces.http.runtime.invalidRules",
        )
      }}
    </UiText>
    <UiText
      v-else-if="dirty"
      variant="caption"
    >
      {{ i18n.t("spaces.http.runtime.unsaved") }}
    </UiText>
    <fieldset
      :disabled="unavailable || saving"
      class="space-y-4 disabled:opacity-50"
    >
      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <UiText variant="sm">
            {{ i18n.t("spaces.http.runtime.extractions") }}
          </UiText>
          <UiActionButton
            :tooltip="i18n.t('spaces.http.runtime.addExtraction')"
            @click="
              draft.extractions.push({ name: '', source: 'json', path: '' })
            "
          >
            <Plus class="size-4" />
          </UiActionButton>
        </div>
        <div
          v-for="(rule, index) in draft.extractions"
          :key="index"
          class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2 [&>div]:w-full [&>div]:min-w-0"
        >
          <UiInput
            v-model="rule.name"
            class="h-7"
            :placeholder="i18n.t('spaces.http.runtime.variableName')"
            :aria-label="i18n.t('spaces.http.runtime.variableName')"
          />
          <NativeSelect
            v-model="rule.source"
            class="h-7 px-2 py-0 pr-9"
            :aria-label="i18n.t('spaces.http.runtime.source')"
          >
            <NativeSelectOption value="json">
              {{ i18n.t("spaces.http.runtime.sources.json") }}
            </NativeSelectOption>
            <NativeSelectOption value="header">
              {{ i18n.t("spaces.http.runtime.sources.header") }}
            </NativeSelectOption>
          </NativeSelect>
          <UiInput
            v-model="rule.path"
            class="h-7"
            :placeholder="
              i18n.t(
                rule.source === 'json'
                  ? 'spaces.http.runtime.pointer'
                  : 'spaces.http.runtime.header',
              )
            "
            :aria-label="i18n.t('spaces.http.runtime.path')"
          />
          <UiActionButton
            :tooltip="i18n.t('spaces.http.runtime.remove')"
            @click="draft.extractions.splice(index, 1)"
          >
            <Trash2 class="size-4" />
          </UiActionButton>
        </div>
      </section>
      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <UiText variant="sm">
            {{ i18n.t("spaces.http.runtime.assertions") }}
          </UiText>
          <UiActionButton
            :tooltip="i18n.t('spaces.http.runtime.addAssertion')"
            @click="
              draft.assertions.push({
                name: '',
                source: 'status',
                operator: 'eq',
                expected: 200,
              })
            "
          >
            <Plus class="size-4" />
          </UiActionButton>
        </div>
        <div
          v-for="(rule, index) in draft.assertions"
          :key="index"
          class="border-border space-y-2 rounded-md border p-2"
        >
          <div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <UiInput
              v-model="rule.name"
              class="h-7 w-full min-w-0"
              :placeholder="i18n.t('spaces.http.runtime.assertionName')"
              :aria-label="i18n.t('spaces.http.runtime.assertionName')"
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
            <NativeSelect
              v-model="rule.source"
              class="h-7 px-2 py-0 pr-9"
              :aria-label="i18n.t('spaces.http.runtime.source')"
            >
              <NativeSelectOption
                v-for="source in sources"
                :key="source"
                :value="source"
              >
                {{ i18n.t(`spaces.http.runtime.sources.${source}`) }}
              </NativeSelectOption>
            </NativeSelect>
            <UiInput
              v-if="rule.source === 'json' || rule.source === 'header'"
              v-model="rule.path"
              class="h-7 w-full min-w-0"
              :placeholder="
                i18n.t(
                  rule.source === 'json'
                    ? 'spaces.http.runtime.pointer'
                    : 'spaces.http.runtime.header',
                )
              "
              :aria-label="i18n.t('spaces.http.runtime.path')"
            />
            <NativeSelect
              v-model="rule.operator"
              class="h-7 px-2 py-0 pr-9"
              :aria-label="i18n.t('spaces.http.runtime.operator')"
            >
              <NativeSelectOption
                v-for="operator in operators"
                :key="operator"
                :value="operator"
              >
                {{ i18n.t(`spaces.http.runtime.operators.${operator}`) }}
              </NativeSelectOption>
            </NativeSelect>
            <UiInput
              v-if="rule.operator !== 'exists'"
              :model-value="
                expectedInputs[index] ?? JSON.stringify(rule.expected) ?? ''
              "
              class="h-7 w-full min-w-0"
              :error="
                expectedErrors[index]
                  ? i18n.t('spaces.http.runtime.expectedError')
                  : undefined
              "
              :placeholder="i18n.t('spaces.http.runtime.expected')"
              :aria-label="i18n.t('spaces.http.runtime.expected')"
              @update:model-value="setExpected(index, $event!)"
            />
          </div>
        </div>
      </section>
    </fieldset>
    <section class="border-border space-y-2 border-t pt-3">
      <div class="flex items-center justify-between">
        <UiText variant="sm">
          {{ i18n.t("spaces.http.runtime.session") }}
        </UiText>
        <Button
          variant="outline"
          @click="clearSession"
        >
          {{ i18n.t("spaces.http.runtime.clearSession") }}
        </Button>
      </div>
      <UiText
        as="p"
        variant="xs"
        muted
      >
        {{ i18n.t("spaces.http.runtime.sessionHint") }}
      </UiText>
      <UiText
        v-for="name in sessionNames"
        :key="name"
        variant="xs"
        class="font-mono"
      >
        {{ name }}: ••••••••
      </UiText>
    </section>
  </div>
</template>
