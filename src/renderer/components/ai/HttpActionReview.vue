<script setup lang="ts">
import type { ChatMessage } from '@/composables/ai/useAi'
import type { AiHttpActionView } from '~/shared/aiHttpActions'
import { Button } from '@/components/ui/shadcn/button'
import { useAi } from '@/composables/ai/useAi'
import { useHttpRunner } from '@/composables/spaces/http/useHttpRunner'
import { i18n, store } from '@/electron'
import { actionTitle } from './actionTitle'

const props = defineProps<{ message: ChatMessage, action: AiHttpActionView }>()
const { applyHttpAction, cancelHttpAction, canPerformHttpAction } = useAi()
const applying = ref(false)
const cancelling = ref(false)
const failed = ref(false)
const showDiagnostics = ref(false)
const applyLabel = computed(() =>
  props.action.trust
    ? i18n.t(
        props.action.trust.allowed
          ? 'ai.httpActions.grantTrust'
          : 'ai.httpActions.revokeTrust',
      )
    : i18n.t(`ai.httpActions.actions.${props.action.action}`),
)
const changedFields = computed(() =>
  props.action.changedFields
    ?.map(field => i18n.t(`ai.httpActions.fields.${field}`))
    .join(', '),
)
const run = computed(() => props.action.run)
const previewText = computed(() => formatHttpData(props.action.preview))
const resultText = computed(() => formatHttpData(props.action.result))
function settingValue(value: string | boolean | null) {
  return typeof value === 'boolean'
    ? i18n.t(`preferences:http.transport.${value ? 'on' : 'off'}`)
    : (value ?? i18n.t('ai.httpActions.noExpiry'))
}
function openRun() {
  if (run.value) {
    void useHttpRunner().adoptRunner(
      run.value.view.runId,
      store.preferences.get<string>('storage.vaultPath') ?? '',
      run.value.view,
    )
  }
}
function formatHttpData(value: unknown) {
  if (
    value
    && typeof value === 'object'
    && 'content' in value
    && typeof value.content === 'string'
    && 'nextOffset' in value
    && value.nextOffset === null
    && 'totalLength' in value
    && value.totalLength === value.content.length
  ) {
    try {
      return JSON.stringify(JSON.parse(value.content), null, 2)
    }
    catch {}
  }
  return JSON.stringify(value, null, 2)
}
async function apply() {
  if (
    applying.value
    || cancelling.value
    || props.action.state !== 'pending'
    || !canPerformHttpAction(props.message)
  ) {
    return
  }
  applying.value = true
  try {
    const applied = await applyHttpAction(props.message, props.action, true)
    failed.value
      = !applied && (props.action as AiHttpActionView).state !== 'cancelled'
  }
  catch {
    failed.value = true
  }
  finally {
    applying.value = false
  }
}
async function cancel() {
  if (cancelling.value)
    return
  cancelling.value = true
  try {
    await cancelHttpAction(props.action)
  }
  catch {
    failed.value = true
  }
  finally {
    cancelling.value = false
  }
}
</script>

<template>
  <div class="space-y-2 rounded-md border p-3">
    <UiText
      as="p"
      variant="sm"
    >
      {{ actionTitle("httpActions", action.action, action.state) }}
    </UiText>
    <div class="flex flex-wrap items-start gap-x-2 gap-y-1">
      <UiStatus :state="action.state">
        {{ i18n.t(`ai.httpActions.states.${action.state}`) }}
      </UiStatus>
      <UiText
        variant="caption"
        muted
      >
        {{ i18n.t(`ai.httpActions.sources.${action.source}`) }}
      </UiText>
    </div>
    <template v-if="action.state === 'pending'">
      <AiHttpRequestPreview
        v-if="action.request"
        :request="action.request"
      />
      <template v-if="run">
        <UiText
          as="p"
          variant="sm"
          weight="medium"
        >
          {{ run.view.folderName }}
        </UiText>
        <UiText
          as="p"
          variant="caption"
          muted
        >
          {{ i18n.t("ai.httpActions.environment") }}:
          {{
            run.view.environmentName ?? i18n.t("ai.httpActions.noEnvironment")
          }}
        </UiText>
        <UiText
          as="p"
          variant="caption"
          muted
        >
          {{
            i18n.t("ai.httpActions.runSummary", {
              count: run.view.steps.length,
            })
          }}
        </UiText>
        <ol class="scrollbar max-h-64 space-y-3 overflow-y-auto">
          <li
            v-for="(step, index) in run.view.steps"
            :key="step.requestId"
          >
            <AiHttpRequestPreview
              v-if="run.requests?.[index]"
              :request="run.requests[index]"
            />
            <UiText
              v-else
              as="p"
              variant="sm"
            >
              {{ index + 1 }}. {{ step.method }} {{ step.name }}
            </UiText>
          </li>
        </ol>
        <UiText
          as="p"
          variant="caption"
          muted
        >
          {{
            i18n.t(
              run.continueOnFailure
                ? "ai.httpActions.continueOnFailure"
                : "ai.httpActions.stopOnFailure",
            )
          }}
        </UiText>
      </template>
      <template v-if="action.message">
        <UiText
          as="p"
          variant="caption"
        >
          {{
            i18n.t("ai.httpActions.messageSummary", {
              count: action.message.characters,
              id: action.message.connectionId,
            })
          }}
        </UiText>
        <UiText
          as="p"
          variant="sm"
          class="break-all whitespace-pre-wrap"
        >
          {{ action.message.text }}
        </UiText>
      </template>
      <UiText
        v-for="detail in action.details"
        :key="detail.label"
        as="p"
        variant="caption"
      >
        {{ i18n.t(`ai.httpActions.details.${detail.label}`) }}:
        {{ detail.value }}
      </UiText>
      <UiText
        v-if="action.changedFields?.length"
        as="p"
        variant="caption"
      >
        {{ i18n.t("ai.httpActions.changedFields") }}: {{ changedFields }}
      </UiText>
      <template v-if="action.cookie">
        <UiText
          v-if="action.cookie.name"
          as="p"
          variant="caption"
        >
          {{ i18n.t("ai.httpActions.cookie") }}: {{ action.cookie.name }}
        </UiText>
        <UiText
          v-if="action.cookie.enabled !== undefined"
          as="p"
          variant="caption"
        >
          {{
            action.cookie.requestId === null
              ? i18n.t("ai.httpActions.allRequests")
              : i18n.t("ai.httpActions.requestTarget", {
                id: action.cookie.requestId,
              })
          }}
          · {{ settingValue(action.cookie.enabled) }}
        </UiText>
        <UiText
          v-for="change in action.cookie.changes"
          :key="change.field"
          as="p"
          variant="caption"
        >
          {{ i18n.t(`ai.httpActions.cookieFields.${change.field}`) }}:
          {{ settingValue(change.before) }} → {{ settingValue(change.after) }}
        </UiText>
      </template>
      <UiText
        v-if="action.trust?.allowed"
        as="p"
        variant="caption"
      >
        {{ i18n.t("ai.httpActions.trustWarning") }}
      </UiText>
      <UiText
        v-if="action.irreversible"
        as="p"
        variant="caption"
      >
        {{ i18n.t("ai.httpActions.irreversible") }}
      </UiText>
      <div class="flex flex-wrap gap-2">
        <Button
          size="sm"
          :disabled="applying || cancelling || !canPerformHttpAction(message)"
          @click="apply"
        >
          {{ applyLabel }}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          :disabled="applying || cancelling"
          @click="cancel"
        >
          {{ i18n.t("ai.edit.reject") }}
        </Button>
      </div>
    </template>
    <UiText
      v-if="failed"
      as="p"
      variant="caption"
      class="text-destructive"
      role="alert"
    >
      {{ i18n.t("ai.httpActions.failed") }}
    </UiText>
    <div class="flex flex-wrap gap-2">
      <Button
        v-if="action.state === 'running'"
        variant="outline"
        size="sm"
        :disabled="cancelling"
        @click="cancel"
      >
        {{ i18n.t("ai.httpActions.stopActivity") }}
      </Button>
      <Button
        v-if="run && action.state !== 'pending'"
        variant="outline"
        size="sm"
        @click="openRun"
      >
        {{ i18n.t("ai.httpActions.openRun") }}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :aria-expanded="showDiagnostics"
        @click="showDiagnostics = !showDiagnostics"
      >
        {{ i18n.t("ai.httpActions.diagnostics") }}
      </Button>
    </div>
    <div
      v-if="showDiagnostics"
      class="scrollbar max-h-64 space-y-2 overflow-auto"
    >
      <AiCodeBlock
        v-if="previewText"
        :code="previewText"
        language="json"
      />
      <AiCodeBlock
        v-if="action.result"
        :code="resultText ?? ''"
        language="json"
      />
    </div>
  </div>
</template>
