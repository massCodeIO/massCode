<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useHttpRunner } from '@/composables/spaces/http/useHttpRunner'
import { i18n } from '@/electron'
import { LoaderCircle, Play, Square } from 'lucide-vue-next'

const {
  open,
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

function focusRun(event: Event) {
  event.preventDefault()
  const content = event.target as HTMLElement
  content
    .querySelector<HTMLButtonElement>('[data-run-start]')
    ?.focus({ preventScroll: true })
}

onBeforeUnmount(() => {
  closeRunner()
  clearRunnerView()
})
</script>

<template>
  <Dialog.Dialog
    :open="open"
    @update:open="!$event && closeRunner()"
  >
    <Dialog.DialogContent
      class="flex max-h-[85vh] flex-col sm:max-w-2xl"
      @interact-outside.prevent
      @after-leave="clearRunnerView"
      @open-auto-focus="focusRun"
    >
      <Dialog.DialogHeader>
        <Dialog.DialogTitle>
          {{ i18n.t("spaces.http.runner.title") }} ·
          {{ view?.folderName }}
        </Dialog.DialogTitle>
        <Dialog.DialogDescription>
          {{
            i18n.t("spaces.http.runner.description")
          }}
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>
      <div
        v-if="view"
        class="flex min-h-0 flex-1 flex-col gap-3"
      >
        <div class="flex items-center justify-between gap-3">
          <UiText
            variant="xs"
            muted
          >
            {{ i18n.t("spaces.http.runner.environment") }}:
            {{
              view.environmentName ?? i18n.t("spaces.http.environments.none")
            }}
          </UiText>
          <UiText
            variant="xs"
            role="status"
          >
            {{ i18n.t(`spaces.http.runner.states.${view.state}`) }} ·
            {{ completed }}/{{ view.steps.length }}
          </UiText>
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
      <Dialog.DialogFooter>
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
      </Dialog.DialogFooter>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
