<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { Input } from '@/components/ui/shadcn/input'
import { useHttpCookies } from '@/composables/spaces/http/devtools/useHttpCookies'
import { useHttpUi } from '@/composables/spaces/http/useHttpUi'
import { i18n } from '@/electron'
import { Cookie, Trash2 } from 'lucide-vue-next'

const { cookiesOpen: open } = useHttpUi()
const {
  state,
  query,
  revealRowKey,
  error,
  busy,
  rows,
  addCookie,
  updateCookie,
  saveRaw,
  remove,
  clear,
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
        </div>
        <UiAlert
          v-if="error"
          variant="error"
          layout="card"
        >
          {{ error }}
        </UiAlert>
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
      </div>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
