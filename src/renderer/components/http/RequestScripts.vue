<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { useHttpScriptTrust } from '@/composables/spaces/http/useHttpScriptTrust'
import { i18n } from '@/electron'
import { ShieldCheck, ShieldOff } from 'lucide-vue-next'
import { emptyHttpScripts } from '~/shared/httpScripts'

const props = defineProps<{
  embedded?: boolean
  context?: Pick<ReturnType<typeof useHttpRuntime>, 'draft'>
  trustContext?: ReturnType<typeof useHttpScriptTrust>
}>()
const { draft } = props.context ?? useHttpRuntime()
const { trusted, busy, unavailable, hasScripts, setTrust }
  = props.trustContext ?? useHttpScriptTrust()
const phase = ref<'preRequest' | 'postResponse'>('preRequest')
const code = computed({
  get: () => draft.value.scripts?.[phase.value] ?? '',
  set: (value: string) => {
    draft.value.version = 2
    draft.value.scripts = {
      ...(draft.value.scripts ?? emptyHttpScripts()),
      [phase.value]: value,
    }
  },
})
</script>

<template>
  <div
    class="flex min-h-0 flex-col gap-3"
    :class="embedded ? 'h-full' : 'p-3'"
  >
    <div class="flex h-7 shrink-0 items-center justify-between gap-3">
      <UiText
        variant="xs"
        :class="
          trusted && hasScripts ? 'text-success' : 'text-muted-foreground'
        "
      >
        {{
          i18n.t(
            trusted && hasScripts
              ? "spaces.http.scripts.trusted"
              : "spaces.http.scripts.untrusted",
          )
        }}
      </UiText>
      <Button
        v-if="hasScripts"
        variant="ghost"
        size="sm"
        :disabled="busy"
        @click="setTrust(!trusted)"
      >
        <ShieldOff
          v-if="trusted"
          class="size-3.5"
        />
        <ShieldCheck
          v-else
          class="size-3.5"
        />
        {{
          i18n.t(
            trusted
              ? "spaces.http.scripts.revoke"
              : "spaces.http.scripts.trust",
          )
        }}
      </Button>
    </div>
    <UiText
      as="p"
      variant="xs"
      muted
    >
      {{ i18n.t("spaces.http.scripts.notice") }}
    </UiText>
    <UiAlert
      v-if="unavailable"
      variant="error"
      layout="card"
    >
      {{ i18n.t("spaces.http.scripts.unavailable") }}
    </UiAlert>
    <Tabs.Tabs v-model="phase">
      <Tabs.TabsList>
        <Tabs.TabsTrigger value="preRequest">
          {{ i18n.t("spaces.http.scripts.preRequest") }}
        </Tabs.TabsTrigger>
        <Tabs.TabsTrigger value="postResponse">
          {{ i18n.t("spaces.http.scripts.postResponse") }}
        </Tabs.TabsTrigger>
      </Tabs.TabsList>
    </Tabs.Tabs>
    <HttpBodyEditor
      :key="phase"
      v-model="code"
      language="javascript"
      :class="{ 'min-h-56 flex-1': embedded }"
    />
    <UiText
      as="p"
      variant="xs"
      muted
    >
      {{ i18n.t("spaces.http.scripts.api") }}
    </UiText>
    <UiAlert
      v-if="code.length > 65536"
      variant="error"
      layout="card"
    >
      {{ i18n.t("spaces.http.scripts.errors.limit") }}
    </UiAlert>
  </div>
</template>
