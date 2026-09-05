<script setup lang="ts">
import { useHttpRunner } from '@/composables/spaces/http/useHttpRunner'
import { i18n } from '@/electron'
import { Check, Circle, GripVertical, LoaderCircle, X } from 'lucide-vue-next'
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
    handle=".http-runner-drag-handle"
    :disabled="!canReorder"
    :animation="200"
    ghost-class="opacity-40"
    @update:model-value="reorderSteps"
  >
    <template #item="{ element: step, index }">
      <div
        class="border-border bg-background border-b px-3 py-2 last:border-b-0"
      >
        <div class="flex items-center gap-2">
          <LoaderCircle
            v-if="step.state === 'running'"
            class="text-muted-foreground size-3.5 shrink-0 animate-spin"
          />
          <Check
            v-else-if="step.state === 'passed'"
            class="text-success size-3.5 shrink-0"
          />
          <X
            v-else-if="step.state === 'failed'"
            class="text-destructive size-3.5 shrink-0"
          />
          <Circle
            v-else
            class="text-muted-foreground size-3.5 shrink-0"
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
            :class="{
              'text-destructive': step.state === 'failed',
              'text-success': step.state === 'passed',
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
          <UiActionButton
            v-if="canReorder"
            class="http-runner-drag-handle cursor-grab active:cursor-grabbing"
            :tooltip="i18n.t('spaces.http.runner.reorder')"
            :aria-label="i18n.t('spaces.http.runner.reorder')"
          >
            <GripVertical class="size-3.5" />
          </UiActionButton>
        </div>
        <UiText
          v-if="step.error"
          as="p"
          variant="xs"
          class="text-destructive mt-1"
        >
          {{ i18n.t(`spaces.http.runner.stepErrors.${step.error}`) }}
        </UiText>
        <div
          v-for="group in ['assertions', 'extractions'] as const"
          :key="group"
        >
          <div
            v-if="step[group]?.length"
            class="mt-2 space-y-1"
          >
            <UiText
              variant="caption"
              muted
            >
              {{
                i18n.t(
                  group === "assertions"
                    ? "spaces.http.runtime.assertions"
                    : "spaces.http.runtime.extractionResults",
                )
              }}
            </UiText>
            <div
              v-for="check in step[group]"
              :key="check.index"
              class="flex items-center gap-2"
            >
              <Check
                v-if="check.ok"
                class="text-success size-3 shrink-0"
              /><X
                v-else
                class="text-destructive size-3 shrink-0"
              />
              <UiText
                variant="xs"
                class="min-w-0 truncate"
              >
                {{ check.name }}
              </UiText>
              <UiText
                v-if="check.errorCode"
                variant="xs"
                muted
              >
                {{ i18n.t(`spaces.http.runtime.errors.${check.errorCode}`) }}
              </UiText>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Draggable>
</template>
