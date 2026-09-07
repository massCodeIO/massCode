<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { useHttpCollection } from '@/composables/spaces/http/useHttpCollection'
import { useHttpScriptTrust } from '@/composables/spaces/http/useHttpScriptTrust'
import { i18n } from '@/electron'
import { emptyHttpScripts } from '~/shared/httpScripts'

const {
  collection,
  draft,
  saving,
  saveError,
  submitted,
  valid,
  unavailable,
  leaveDialogOpen,
  resolveNavigation,
  runtimeContext,
} = useHttpCollection()
const activeTab = ref('overview')
const tabs = [
  'overview',
  'headers',
  'vars',
  'auth',
  'script',
  'tests',
] as const
const trustContext = useHttpScriptTrust(
  computed(() => ({
    collectionId: collection.value?.id,
    scripts: draft.value.runtime.scripts ?? emptyHttpScripts(),
  })),
)
watch(
  () => collection.value?.id,
  () => (activeTab.value = 'overview'),
)
</script>

<template>
  <div
    v-if="collection"
    class="flex h-full min-h-0 flex-col overflow-hidden pt-[var(--content-top-offset)]"
  >
    <UiText
      v-if="saveError || unavailable || (submitted && !valid)"
      variant="xs"
      class="text-destructive px-3 py-2"
    >
      {{
        i18n.t(
          unavailable
            ? "spaces.http.collection.invalid"
            : saveError
              ? "spaces.http.collection.saveFailed"
              : "spaces.http.collection.validation",
        )
      }}
    </UiText>
    <Tabs.Tabs
      v-model="activeTab"
      class="flex min-h-0 flex-1 flex-col gap-0"
    >
      <div class="scrollbar min-w-0 shrink-0 overflow-x-auto px-2 py-1">
        <Tabs.TabsList>
          <Tabs.TabsTrigger
            v-for="tab in tabs"
            :key="tab"
            :value="tab"
          >
            {{ i18n.t(`spaces.http.collection.tabs.${tab}`) }}
          </Tabs.TabsTrigger>
        </Tabs.TabsList>
      </div>
      <fieldset
        :disabled="saving || unavailable"
        class="scrollbar min-h-0 flex-1 overflow-auto px-3 py-2 disabled:opacity-50"
      >
        <Tabs.TabsContent
          value="overview"
          class="h-full min-h-0"
        >
          <NotesEditor
            :key="collection.id"
            v-model:content="draft.documentation"
            :disabled="saving || unavailable"
          />
        </Tabs.TabsContent>
        <Tabs.TabsContent
          value="headers"
          class="h-full"
        >
          <HttpKeyValueTable
            v-model="draft.headers"
            :fill="false"
          />
        </Tabs.TabsContent>
        <Tabs.TabsContent
          value="vars"
          class="flex flex-col gap-6"
        >
          <div>
            <UiText
              as="div"
              variant="sm"
              class="mb-2"
            >
              {{ i18n.t("spaces.http.scripts.preRequest") }}
            </UiText>
            <HttpKeyValueTable
              v-model="draft.variables"
              :fill="false"
            />
          </div>
          <HttpRequestVariables
            :context="runtimeContext"
            :fill="false"
          />
        </Tabs.TabsContent>
        <Tabs.TabsContent value="auth">
          <HttpRequestAuthTab
            v-model="draft"
            :allow-inherit="collection.parentId !== null"
          />
        </Tabs.TabsContent>
        <Tabs.TabsContent
          value="script"
          class="h-full"
        >
          <HttpRequestScripts
            embedded
            :context="runtimeContext"
            :trust-context="trustContext"
          />
        </Tabs.TabsContent>
        <Tabs.TabsContent
          value="tests"
          class="h-full"
        >
          <HttpRequestAssertions
            :fill="false"
            :context="runtimeContext"
            :disabled="saving || unavailable"
          />
        </Tabs.TabsContent>
      </fieldset>
    </Tabs.Tabs>
    <Dialog.Dialog
      :open="leaveDialogOpen"
      @update:open="!$event && resolveNavigation('cancel')"
    >
      <Dialog.DialogContent
        class="sm:max-w-md"
        @open-auto-focus="$event.preventDefault()"
        @close-auto-focus="$event.preventDefault()"
      >
        <Dialog.DialogHeader>
          <Dialog.DialogTitle>
            {{ i18n.t("spaces.http.collection.leaveTitle") }}
          </Dialog.DialogTitle>
          <Dialog.DialogDescription>
            {{ i18n.t("spaces.http.collection.leaveDescription") }}
          </Dialog.DialogDescription>
        </Dialog.DialogHeader>
        <Dialog.DialogFooter>
          <Button
            variant="outline"
            :disabled="saving"
            @click="resolveNavigation('cancel')"
          >
            {{ i18n.t("button.cancel") }}
          </Button>
          <Button
            variant="outline"
            :disabled="saving"
            @click="resolveNavigation('discard')"
          >
            {{ i18n.t("spaces.http.runtime.discard") }}
          </Button>
          <Button
            :disabled="saving || unavailable"
            @click="resolveNavigation('save')"
          >
            {{ i18n.t("button.save") }}
          </Button>
        </Dialog.DialogFooter>
      </Dialog.DialogContent>
    </Dialog.Dialog>
  </div>
</template>
