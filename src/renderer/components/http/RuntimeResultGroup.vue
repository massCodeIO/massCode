<script setup lang="ts">
import type { HttpRuntimeResult } from '~/shared/httpRuntime'
import { i18n } from '@/electron'
import { CircleCheck, CircleX } from 'lucide-vue-next'

defineProps<{
  kind: 'assertions' | 'extractions'
  results: HttpRuntimeResult[]
}>()
</script>

<template>
  <section
    v-if="results.length"
    class="space-y-2"
  >
    <div class="flex items-center gap-2 px-1">
      <UiText
        variant="xs"
        weight="medium"
        muted
      >
        {{
          i18n.t(
            kind === "assertions"
              ? "spaces.http.runtime.assertions"
              : "spaces.http.runtime.extractionResults",
          )
        }}
      </UiText>
      <UiText
        variant="caption"
        muted
        class="tabular-nums"
      >
        {{ results.length }}
      </UiText>
    </div>
    <ul
      class="border-border divide-border divide-y overflow-hidden rounded-md border"
    >
      <li
        v-for="(result, index) in results"
        :key="index"
        class="flex items-start gap-3 px-3 py-2.5"
        :class="{ 'bg-destructive/5': !result.ok }"
      >
        <CircleCheck
          v-if="result.ok"
          class="text-success mt-0.5 size-4 shrink-0"
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
              ? 'bg-success/10 text-success'
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
</template>
