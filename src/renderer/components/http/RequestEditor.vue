<script setup lang="ts">
import * as Tabs from '@/components/ui/shadcn/tabs'
import {
  useHttpExecute,
  useHttpRequests,
  useNavigationHistory,
} from '@/composables'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { useHttpWebSocket } from '@/composables/spaces/http/useHttpWebSocket'
import { i18n } from '@/electron'
import { navigateBack, navigateForward } from '@/ipc/listeners/deepLinks'
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Send,
  Square,
} from 'lucide-vue-next'

const { currentDraft, currentRequest } = useHttpRequests()
const { executeCurrentRequest, isExecuting, cancelRequest } = useHttpExecute()
const {
  saving: runtimeSaving,
  groupDirty,
  groupInvalid,
  focusTarget,
} = useHttpRuntime()
const { isWebSocket } = useHttpWebSocket()
const { canGoBack, canGoForward } = useNavigationHistory()

const activeTab = ref<
  | 'message'
  | 'params'
  | 'headers'
  | 'body'
  | 'auth'
  | 'description'
  | 'assertions'
  | 'variables'
  | 'scripts'
>('params')

watch(isWebSocket, () => {
  activeTab.value = isWebSocket.value ? 'message' : 'params'
})
const editorRoot = useTemplateRef<HTMLElement>('editorRoot')
watch(focusTarget, async (target) => {
  if (!target)
    return
  activeTab.value = target.group === 'assertions' ? 'assertions' : 'variables'
  await nextTick()
  editorRoot.value
    ?.querySelector<HTMLInputElement>(
      `[data-runtime-field="${target.group}.${target.index}.${target.field}"]`,
    )
    ?.focus()
})

const paramsCount = computed(() => currentDraft.value?.query.length ?? 0)
const headersCount = computed(() => currentDraft.value?.headers.length ?? 0)
const authIndicator = computed(() => {
  const type = currentDraft.value?.auth.type
  if (!type || type === 'none')
    return null
  return type
})

const isHistoryVisible = computed(() => canGoBack.value || canGoForward.value)

function onBackClick() {
  void navigateBack()
}

function onForwardClick() {
  void navigateForward()
}

async function onSend() {
  await executeCurrentRequest()
}
</script>

<template>
  <div
    v-if="!currentRequest"
    class="text-muted-foreground flex h-full items-center justify-center"
  >
    {{ i18n.t("spaces.http.editor.noSelected") }}
  </div>
  <div
    v-else-if="currentDraft"
    ref="editorRoot"
    class="flex h-full flex-col"
  >
    <div
      class="border-border flex h-[calc(40px-var(--content-top-offset))] shrink-0 items-center border-b px-2 pb-1"
    >
      <div class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        <div
          v-if="isHistoryVisible"
          class="flex shrink-0 items-center gap-0.5"
        >
          <UiActionButton
            :disabled="!canGoBack"
            :tooltip="i18n.t('menu:history.back')"
            @click="onBackClick"
          >
            <ChevronLeft class="h-3 w-3" />
          </UiActionButton>
          <UiActionButton
            :disabled="!canGoForward"
            :tooltip="i18n.t('menu:history.forward')"
            @click="onForwardClick"
          >
            <ChevronRight class="h-3 w-3" />
          </UiActionButton>
        </div>
        <div class="min-w-0 flex-1">
          <HttpRequestName />
        </div>
      </div>
    </div>
    <div class="border-border flex items-center gap-1 border-b px-2 py-1">
      <HttpTransportSelect />
      <div class="min-w-0 flex-1">
        <HttpVariableInput
          v-model="currentDraft.url"
          :placeholder="i18n.t('spaces.http.editor.urlPlaceholder')"
        />
      </div>
      <HttpRequestSaveButton />
      <HttpWebsocketConnectionAction v-if="isWebSocket" />
      <UiActionButton
        v-else-if="isExecuting"
        :aria-label="i18n.t('spaces.http.scripts.cancel')"
        :tooltip="i18n.t('spaces.http.scripts.cancel')"
        @click="cancelRequest"
      >
        <Square />
      </UiActionButton>
      <UiActionButton
        v-else
        :aria-label="i18n.t('spaces.http.editor.send')"
        :tooltip="i18n.t('spaces.http.editor.send')"
        :disabled="
          isExecuting
            || !currentDraft.url
            || currentRequest.runtimeState !== 'ready'
        "
        @click="onSend"
      >
        <LoaderCircle
          v-if="isExecuting"
          class="animate-spin"
        />
        <Send v-else />
      </UiActionButton>
    </div>
    <Tabs.Tabs
      v-model="activeTab"
      class="flex min-h-0 flex-1 flex-col gap-0"
    >
      <div class="scrollbar min-w-0 shrink-0 overflow-x-auto px-2 py-1">
        <Tabs.TabsList>
          <Tabs.TabsTrigger
            v-if="isWebSocket"
            value="message"
          >
            {{ i18n.t("spaces.http.websocket.message") }}
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger value="params">
            {{ i18n.t("spaces.http.editor.tabs.params") }}
            <span
              v-if="paramsCount"
              class="bg-muted text-muted-foreground ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-medium tabular-nums"
            >
              {{ paramsCount }}
            </span>
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger value="headers">
            {{ i18n.t("spaces.http.editor.tabs.headers") }}
            <span
              v-if="headersCount"
              class="bg-muted text-muted-foreground ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-medium tabular-nums"
            >
              {{ headersCount }}
            </span>
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger
            v-if="!isWebSocket"
            value="body"
          >
            {{ i18n.t("spaces.http.editor.tabs.body") }}
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger value="auth">
            {{ i18n.t("spaces.http.editor.tabs.auth") }}
            <span
              v-if="authIndicator"
              class="bg-muted text-muted-foreground ml-1 inline-flex h-4 items-center justify-center rounded px-1.5 text-[10px] font-medium"
            >
              {{ authIndicator }}
            </span>
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger
            v-if="!isWebSocket"
            value="scripts"
          >
            {{ i18n.t("spaces.http.scripts.title") }}
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger value="description">
            {{ i18n.t("spaces.http.editor.tabs.description") }}
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger
            v-if="!isWebSocket"
            value="variables"
            :class="
              groupDirty.extractions && groupInvalid.extractions
                ? 'text-destructive'
                : ''
            "
          >
            {{ i18n.t("spaces.http.runtime.variables")
            }}{{ groupDirty.extractions ? " *" : "" }}
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger
            v-if="!isWebSocket"
            value="assertions"
            :class="
              groupDirty.assertions && groupInvalid.assertions
                ? 'text-destructive'
                : ''
            "
          >
            {{ i18n.t("spaces.http.runtime.assertions")
            }}{{ groupDirty.assertions ? " *" : "" }}
          </Tabs.TabsTrigger>
        </Tabs.TabsList>
      </div>
      <div class="scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <Tabs.TabsContent
          v-if="isWebSocket"
          value="message"
          class="h-full"
        >
          <HttpWebsocketComposer />
        </Tabs.TabsContent>
        <Tabs.TabsContent
          value="assertions"
          class="flex h-full min-h-0 flex-col"
        >
          <HttpRuntimeToolbar />
          <fieldset
            class="min-h-0 flex-1"
            :disabled="runtimeSaving || currentRequest.runtimeState !== 'ready'"
          >
            <HttpRequestAssertions
              :fill="false"
              :disabled="
                runtimeSaving || currentRequest.runtimeState !== 'ready'
              "
            />
          </fieldset>
        </Tabs.TabsContent>
        <Tabs.TabsContent
          value="variables"
          class="flex h-full min-h-0 flex-col"
        >
          <HttpRuntimeToolbar :show-hint="false" />
          <HttpRequestVariables :fill="false" />
        </Tabs.TabsContent>
        <Tabs.TabsContent
          value="params"
          class="h-full"
        >
          <HttpKeyValueTable
            v-model="currentDraft.query"
            :fill="false"
          />
        </Tabs.TabsContent>
        <Tabs.TabsContent
          value="headers"
          class="h-full"
        >
          <HttpKeyValueTable
            v-model="currentDraft.headers"
            :fill="false"
          />
        </Tabs.TabsContent>
        <Tabs.TabsContent
          value="body"
          class="h-full"
        >
          <HttpRequestBodyTab v-model="currentDraft" />
        </Tabs.TabsContent>
        <Tabs.TabsContent
          value="auth"
          class="h-full"
        >
          <HttpRequestAuthTab v-model="currentDraft" />
        </Tabs.TabsContent>
        <Tabs.TabsContent
          value="scripts"
          class="h-full"
        >
          <HttpRequestScripts embedded />
        </Tabs.TabsContent>
        <Tabs.TabsContent
          value="description"
          class="h-full"
        >
          <HttpRequestDescriptionTab v-model="currentDraft" />
        </Tabs.TabsContent>
      </div>
    </Tabs.Tabs>
  </div>
</template>
