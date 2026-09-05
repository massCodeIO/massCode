<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { useHttpWebSocket } from '@/composables/spaces/http/useHttpWebSocket'
import { i18n } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'

const { view, active, connect, disconnect } = useHttpWebSocket()
</script>

<template>
  <Button
    variant="ghost"
    :disabled="view?.state === 'closing'"
    @click="active ? disconnect() : connect()"
  >
    <LoaderCircle
      v-if="view?.state === 'connecting' || view?.state === 'closing'"
      class="size-4 animate-spin"
    />
    {{
      i18n.t(
        active
          ? "spaces.http.websocket.disconnect"
          : "spaces.http.websocket.connect",
      )
    }}
  </Button>
</template>
