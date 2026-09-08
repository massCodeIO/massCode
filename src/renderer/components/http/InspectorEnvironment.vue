<script setup lang="ts">
import { useHttpEnvironmentEditor } from '@/composables/spaces/http/useHttpEnvironmentEditor'
import { i18n } from '@/electron'
import { Eye, EyeOff } from 'lucide-vue-next'

const props = defineProps<{ environmentId: number, query: string }>()
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
  <div class="divide-y border-y">
    <UiText
      v-if="!visible.length"
      as="p"
      variant="xs"
      muted
      class="py-2"
    >
      {{ i18n.t("spaces.http.runtime.noVariables") }}
    </UiText>
    <div
      v-for="entry in visible"
      :key="entry.uid"
      class="grid grid-cols-2 items-center"
    >
      <UiText
        variant="xs"
        class="px-1 py-2 break-all"
      >
        {{ entry.key }}
      </UiText>
      <div class="flex min-w-0 items-center border-l px-1">
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
    </div>
  </div>
</template>
