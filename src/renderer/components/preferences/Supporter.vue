<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { useApp, useSonner } from '@/composables'
import { i18n, ipc, store } from '@/electron'

interface ActivateLicenseResult {
  active: boolean
  name: string | null
  email: string | null
}

const SUPPORT_EMAIL = 'reshetov.art@gmail.com'

const { isSponsored } = useApp()
const { sonner } = useSonner()

const licenseKey = ref('')
const supporterName = ref<string | null>(
  store.app.get('license.name') as string | null,
)
const supporterEmail = ref<string | null>(
  store.app.get('license.email') as string | null,
)

const supporterLabel = computed(() => {
  if (supporterName.value && supporterEmail.value) {
    return `${supporterName.value} (${supporterEmail.value})`
  }

  return supporterName.value || supporterEmail.value
})

async function activateLicense() {
  const key = licenseKey.value.trim()

  if (!key) {
    return
  }

  const result = (await ipc.invoke('system:activate-license', {
    key,
  })) as ActivateLicenseResult

  if (!result.active) {
    sonner({
      message: i18n.t('messages:error.licenseInvalid'),
      type: 'error',
    })
    return
  }

  isSponsored.value = true
  supporterName.value = result.name
  supporterEmail.value = result.email
  licenseKey.value = ''

  sonner({
    message: i18n.t('messages:success.licenseActivated'),
    type: 'success',
  })
}

function requestKeyByEmail() {
  const subject = encodeURIComponent('massCode supporter key request')
  void ipc.invoke(
    'system:open-external',
    `mailto:${SUPPORT_EMAIL}?subject=${subject}`,
  )
}
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection :label="i18n.t('preferences:supporter.label')">
      <UiMenuFormItem
        v-if="isSponsored"
        :label="i18n.t('preferences:supporter.status.label')"
      >
        <UiText
          as="div"
          variant="base"
        >
          {{
            supporterLabel
              ? i18n.t("preferences:supporter.status.activeFor", {
                name: supporterLabel,
              })
              : i18n.t("preferences:supporter.status.active")
          }}
        </UiText>
        <template #description>
          {{ i18n.t("preferences:supporter.status.description") }}
        </template>
      </UiMenuFormItem>

      <template v-else>
        <UiMenuFormItem :label="i18n.t('preferences:supporter.key.label')">
          <div class="flex flex-wrap items-center gap-2">
            <UiInput
              v-model="licenseKey"
              :placeholder="i18n.t('preferences:supporter.key.placeholder')"
              size="sm"
              class="w-72"
            />
            <Button
              variant="outline"
              @click="activateLicense"
            >
              {{ i18n.t("preferences:supporter.key.activate") }}
            </Button>
          </div>
          <template #description>
            {{ i18n.t("preferences:supporter.key.description") }}
          </template>
        </UiMenuFormItem>

        <UiMenuFormItem :label="i18n.t('preferences:supporter.request.label')">
          <Button
            variant="outline"
            @click="requestKeyByEmail"
          >
            {{ i18n.t("preferences:supporter.request.action") }}
          </Button>
          <template #description>
            {{ i18n.t("preferences:supporter.request.description") }}
          </template>
        </UiMenuFormItem>
      </template>
    </UiMenuFormSection>
  </div>
</template>
