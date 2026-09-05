<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Plus } from 'lucide-vue-next'

defineProps<{ label: string }>()
</script>

<template>
  <Button
    type="button"
    variant="ghost"
    class="text-muted-foreground hover:text-foreground mt-1 h-7 w-fit shrink-0 gap-1 rounded px-2 text-xs font-normal"
  >
    <Plus class="size-3.5" />
    {{ label }}
  </Button>
</template>
