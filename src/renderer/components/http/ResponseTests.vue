<script setup lang="ts">
import { useHttpExecute } from '@/composables'
import { i18n } from '@/electron'
import { CircleCheck, CircleX } from 'lucide-vue-next'

const { lastResponse } = useHttpExecute()
const groups = computed(() =>
  [
    {
      key: 'assertions' as const,
      results: lastResponse.value?.runtimeResults?.assertions ?? [],
    },
    {
      key: 'extractions' as const,
      results: lastResponse.value?.runtimeResults?.extractions ?? [],
    },
  ].filter(group => group.results.length),
)
const results = computed(
  () => lastResponse.value?.runtimeResults?.assertions ?? [],
)
const passed = computed(
  () => results.value.filter(result => result.ok).length,
)
const failed = computed(() => results.value.length - passed.value)
</script>

<template>
  <div class="space-y-4 p-3">
    <div
      v-if="results.length"
      class="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2.5"
    >
      <div class="flex items-center gap-2">
        <CircleX
          v-if="failed"
          class="text-destructive size-4 shrink-0"
          aria-hidden="true"
        />
        <CircleCheck
          v-else
          class="text-success size-4 shrink-0"
          aria-hidden="true"
        />
        <UiText
          variant="sm"
          weight="medium"
        >
          {{ i18n.t("spaces.http.runtime.testResults") }}
        </UiText>
        <UiText
          variant="xs"
          muted
          class="tabular-nums"
        >
          {{ passed }}/{{ results.length }}
        </UiText>
      </div>
      <div class="flex items-center gap-3">
        <UiText
          variant="xs"
          class="text-success tabular-nums"
        >
          {{ passed }} {{ i18n.t("spaces.http.runtime.passed") }}
        </UiText>
        <UiText
          variant="xs"
          :class="failed ? 'text-destructive' : 'text-muted-foreground'"
          class="tabular-nums"
        >
          {{ failed }} {{ i18n.t("spaces.http.runtime.failed") }}
        </UiText>
      </div>
    </div>

    <HttpRuntimeResultGroup
      v-for="group in groups"
      :key="group.key"
      :kind="group.key"
      :results="group.results"
    />
  </div>
</template>
