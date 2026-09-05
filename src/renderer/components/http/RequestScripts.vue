<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { useHttpScriptTrust } from '@/composables/spaces/http/useHttpScriptTrust'
import { i18n } from '@/electron'
import { ShieldCheck, ShieldOff } from 'lucide-vue-next'
import { emptyHttpScripts } from '~/shared/httpScripts'

const { draft } = useHttpRuntime()
const { trusted, busy, unavailable, hasScripts, setTrust }
  = useHttpScriptTrust()
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
  <div class="space-y-3 p-3">
    <div class="flex items-center justify-between gap-3">
      <UiText
        variant="xs"
        :class="trusted ? 'text-success' : 'text-muted-foreground'"
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
    <UiText
      v-if="unavailable"
      as="p"
      variant="xs"
      class="text-destructive"
    >
      {{ i18n.t("spaces.http.scripts.unavailable") }}
    </UiText>
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
    />
    <UiText
      as="p"
      variant="xs"
      muted
    >
      {{ i18n.t("spaces.http.scripts.api") }}
    </UiText>
    <UiText
      v-if="code.length > 65536"
      as="p"
      variant="xs"
      class="text-destructive"
    >
      {{ i18n.t("spaces.http.scripts.errors.limit") }}
    </UiText>
  </div>
</template>
