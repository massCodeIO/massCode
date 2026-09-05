<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useHttpEnvironments } from '@/composables/spaces/http/useHttpEnvironments'
import { useHttpExecute } from '@/composables/spaces/http/useHttpExecute'
import { useHttpSession } from '@/composables/spaces/http/useHttpSession'
import { useSonner } from '@/composables/useSonner'
import { i18n } from '@/electron'
import { Braces } from 'lucide-vue-next'
import {
  HTTP_SECRET_MASK,
  maskHttpSecretVariables,
} from '~/shared/httpVariables'

const open = ref(false)
const clearing = ref(false)
const { activeEnvironment } = useHttpEnvironments()
const { sessionNames, refreshHttpSessionNames, clearHttpSession }
  = useHttpSession()
const { resetHttpExecuteState } = useHttpExecute()
const { sonner } = useSonner()
const environmentVariables = computed(() =>
  activeEnvironment.value
    ? maskHttpSecretVariables(
        activeEnvironment.value.variables as Record<string, string>,
        activeEnvironment.value.secretKeys,
      )
    : {},
)

watch(open, async (value) => {
  if (!value)
    return
  try {
    await refreshHttpSessionNames()
  }
  catch {
    sonner({
      type: 'error',
      message: i18n.t('spaces.http.runtime.sessionReadError'),
    })
  }
})

async function clearSession() {
  clearing.value = true
  resetHttpExecuteState()
  try {
    await clearHttpSession()
  }
  catch {
    sonner({
      type: 'error',
      message: i18n.t('spaces.http.runtime.sessionClearError'),
    })
  }
  finally {
    clearing.value = false
  }
}
</script>

<template>
  <UiActionButton
    :tooltip="i18n.t('spaces.http.runtime.variablesInspector')"
    @click="open = true"
  >
    <Braces class="size-4" />
  </UiActionButton>
  <Dialog.Dialog v-model:open="open">
    <Dialog.DialogContent
      class="sm:max-w-lg"
      @open-auto-focus="(e) => e.preventDefault()"
      @close-auto-focus="(e) => e.preventDefault()"
    >
      <Dialog.DialogHeader>
        <Dialog.DialogTitle>
          {{ i18n.t("spaces.http.runtime.variablesInspector") }}
        </Dialog.DialogTitle>
        <Dialog.DialogDescription>
          {{ i18n.t("spaces.http.runtime.scopesHint") }}
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>
      <div class="scrollbar max-h-[60vh] space-y-4 overflow-y-auto">
        <section class="space-y-2">
          <UiText
            variant="sm"
            weight="medium"
          >
            {{ i18n.t("spaces.http.runtime.environmentScope") }} ·
            {{
              activeEnvironment?.name ?? i18n.t("spaces.http.environments.none")
            }}
          </UiText>
          <UiText
            v-if="!Object.keys(environmentVariables).length"
            as="p"
            variant="xs"
            muted
          >
            {{ i18n.t("spaces.http.runtime.noVariables") }}
          </UiText>
          <div
            v-for="(value, name) in environmentVariables"
            :key="name"
            class="border-border grid grid-cols-2 gap-2 border-b py-1.5"
          >
            <div class="min-w-0">
              <UiText
                as="p"
                variant="xs"
                class="font-mono break-all"
              >
                {{ name }}
              </UiText>
              <UiText
                v-if="sessionNames.includes(name)"
                as="p"
                variant="caption"
                muted
              >
                {{ i18n.t("spaces.http.runtime.overridden") }}
              </UiText>
            </div>
            <UiText
              variant="xs"
              class="font-mono break-all"
              :class="
                sessionNames.includes(name)
                  ? 'text-muted-foreground line-through'
                  : ''
              "
            >
              {{ value }}
            </UiText>
          </div>
        </section>
        <section class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <UiText
              variant="sm"
              weight="medium"
            >
              {{ i18n.t("spaces.http.runtime.session") }}
            </UiText>
            <Button
              variant="outline"
              :disabled="clearing || !sessionNames.length"
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
            v-if="!sessionNames.length"
            as="p"
            variant="xs"
            muted
          >
            {{ i18n.t("spaces.http.runtime.noVariables") }}
          </UiText>
          <div
            v-for="name in sessionNames"
            :key="name"
            class="border-border grid grid-cols-2 gap-2 border-b py-1.5"
          >
            <UiText
              variant="xs"
              class="font-mono break-all"
            >
              {{ name }}
            </UiText>
            <UiText
              variant="xs"
              class="font-mono"
            >
              {{ HTTP_SECRET_MASK }}
            </UiText>
          </div>
        </section>
      </div>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
