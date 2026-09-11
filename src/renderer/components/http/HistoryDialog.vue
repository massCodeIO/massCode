<script setup lang="ts">
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useHttpHistory } from '@/composables/spaces/http/useHttpHistory'
import { i18n } from '@/electron'

const { selected, snapshot, loadingSnapshot, snapshotError, closeHistory }
  = useHttpHistory()
</script>

<template>
  <Dialog.Dialog
    :open="!!selected"
    @update:open="!$event && closeHistory()"
  >
    <Dialog.DialogContent
      class="flex h-[80vh] flex-col sm:max-w-4xl"
      @open-auto-focus="$event.preventDefault()"
      @close-auto-focus="$event.preventDefault()"
    >
      <Dialog.DialogHeader>
        <Dialog.DialogTitle>
          {{
            i18n.t("spaces.http.history.title")
          }}
        </Dialog.DialogTitle>
        <Dialog.DialogDescription class="break-all">
          {{ selected?.method }} {{ selected?.url }}
          <span v-if="selected">
            · {{ new Date(selected.requestedAt).toLocaleString() }}</span>
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>
      <UiText
        v-if="selected"
        variant="xs"
        muted
      >
        {{
          selected.status ?? i18n.t("spaces.http.collection.dashboard.error")
        }}
        ·
        {{
          i18n.t("spaces.http.collection.dashboard.duration", {
            value: selected.durationMs,
          })
        }}
      </UiText>
      <UiText
        v-if="loadingSnapshot || snapshotError || !snapshot"
        variant="sm"
        muted
      >
        {{
          i18n.t(
            `spaces.http.history.${loadingSnapshot ? "loading" : snapshotError ? "failed" : "unavailable"}`,
          )
        }}
      </UiText>
      <HttpHistorySnapshot
        v-else
        :snapshot="snapshot"
      />
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
