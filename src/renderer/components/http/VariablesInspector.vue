<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Input } from '@/components/ui/shadcn/input'
import { useHttpCollection } from '@/composables/spaces/http/useHttpCollection'
import { useHttpExecute } from '@/composables/spaces/http/useHttpExecute'
import { useHttpPanels } from '@/composables/spaces/http/useHttpPanels'
import { useHttpSession } from '@/composables/spaces/http/useHttpSession'
import { useHttpVariableInspection } from '@/composables/spaces/http/useHttpVariableInspection'
import { useSonner } from '@/composables/useSonner'
import { i18n } from '@/electron'
import { ChevronDown, X } from 'lucide-vue-next'

const { collection, draft, unavailable, saving } = useHttpCollection()
const { inspectorOpen } = useHttpPanels()
const { layers, variables, isRequest, activeEnvironment }
  = useHttpVariableInspection()
const { sessionNames, refreshHttpSessionNames, clearHttpSession }
  = useHttpSession()
const { isExecuting } = useHttpExecute()
const { sonner } = useSonner()
const query = ref('')
const clearing = ref(false)
const allOpen = ref(false)
const requestVariables = computed(() =>
  variables.value.filter(
    row =>
      row.used
      && row.name.toLocaleLowerCase().includes(query.value.toLocaleLowerCase()),
  ),
)
const groups = computed(() =>
  layers.value
    .filter(layer => layer.scope !== 'environment')
    .map(layer => ({
      ...layer,
      rows: Object.entries(layer.values).filter(([name]) =>
        name.toLocaleLowerCase().includes(query.value.toLocaleLowerCase()),
      ),
    }))
    .filter(layer => layer.rows.length || layer.scope === 'session'),
)
watch(
  [isExecuting, () => activeEnvironment.value?.id],
  async () => {
    try {
      await refreshHttpSessionNames()
    }
    catch {
      sonner({
        type: 'error',
        message: i18n.t('spaces.http.runtime.sessionReadError'),
      })
    }
  },
  { immediate: true },
)
function updateVariable(name: string, value: string) {
  const row = [...draft.value.variables]
    .reverse()
    .find(entry => entry.key === name && entry.enabled !== false)
  if (row)
    row.value = value
}

async function clearSession() {
  clearing.value = true
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
  <div class="flex h-full min-h-0 flex-col pt-[var(--content-top-offset)]">
    <div
      class="flex h-[calc(40px-var(--content-top-offset))] shrink-0 items-center justify-between gap-2 border-b px-3 pb-1"
    >
      <UiText
        variant="sm"
        weight="medium"
      >
        {{ i18n.t("spaces.http.runtime.variablesInspector") }}
      </UiText>
      <UiActionButton
        :tooltip="i18n.t('spaces.http.inspector.close')"
        @click="inspectorOpen = false"
      >
        <X class="size-4" />
      </UiActionButton>
    </div>
    <div class="shrink-0 p-3">
      <Input
        v-model="query"
        :placeholder="i18n.t('spaces.http.inspector.search')"
        :aria-label="i18n.t('spaces.http.inspector.search')"
      />
    </div>
    <div class="scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-3">
      <section
        v-if="isRequest"
        class="space-y-2"
      >
        <UiText
          as="h3"
          variant="xs"
          weight="medium"
        >
          {{ i18n.t("spaces.http.inspector.inRequest") }}
        </UiText>
        <UiText
          v-if="!requestVariables.length"
          as="p"
          variant="xs"
          muted
        >
          {{ i18n.t("spaces.http.inspector.noUsed") }}
        </UiText>
        <div
          v-else
          class="divide-y border-y"
        >
          <div
            v-for="row in requestVariables"
            :key="row.name"
            class="grid grid-cols-2"
          >
            <div class="min-w-0 px-1 py-2">
              <UiText
                as="p"
                variant="xs"
                class="break-all"
              >
                {{ row.name }}
              </UiText>
              <UiText
                v-if="row.current"
                as="p"
                variant="caption"
                muted
              >
                {{ i18n.t(`spaces.http.inspector.${row.current.scope}`) }} ·
                {{ row.current.label }}
              </UiText>
              <UiText
                v-if="row.overridden.length"
                as="p"
                variant="caption"
                muted
              >
                {{ i18n.t("spaces.http.inspector.overrides") }}:
                {{ row.overridden.map((source) => source.label).join(", ") }}
              </UiText>
            </div>
            <div
              v-if="
                row.current?.scope === 'environment'
                  && activeEnvironment
                  && !activeEnvironment.secretKeys.includes(row.name)
              "
              class="flex min-w-0 items-center border-l px-1"
            >
              <HttpInspectorValue
                :key="`${activeEnvironment.id}:${row.name}`"
                :environment-id="activeEnvironment.id"
                :name="row.name"
                :value="row.current.value"
              />
            </div>
            <UiText
              v-else
              variant="xs"
              class="border-l px-2 py-2 break-all"
              :class="!row.current ? 'text-destructive' : ''"
            >
              {{
                row.current
                  ? row.current.value || i18n.t("spaces.http.inspector.empty")
                  : i18n.t("spaces.http.inspector.missing")
              }}
            </UiText>
          </div>
        </div>
      </section>
      <Button
        v-if="isRequest"
        variant="ghost"
        size="sm"
        class="w-full justify-start gap-2"
        :aria-expanded="allOpen"
        aria-controls="http-all-variables"
        @click="allOpen = !allOpen"
      >
        <ChevronDown
          class="size-3 transition-transform"
          :class="allOpen ? '' : '-rotate-90'"
        />
        {{ i18n.t("spaces.http.inspector.allVariables") }}
      </Button>
      <div
        v-show="!isRequest || allOpen"
        id="http-all-variables"
        class="space-y-5"
      >
        <section class="space-y-2">
          <UiText
            as="h3"
            variant="xs"
            weight="medium"
          >
            {{ i18n.t("spaces.http.inspector.environment") }} ·
            {{
              activeEnvironment?.name ?? i18n.t("spaces.http.environments.none")
            }}
          </UiText>
          <HttpInspectorEnvironment
            v-if="activeEnvironment"
            :key="activeEnvironment.id"
            :environment-id="activeEnvironment.id"
            :query="query"
          />
          <UiText
            v-else
            as="p"
            variant="xs"
            muted
          >
            {{ i18n.t("spaces.http.environments.noEnvironmentSelected") }}
          </UiText>
        </section>
        <section
          v-for="group in groups"
          :key="`${group.scope}:${group.folderId ?? group.label}`"
          class="space-y-2"
        >
          <UiText
            as="h3"
            variant="xs"
            weight="medium"
          >
            {{ i18n.t(`spaces.http.inspector.${group.scope}`) }} ·
            {{ group.label }}
          </UiText>
          <UiText
            v-if="!group.rows.length"
            as="p"
            variant="xs"
            muted
          >
            {{ i18n.t("spaces.http.runtime.noVariables") }}
          </UiText>
          <div class="divide-y border-y">
            <div
              v-for="[name, value] in group.rows"
              :key="name"
              class="grid grid-cols-2"
            >
              <UiText
                variant="xs"
                class="px-1 py-2 break-all"
              >
                {{ name }}
              </UiText>
              <div
                v-if="
                  group.folderId != null && group.folderId === collection?.id
                "
                class="flex min-w-0 items-center border-l px-1"
              >
                <UiInput
                  :model-value="value"
                  :aria-label="name"
                  :disabled="unavailable || saving"
                  variant="ghost"
                  class="!h-7 min-w-0"
                  @update:model-value="
                    (value) => updateVariable(name, String(value))
                  "
                />
              </div>
              <UiText
                v-else
                variant="xs"
                class="border-l px-2 py-2 break-all"
              >
                {{ value || i18n.t("spaces.http.inspector.empty") }}
              </UiText>
            </div>
          </div>
          <div
            v-if="group.scope === 'session'"
            class="space-y-2"
          >
            <UiText
              as="p"
              variant="caption"
              muted
            >
              {{ i18n.t("spaces.http.runtime.sessionHint") }}
            </UiText>
            <Button
              variant="outline"
              size="sm"
              :disabled="clearing || isExecuting || !sessionNames.length"
              @click="clearSession"
            >
              {{ i18n.t("spaces.http.runtime.clearSession") }}
            </Button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
