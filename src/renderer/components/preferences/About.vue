<script setup lang="ts">
import type { RuntimeInfo } from '../../../main/types/ipc'
import { Button } from '@/components/ui/shadcn/button'
import { useSonner } from '@/composables'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { i18n, ipc } from '@/electron'
import { ArrowUpRight } from 'lucide-vue-next'
import logo from '../../../../build/icons/256x256.png'
import { author, repository, version } from '../../../../package.json'

const copy = useCopyToClipboard()
const { sonner } = useSonner()
const isChecking = ref(false)
const runtimeInfo = ref<RuntimeInfo>()
const year = new Date().getFullYear()

onMounted(async () => {
  try {
    runtimeInfo.value = await ipc.invoke<void, RuntimeInfo>(
      'system:runtime-info',
    )
  }
  catch (error) {
    console.error('Failed to load runtime information', error)
  }
})
const links = [
  {
    label: i18n.t('preferences:about.website'),
    url: 'https://masscode.io?ref=masscode-app',
  },
  {
    label: i18n.t('preferences:about.sourceCode'),
    url: `${repository}?ref=masscode-app`,
  },
  {
    label: i18n.t('preferences:about.reportIssue'),
    url: `${repository}/issues/new/choose?ref=masscode-app`,
  },
  {
    label: i18n.t('preferences:about.license'),
    url: `${repository}/blob/HEAD/LICENSE?ref=masscode-app`,
  },
  {
    label: i18n.t('preferences:about.support'),
    url: 'https://masscode.io/donate?ref=masscode-app',
  },
]

async function checkUpdates() {
  isChecking.value = true
  try {
    await ipc.invoke('system:check-for-updates')
  }
  catch {
    sonner({
      message: i18n.t('preferences:about.checkUpdatesFailed'),
      type: 'error',
    })
  }
  finally {
    isChecking.value = false
  }
}
</script>

<template>
  <div class="flex min-h-full flex-col items-center px-4 py-8 text-center">
    <img
      :src="logo"
      alt=""
      class="size-20 object-contain"
      draggable="false"
    >
    <UiText
      as="h1"
      variant="xl"
      class="mt-5 font-semibold"
    >
      massCode
    </UiText>

    <div class="mt-6 flex flex-col items-center gap-1">
      <UiText
        variant="sm"
        muted
      >
        {{ i18n.t("preferences:updates.version.label") }}
      </UiText>
      <Button
        variant="ghost"
        :aria-label="i18n.t('preferences:about.copyVersion')"
        :title="i18n.t('preferences:about.copyVersion')"
        class="font-normal"
        @click="copy(`massCode v${version}`)"
      >
        {{ version }}
      </Button>
    </div>

    <Button
      variant="link"
      :disabled="isChecking"
      class="text-muted-foreground hover:text-foreground mt-3 font-normal"
      @click="checkUpdates"
    >
      {{
        i18n.t(
          isChecking
            ? "preferences:about.checkingUpdates"
            : "preferences:about.checkUpdates",
        )
      }}
    </Button>

    <div
      v-if="runtimeInfo"
      class="mt-6 space-y-1"
    >
      <UiText
        v-for="(value, key) in runtimeInfo"
        :key="key"
        as="div"
        variant="sm"
        muted
      >
        {{ i18n.t(`preferences:about.runtime.${key}`) }}: {{ value }}
      </UiText>
    </div>

    <div class="mt-8 flex flex-col items-center">
      <Button
        v-for="link in links"
        :key="link.url"
        variant="link"
        class="text-muted-foreground hover:text-foreground gap-1 font-normal"
        @click="ipc.invoke('system:open-external', link.url)"
      >
        {{ link.label }}
        <ArrowUpRight
          class="size-3 opacity-60"
          aria-hidden="true"
        />
      </Button>
    </div>

    <div class="mt-6 space-y-1">
      <UiText
        as="div"
        variant="sm"
        muted
      >
        ©2019–{{ year }}
        <Button
          variant="link"
          class="text-muted-foreground hover:text-foreground gap-1 px-1 font-normal"
          @click="
            ipc.invoke(
              'system:open-external',
              'https://antonreshetov.com/?ref=masscode-app',
            )
          "
        >
          {{ author.name }}
          <ArrowUpRight
            class="size-3 opacity-60"
            aria-hidden="true"
          />
        </Button>
      </UiText>
      <Button
        variant="link"
        class="text-muted-foreground hover:text-foreground font-normal"
        @click="
          ipc.invoke('system:open-external', 'mailto:reshetov.art@gmail.com')
        "
      >
        reshetov.art@gmail.com
      </Button>
    </div>
  </div>
</template>
