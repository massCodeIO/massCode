<script setup lang="ts">
import { useHttpRunner } from '@/composables/spaces/http/useHttpRunner'
import { i18n } from '@/electron'
import { Circle, CircleCheck, CircleX, LoaderCircle } from 'lucide-vue-next'
import Draggable from 'vuedraggable'

const { view, running, reorderSteps } = useHttpRunner()
const canReorder = computed(
  () => view.value?.state === 'ready' && !running.value,
)
</script>

<template>
  <Draggable
    :model-value="view?.steps ?? []"
    item-key="requestId"
    :disabled="!canReorder"
    :animation="200"
    :force-fallback="true"
    :fallback-on-body="true"
    :fallback-tolerance="3"
    ghost-class="http-runner-placeholder"
    fallback-class="http-runner-drag"
    @update:model-value="reorderSteps"
  >
    <template #item="{ element: step, index }">
      <div
        class="border-border bg-background border-b last:border-b-0 [&.http-runner-drag]:shadow-md"
        :class="{
          'cursor-grab select-none active:cursor-grabbing': canReorder,
        }"
      >
        <div
          class="flex items-center gap-2 px-3 py-2.5"
          :class="{ 'bg-destructive/5': step.state === 'failed' }"
        >
          <LoaderCircle
            v-if="step.state === 'running'"
            class="text-muted-foreground size-4 shrink-0 animate-spin"
          />
          <CircleCheck
            v-else-if="step.state === 'passed'"
            class="text-success size-4 shrink-0"
          />
          <CircleX
            v-else-if="step.state === 'failed'"
            class="text-destructive size-4 shrink-0"
          />
          <Circle
            v-else
            class="text-muted-foreground size-4 shrink-0"
          />
          <UiText
            variant="xs"
            muted
          >
            {{ index + 1 }}
          </UiText>
          <HttpMethodBadge
            :method="step.method"
            size="sm"
            appearance="chip"
          />
          <div class="min-w-0 flex-1">
            <UiText
              as="p"
              variant="sm"
              class="truncate"
            >
              {{ step.name }}
            </UiText>
            <UiText
              as="p"
              variant="caption"
              muted
              class="truncate"
            >
              {{ step.folderPath }}
            </UiText>
          </div>
          <UiText
            variant="xs"
            weight="medium"
            class="shrink-0 rounded px-1.5 py-0.5"
            :class="{
              'bg-destructive/10 text-destructive': step.state === 'failed',
              'bg-success/10 text-success': step.state === 'passed',
              'bg-muted text-muted-foreground': !['passed', 'failed'].includes(
                step.state,
              ),
            }"
          >
            {{ i18n.t(`spaces.http.runner.steps.${step.state}`) }}
          </UiText>
          <UiText
            v-if="step.status != null"
            variant="xs"
            class="font-mono"
          >
            {{ step.status }}
          </UiText>
          <UiText
            v-if="step.durationMs != null"
            variant="xs"
            muted
          >
            {{ step.durationMs }} ms
          </UiText>
        </div>
        <UiText
          v-if="step.error"
          as="p"
          variant="xs"
          class="text-muted-foreground px-3 pb-2.5"
        >
          {{ i18n.t(`spaces.http.runner.stepErrors.${step.error}`) }}
        </UiText>
        <div
          v-if="step.assertions?.length || step.extractions?.length"
          class="space-y-4 border-t p-3"
        >
          <HttpRuntimeResultGroup
            kind="assertions"
            :results="step.assertions ?? []"
          />
          <HttpRuntimeResultGroup
            kind="extractions"
            :results="step.extractions ?? []"
          />
        </div>
      </div>
    </template>
  </Draggable>
</template>

<style scoped>
.http-runner-placeholder {
  background: var(--muted);
}

.http-runner-placeholder > * {
  visibility: hidden;
}

.http-runner-drag {
  /* Sortable sets an inline opacity on the fallback clone. */
  opacity: 1 !important;
}
</style>
