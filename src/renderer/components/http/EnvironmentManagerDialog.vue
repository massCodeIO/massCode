<script setup lang="ts">
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useHttpEnvironmentEditor } from '@/composables'
import { i18n } from '@/electron'
import { Eye, EyeOff, KeyRound, Plus, Trash2 } from 'lucide-vue-next'

const open = defineModel<boolean>('open', { required: true })

const VARIABLE_COLUMNS = [
  {
    key: 'key',
    label: i18n.t('spaces.http.environments.varKey'),
    placeholder: i18n.t('spaces.http.environments.varKey'),
  },
  {
    key: 'value',
    label: i18n.t('spaces.http.environments.varValue'),
    placeholder: i18n.t('spaces.http.environments.varValue'),
  },
  {
    key: 'secret',
    label: i18n.t('spaces.http.environments.varSecret'),
  },
]

const {
  addSecretVariable,
  confirmRemoveVariable,
  createVariable,
  environments,
  getSecretPlaceholder,
  getSecretValue,
  isSecretsEncryptionAvailable,
  localName,
  localVariables,
  onAddEnvironment,
  onDeleteEnvironment,
  onSecretValueBlur,
  onSelectEnvironment,
  onToggleReveal,
  onToggleSecret,
  revealedSecrets,
  selectedEnv,
  selectedEnvId,
  setSecretValue,
} = useHttpEnvironmentEditor(open)
</script>

<template>
  <Dialog.Dialog v-model:open="open">
    <Dialog.DialogContent
      class="grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-3xl"
      @open-auto-focus="(e) => e.preventDefault()"
      @close-auto-focus="(e) => e.preventDefault()"
    >
      <Dialog.DialogHeader>
        <Dialog.DialogTitle>
          {{ i18n.t("spaces.http.environments.title") }}
        </Dialog.DialogTitle>
      </Dialog.DialogHeader>
      <div
        class="grid h-[min(560px,calc(100vh-8rem))] min-h-0 grid-cols-[200px_minmax(0,1fr)] gap-4"
      >
        <div class="border-border flex flex-col rounded border">
          <div
            class="border-border flex items-center justify-between border-b px-2 py-1"
          >
            <span class="text-muted-foreground text-xs font-medium">
              {{ i18n.t("spaces.http.environments.title") }}
            </span>
            <UiActionButton
              :tooltip="i18n.t('spaces.http.action.newEnvironment')"
              @click="onAddEnvironment"
            >
              <Plus class="size-3.5" />
            </UiActionButton>
          </div>
          <div class="scrollbar min-h-0 flex-1 overflow-y-auto p-1">
            <div
              v-if="environments.length === 0"
              class="text-muted-foreground px-2 py-2 text-xs"
            >
              {{ i18n.t("spaces.http.environments.empty") }}
            </div>
            <button
              v-for="env in environments"
              :key="env.id"
              type="button"
              class="flex h-[21px] w-full items-center rounded-md px-2 text-left text-sm"
              :class="
                selectedEnvId === env.id ? 'bg-accent' : 'hover:bg-accent-hover'
              "
              @click="onSelectEnvironment(env.id)"
            >
              <span class="truncate">{{ env.name }}</span>
            </button>
          </div>
        </div>

        <div
          v-if="!selectedEnv"
          class="text-muted-foreground flex items-center justify-center text-sm"
        >
          {{ i18n.t("spaces.http.environments.noEnvironmentSelected") }}
        </div>
        <div
          v-else
          class="flex min-h-0 min-w-0 flex-col gap-3"
        >
          <UiInput
            v-model="localName"
            variant="default"
            :placeholder="i18n.t('spaces.http.environments.namePlaceholder')"
          />
          <div
            class="border-border flex min-h-0 flex-1 flex-col rounded border"
          >
            <HttpKeyValueTable
              v-model="localVariables"
              :columns="VARIABLE_COLUMNS"
              :show-enabled="false"
              actions="delete"
              grid-template-columns="1fr 1fr 56px 24px"
              :create-entry="createVariable"
              :before-remove="confirmRemoveVariable"
              :empty-text="i18n.t('spaces.http.environments.noVariables')"
              :add-label="i18n.t('spaces.http.environments.addVariable')"
            >
              <template #cell-key="{ entry }">
                <UiInput
                  v-model="entry.key"
                  class="!h-6"
                  variant="ghost"
                  :disabled="entry.secret && !entry.isNew"
                  :title="
                    entry.secret && !entry.isNew
                      ? i18n.t('spaces.http.environments.secretKeyLocked')
                      : undefined
                  "
                  :placeholder="i18n.t('spaces.http.environments.varKey')"
                />
              </template>

              <template #cell-value="{ entry }">
                <UiInput
                  v-if="!entry.secret"
                  v-model="entry.value"
                  class="!h-6"
                  variant="ghost"
                  :placeholder="i18n.t('spaces.http.environments.varValue')"
                />
                <div
                  v-else
                  class="flex min-w-0 items-center gap-1"
                >
                  <UiInput
                    :model-value="getSecretValue(entry)"
                    class="!h-6"
                    variant="ghost"
                    :type="
                      revealedSecrets[entry.uid] !== undefined
                        ? 'text'
                        : 'password'
                    "
                    :placeholder="getSecretPlaceholder(entry)"
                    @update:model-value="
                      (value) => setSecretValue(entry, String(value))
                    "
                    @blur="onSecretValueBlur(entry)"
                  />
                  <UiActionButton
                    v-if="!entry.isNew"
                    :tooltip="
                      revealedSecrets[entry.uid] !== undefined
                        ? i18n.t('spaces.http.environments.hideSecret')
                        : i18n.t('spaces.http.environments.revealSecret')
                    "
                    @click="onToggleReveal(entry)"
                  >
                    <EyeOff
                      v-if="revealedSecrets[entry.uid] !== undefined"
                      class="size-3.5"
                    />
                    <Eye
                      v-else
                      class="size-3.5"
                    />
                  </UiActionButton>
                </div>
              </template>

              <template #cell-secret="{ entry, index }">
                <div
                  class="flex items-center justify-center"
                  :title="
                    isSecretsEncryptionAvailable
                      ? i18n.t('spaces.http.environments.secretHint')
                      : i18n.t('spaces.http.environments.secretUnavailable')
                  "
                >
                  <Checkbox
                    :model-value="Boolean(entry.secret)"
                    :disabled="
                      !entry.key.trim()
                        || (!entry.secret && !isSecretsEncryptionAvailable)
                    "
                    @update:model-value="() => onToggleSecret(index)"
                  />
                </div>
              </template>
            </HttpKeyValueTable>
          </div>
          <div class="flex items-center justify-between">
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground inline-flex h-7 items-center gap-1 rounded px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!isSecretsEncryptionAvailable"
              :title="
                isSecretsEncryptionAvailable
                  ? i18n.t('spaces.http.environments.secretHint')
                  : i18n.t('spaces.http.environments.secretUnavailable')
              "
              @click="addSecretVariable"
            >
              <KeyRound class="size-3.5" />
              {{ i18n.t("spaces.http.environments.addSecret") }}
            </button>
            <button
              type="button"
              class="text-destructive hover:bg-destructive/10 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs"
              @click="onDeleteEnvironment"
            >
              <Trash2 class="size-3.5" />
              {{ i18n.t("spaces.http.action.deleteEnvironment") }}
            </button>
          </div>
        </div>
      </div>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
