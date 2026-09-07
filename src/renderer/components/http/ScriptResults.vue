<script setup lang="ts">
import type { HttpScriptResult } from '~/shared/httpScripts'
import { i18n } from '@/electron'
import { CircleCheck, CircleX } from 'lucide-vue-next'

defineProps<{ results: HttpScriptResult[] }>()
</script>

<template>
  <section
    v-for="(result, index) in results"
    :key="index"
    class="space-y-2"
  >
    <UiText
      variant="xs"
      weight="medium"
      muted
    >
      {{
        i18n.t(`spaces.http.collection.sources.${result.source ?? "request"}`)
      }}
      · {{ i18n.t(`spaces.http.scripts.${result.phase}`) }}
    </UiText>
    <UiText
      v-if="result.error"
      as="p"
      variant="xs"
      class="text-destructive"
    >
      {{ i18n.t(`spaces.http.scripts.errors.${result.error}`) }}
    </UiText>
    <UiText
      v-else-if="!result.tests.length"
      as="p"
      variant="xs"
      class="text-success"
    >
      {{ i18n.t("spaces.http.runtime.passed") }}
    </UiText>
    <ul
      v-if="result.tests.length"
      class="border-border divide-border divide-y rounded-md border"
    >
      <li
        v-for="(test, testIndex) in result.tests"
        :key="testIndex"
        class="flex items-start gap-3 px-3 py-2.5"
      >
        <CircleCheck
          v-if="test.ok"
          class="text-success size-4 shrink-0"
        />
        <CircleX
          v-else
          class="text-destructive size-4 shrink-0"
        />
        <UiText
          variant="sm"
          class="break-all"
        >
          {{ test.name }}
        </UiText>
      </li>
    </ul>
  </section>
</template>
