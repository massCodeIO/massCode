<script setup lang="ts">
import { useHttpExecute } from '@/composables'
import { i18n } from '@/electron'
import { CircleCheck, CircleX } from 'lucide-vue-next'

const { lastResponse } = useHttpExecute()
const groups = computed(() =>
  [
    {
      key: 'assertions',
      results: lastResponse.value?.runtimeResults?.assertions ?? [],
    },
    {
      key: 'extractions',
      results: lastResponse.value?.runtimeResults?.extractions ?? [],
    },
  ].filter(group => group.results.length),
)
const results = computed(() => groups.value.flatMap(group => group.results))
const passed = computed(
  () => results.value.filter(result => result.ok).length,
)
const failed = computed(() => results.value.length - passed.value)
</script>

<template>
  <div class="space-y-4 p-3">
    <div
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
          class="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
        <UiText
          variant="sm"
          weight="medium"
        >
          {{ i18n.t("spaces.http.runtime.tests") }}
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
          class="text-emerald-600 tabular-nums dark:text-emerald-400"
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

    <section
      v-for="group in groups"
      :key="group.key"
      class="space-y-2"
    >
      <div class="flex items-center gap-2 px-1">
        <UiText
          variant="xs"
          weight="medium"
          muted
        >
          {{ i18n.t(`spaces.http.runtime.${group.key}`) }}
        </UiText>
        <UiText
          variant="caption"
          muted
          class="tabular-nums"
        >
          {{ group.results.length }}
        </UiText>
      </div>
      <ul
        class="border-border divide-border divide-y overflow-hidden rounded-md border"
      >
        <li
          v-for="(result, index) in group.results"
          :key="index"
          class="flex items-start gap-3 px-3 py-2.5"
          :class="{ 'bg-destructive/5': !result.ok }"
        >
          <CircleCheck
            v-if="result.ok"
            class="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          <CircleX
            v-else
            class="text-destructive mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1 space-y-1">
            <UiText
              as="p"
              variant="sm"
              class="break-words"
            >
              {{ result.name }}
            </UiText>
            <UiText
              v-if="result.errorCode"
              as="p"
              variant="xs"
              muted
              class="break-words"
            >
              {{ i18n.t(`spaces.http.runtime.errors.${result.errorCode}`) }}
            </UiText>
          </div>
          <UiText
            variant="caption"
            weight="medium"
            class="mt-0.5 shrink-0 rounded px-1.5 py-0.5"
            :class="
              result.ok
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/10 text-destructive'
            "
          >
            {{
              i18n.t(
                result.ok
                  ? "spaces.http.runtime.passed"
                  : "spaces.http.runtime.failed",
              )
            }}
          </UiText>
        </li>
      </ul>
    </section>
  </div>
</template>
