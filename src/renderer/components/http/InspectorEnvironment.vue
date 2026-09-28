<script setup lang="ts">
import { useHttpEnvironmentEditor } from '@/composables/spaces/http/useHttpEnvironmentEditor'
import { i18n } from '@/electron'
import { Eye, EyeOff } from 'lucide-vue-next'

const props = defineProps<{ environmentId: number, query: string }>()
const columns = [
  { key: 'key', label: i18n.t('spaces.http.environments.varKey') },
  { key: 'value', label: i18n.t('spaces.http.environments.varValue') },
]
const open = ref(true)
const {
  localVariables,
  flushPendingUpdate,
  getSecretValue,
  getSecretPlaceholder,
  setSecretValue,
  onSecretValueBlur,
  revealedSecrets,
  onToggleReveal,
} = useHttpEnvironmentEditor(open, props.environmentId)
const visible = computed(() =>
  localVariables.value.filter(row =>
    row.key.toLocaleLowerCase().includes(props.query.toLocaleLowerCase()),
  ),
)
onBeforeUnmount(() => {
  void flushPendingUpdate()
})
</script>

<template>
  <UiEditableTable
    variant="compact"
    class="border-t"
    :rows="visible"
    :columns="columns"
    :row-key="(entry) => entry.uid"
    :label="i18n.t('spaces.http.inspector.environment')"
    :empty-text="i18n.t('spaces.http.runtime.noVariables')"
  >
    <template #cell-value="{ row: entry }">
      <div class="flex h-full min-w-0 items-center px-1">
        <UiInput
          v-if="!entry.secret"
          v-model="entry.value"
          variant="ghost"
          class="!h-7 min-w-0"
          :aria-label="entry.key"
          :placeholder="i18n.t('spaces.http.environments.varValue')"
          @blur="flushPendingUpdate"
        />
        <template v-else>
          <UiInput
            :model-value="getSecretValue(entry)"
            variant="ghost"
            class="!h-7 min-w-0"
            :aria-label="entry.key"
            :type="
              revealedSecrets[entry.uid] !== undefined ? 'text' : 'password'
            "
            :placeholder="getSecretPlaceholder(entry)"
            @update:model-value="
              (value) => setSecretValue(entry, String(value))
            "
            @blur="onSecretValueBlur(entry)"
          />
          <UiActionButton
            :tooltip="
              i18n.t(
                revealedSecrets[entry.uid] !== undefined
                  ? 'spaces.http.environments.hideSecret'
                  : 'spaces.http.environments.revealSecret',
              )
            "
            @click="onToggleReveal(entry)"
          >
            <EyeOff
              v-if="revealedSecrets[entry.uid] !== undefined"
              class="size-3"
            /><Eye
              v-else
              class="size-3"
            />
          </UiActionButton>
        </template>
      </div>
    </template>
  </UiEditableTable>
</template>
