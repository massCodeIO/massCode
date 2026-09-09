<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { FieldError, FieldLabel } from '@/components/ui/shadcn/field'
import { Input } from '@/components/ui/shadcn/input'
import { useHttpCookies } from '@/composables/spaces/http/devtools/useHttpCookies'
import { i18n } from '@/electron'
import { Cookie, RefreshCw, Trash2 } from 'lucide-vue-next'

const open = ref(false)
const requestSettingId = useId()
const {
  state,
  query,
  revealRowKey,
  error,
  busy,
  requestId,
  rows,
  action,
  refresh,
  addCookie,
  updateCookie,
  saveRaw,
  remove,
  clear,
  setEnabled,
} = useHttpCookies(open)
</script>

<template>
  <Button
    variant="ghost"
    size="sm"
    @click="open = true"
  >
    <Cookie class="size-3.5" /><UiText variant="xs">
      {{ i18n.t("spaces.http.devtools.cookies") }}
    </UiText>
  </Button>
  <Dialog.Dialog v-model:open="open">
    <Dialog.DialogContent
      class="grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-[min(1200px,calc(100vw-2rem))]"
      @open-auto-focus="(e) => e.preventDefault()"
      @close-auto-focus="(e) => e.preventDefault()"
    >
      <Dialog.DialogHeader>
        <Dialog.DialogTitle>
          {{ i18n.t("spaces.http.devtools.cookies") }}
        </Dialog.DialogTitle>
      </Dialog.DialogHeader>
      <div
        class="flex h-[min(560px,calc(100vh-8rem))] min-h-0 min-w-0 flex-col gap-3"
      >
        <div class="flex items-center gap-2">
          <Input
            v-model="query"
            class="min-w-0 flex-1"
            :placeholder="i18n.t('spaces.http.devtools.searchCookies')"
            :aria-label="i18n.t('spaces.http.devtools.searchCookies')"
          />
          <UiActionButton
            :disabled="busy"
            :tooltip="i18n.t('spaces.http.devtools.refreshCookies')"
            @click="action(refresh)"
          >
            <RefreshCw class="size-3.5" />
          </UiActionButton>
        </div>
        <FieldError
          v-if="error"
          class="text-xs"
        >
          {{ error }}
        </FieldError>
        <div
          class="border-border flex min-h-[100px] flex-1 flex-col overflow-auto rounded-md border"
        >
          <HttpDevtoolsCookiesTable
            :rows="rows"
            :reveal-row-key="revealRowKey"
            :busy="busy"
            :update-cookie="updateCookie"
            :save-raw="saveRaw"
            :remove-cookie="remove"
          >
            <template #footer-actions>
              <HttpAddRowButton
                :label="i18n.t('spaces.http.devtools.addCookie')"
                :disabled="busy"
                @click="addCookie"
              />
            </template>
          </HttpDevtoolsCookiesTable>
        </div>
        <div class="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            class="text-destructive"
            :disabled="busy || !state.cookies.length"
            @click="clear()"
          >
            <Trash2 class="size-3.5" />{{
              i18n.t("spaces.http.devtools.clearAllCookies")
            }}
          </Button>
        </div>
        <div
          v-if="requestId"
          class="shrink-0 space-y-2 pt-1"
        >
          <div class="flex items-center gap-2">
            <Checkbox
              :id="requestSettingId"
              :model-value="state.enabled"
              :disabled="busy"
              :aria-describedby="`${requestSettingId}-hint`"
              @update:model-value="setEnabled"
            />
            <FieldLabel :for="requestSettingId">
              <UiText
                variant="sm"
                weight="medium"
              >
                {{ i18n.t("spaces.http.devtools.enableCookieJar") }}
              </UiText>
            </FieldLabel>
          </div>
          <UiText
            :id="`${requestSettingId}-hint`"
            class="pl-6"
            as="div"
            variant="xs"
            muted
          >
            {{ i18n.t("spaces.http.devtools.cookieJarHint") }}
          </UiText>
        </div>
      </div>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
