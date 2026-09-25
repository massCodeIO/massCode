<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import { Textarea } from '@/components/ui/shadcn/textarea'
import { i18n } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'
import { isLocalAiProvider } from '~/shared/ai'
import { useAiPreferences } from './useAiPreferences'

const {
  settings,
  provider,
  baseURL,
  model,
  userInstructions,
  apiKey,
  removeKey,
  editingKey,
  busy,
  refreshingModels,
  loaded,
  currentProfile,
  models,
  selectedModel,
  hasStoredKey,
  keyPlaceholder,
  keyDescription,
  cloudProviders,
  localProviders,
  manualModel,
  modelSaved,
  connectionDirty,
  selectModel,
  chooseFromList,
  save,
  refreshModels,
} = useAiPreferences()
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection :label="i18n.t('ai.title')">
      <UiMenuFormItem :label="i18n.t('ai.provider')">
        <Select.Select
          v-model="provider"
          :disabled="busy || !loaded"
        >
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectGroup>
              <Select.SelectLabel>
                {{ i18n.t("ai.cloudProviders") }}
              </Select.SelectLabel>
              <Select.SelectItem
                v-for="value in cloudProviders"
                :key="value"
                :value="value"
              >
                {{ i18n.t(`ai.providers.${value}`) }}
              </Select.SelectItem>
            </Select.SelectGroup>
            <Select.SelectSeparator />
            <Select.SelectGroup>
              <Select.SelectLabel>
                {{ i18n.t("ai.localProviders") }}
              </Select.SelectLabel>
              <Select.SelectItem
                v-for="value in localProviders"
                :key="value"
                :value="value"
              >
                {{ i18n.t(`ai.providers.${value}`) }}
              </Select.SelectItem>
            </Select.SelectGroup>
          </Select.SelectContent>
        </Select.Select>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('ai.baseURL')">
        <UiInput
          v-model="baseURL"
          :disabled="busy || !loaded || !isLocalAiProvider(provider)"
          :aria-label="i18n.t('ai.baseURL')"
        />
        <template #description>
          {{
            i18n.t(
              !isLocalAiProvider(provider) ? "ai.cloudHint" : "ai.localHint",
            )
          }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('ai.apiKey')">
        <div class="flex flex-wrap items-center gap-2">
          <UiInput
            v-if="hasStoredKey && !editingKey"
            :model-value="currentProfile?.keyPreview ?? keyPlaceholder"
            readonly
            class="w-72"
            :aria-label="i18n.t('ai.apiKey')"
          />
          <UiInput
            v-else
            v-model="apiKey"
            type="password"
            autocomplete="new-password"
            class="w-72"
            :disabled="busy || !loaded || !settings?.encryptionAvailable"
            :placeholder="keyPlaceholder"
            :aria-label="i18n.t('ai.apiKey')"
          />
          <Button
            v-if="hasStoredKey && !editingKey"
            variant="outline"
            :disabled="busy || !loaded || !settings?.encryptionAvailable"
            @click="editingKey = true"
          >
            {{ i18n.t("ai.replaceKey") }}
          </Button>
          <Button
            v-if="editingKey"
            variant="outline"
            :disabled="busy"
            @click="
              editingKey = false;
              apiKey = '';
            "
          >
            {{ i18n.t("button.cancel") }}
          </Button>
          <Button
            v-if="hasStoredKey || apiKey"
            variant="destructive"
            :disabled="busy || !loaded"
            @click="
              removeKey = true;
              apiKey = '';
              editingKey = false;
            "
          >
            {{ i18n.t("ai.removeKey") }}
          </Button>
        </div>
        <template #description>
          {{ keyDescription }}
        </template>
        <template #actions>
          <Button
            :disabled="busy || !loaded"
            :aria-busy="busy"
            @click="save('connection')"
          >
            {{ i18n.t("ai.saveConnection") }}
          </Button>
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('ai.model')">
        <div class="flex flex-wrap items-center gap-2">
          <template v-if="manualModel">
            <UiInput
              v-model="model"
              class="w-72 max-w-full"
              :disabled="busy || !loaded || connectionDirty"
              :placeholder="i18n.t('ai.modelPlaceholder')"
              :aria-label="i18n.t('ai.model')"
              @update:model-value="modelSaved = false"
              @keydown.enter="save('model')"
            />
            <Button
              :disabled="busy || !loaded || connectionDirty || !model.trim()"
              @click="save('model')"
            >
              {{ i18n.t("button.save") }}
            </Button>
            <Button
              variant="ghost"
              :disabled="busy"
              @click="chooseFromList"
            >
              {{ i18n.t("ai.chooseFromList") }}
            </Button>
          </template>
          <PreferencesAiModelSelect
            v-else
            :model-value="selectedModel"
            :models="models"
            :disabled="busy || !loaded || connectionDirty"
            @select="selectModel"
          />
          <Button
            variant="outline"
            :disabled="busy || !loaded || connectionDirty"
            :aria-busy="refreshingModels"
            @click="refreshModels()"
          >
            <LoaderCircle
              v-if="refreshingModels"
              class="mr-2 h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            {{ i18n.t("ai.refreshModels") }}
          </Button>
        </div>
        <template #description>
          {{
            i18n.t(
              connectionDirty
                ? "ai.saveConnectionFirst"
                : "ai.modelSelectionHint",
            )
          }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('ai.userInstructions')">
        <Textarea
          v-model="userInstructions"
          :disabled="busy || !loaded"
          :maxlength="4000"
          :aria-label="i18n.t('ai.userInstructions')"
          :placeholder="i18n.t('ai.userInstructionsPlaceholder')"
          class="min-h-28 resize-y"
        />
        <template #description>
          {{ i18n.t("ai.userInstructionsHint") }}
        </template>
        <template #actions>
          <Button
            :disabled="busy || !loaded"
            :aria-busy="busy"
            @click="save('instructions')"
          >
            {{ i18n.t("button.save") }}
          </Button>
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
