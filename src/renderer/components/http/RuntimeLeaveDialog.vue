<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { i18n } from '@/electron'

const { leaveDialogOpen, busy: saving, resolveNavigation } = useHttpRuntime()
</script>

<template>
  <Dialog.Dialog
    :open="leaveDialogOpen"
    @update:open="!$event && resolveNavigation('cancel')"
  >
    <Dialog.DialogContent class="sm:max-w-md">
      <Dialog.DialogHeader>
        <Dialog.DialogTitle>
          {{
            i18n.t("spaces.http.runtime.leaveTitle")
          }}
        </Dialog.DialogTitle>
        <Dialog.DialogDescription>
          {{
            i18n.t("spaces.http.runtime.leaveDescription")
          }}
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
          :disabled="saving"
          @click="resolveNavigation('save')"
        >
          {{ i18n.t("button.save") }}
        </Button>
      </Dialog.DialogFooter>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
