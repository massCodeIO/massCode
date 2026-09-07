<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import { useHttpRunner } from '@/composables/spaces/http/useHttpRunner'
import { i18n } from '@/electron'
import {
  Circle,
  CircleCheck,
  CircleX,
  LoaderCircle,
  Play,
  Square,
} from 'lucide-vue-next'

const {
  preparing,
  running,
  cancelling,
  view,
  folderId,
  continueOnFailure,
  openRunner,
  startRunner,
  cancelRunner,
  closeRunner,
  clearRunnerView,
} = useHttpRunner()
const completed = computed(
  () =>
    view.value?.steps.filter(step =>
      ['passed', 'failed'].includes(step.state),
    ).length ?? 0,
)
const ready = computed(() => view.value?.state === 'ready')
const passed = computed(
  () => view.value?.steps.filter(step => step.state === 'passed').length ?? 0,
)
const failed = computed(
  () => view.value?.steps.filter(step => step.state === 'failed').length ?? 0,
)

onBeforeUnmount(() => {
  closeRunner()
  clearRunnerView()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 p-3">
    <UiText variant="sm">
      {{ i18n.t("spaces.http.runner.title") }} · {{ view?.folderName }}
    </UiText>
    <UiText
      variant="xs"
      muted
    >
      {{ i18n.t("spaces.http.runner.description") }}
    </UiText>
    <div
      v-if="view"
      class="flex min-h-0 flex-1 flex-col gap-3"
    >
      <UiText
        variant="xs"
        muted
      >
        {{ i18n.t("spaces.http.runner.environment") }}:
        {{ view.environmentName ?? i18n.t("spaces.http.environments.none") }}
      </UiText>
      <div
        class="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2.5"
        role="status"
      >
        <div class="flex items-center gap-2">
          <LoaderCircle
            v-if="view.state === 'running'"
            class="text-muted-foreground size-4 shrink-0 animate-spin"
            aria-hidden="true"
          />
          <CircleX
            v-else-if="view.state === 'failed'"
            class="text-destructive size-4 shrink-0"
            aria-hidden="true"
          />
          <CircleCheck
            v-else-if="view.state === 'passed'"
            class="text-success size-4 shrink-0"
            aria-hidden="true"
          />
          <Circle
            v-else
            class="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <UiText
            variant="sm"
            weight="medium"
          >
            {{ i18n.t(`spaces.http.runner.states.${view.state}`) }}
          </UiText>
          <UiText
            variant="xs"
            muted
            class="tabular-nums"
          >
            {{ completed }}/{{ view.steps.length }}
          </UiText>
        </div>
        <div
          v-if="!ready"
          class="flex items-center gap-3"
        >
          <UiText
            variant="xs"
            class="text-success tabular-nums"
          >
            {{ passed }} {{ i18n.t("spaces.http.runtime.passed") }}
          </UiText>
          <UiText
            variant="xs"
            class="tabular-nums"
            :class="failed ? 'text-destructive' : 'text-muted-foreground'"
          >
            {{ failed }} {{ i18n.t("spaces.http.runtime.failed") }}
          </UiText>
        </div>
      </div>
      <UiText
        v-if="ready"
        variant="xs"
        muted
      >
        {{ i18n.t("spaces.http.runner.orderHint") }}
      </UiText>
      <div class="scrollbar min-h-0 flex-1 overflow-y-auto rounded-md border">
        <HttpRunnerSteps />
      </div>
      <label class="flex items-center gap-2">
        <Checkbox
          v-model="continueOnFailure"
          :disabled="!ready || running"
        />
        <UiText variant="sm">{{
          i18n.t("spaces.http.runner.continueOnFailure")
        }}</UiText>
      </label>
    </div>
    <div class="mt-auto flex justify-end gap-2">
      <Button
        variant="outline"
        @click="closeRunner"
      >
        {{ i18n.t("spaces.http.runner.close") }}
      </Button>
      <Button
        v-if="view?.state === 'running'"
        variant="outline"
        :disabled="cancelling"
        @click="cancelRunner"
      >
        <LoaderCircle
          v-if="cancelling"
          class="size-3.5 animate-spin"
        /><Square
          v-else
          class="size-3.5"
        />
        {{ i18n.t("spaces.http.runner.cancel") }}
      </Button>
      <Button
        v-else-if="ready"
        data-run-start
        @click="startRunner"
      >
        <Play class="size-3.5" />{{ i18n.t("spaces.http.runner.start") }}
      </Button>
      <Button
        v-else
        :disabled="preparing || folderId === null"
        @click="folderId !== null && openRunner(folderId)"
      >
        {{ i18n.t("spaces.http.runner.newRun") }}
      </Button>
    </div>
  </div>
</template>
