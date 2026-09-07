<script setup lang="ts">
import type { DropTarget, HttpTreeNode, MoveError } from './types'
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { i18n } from '@/electron'
import { ancestorIds } from './model'

const props = defineProps<{
  nodes: HttpTreeNode[]
  validate: (ids: string[], target: DropTarget) => MoveError | undefined
}>()
const emit = defineEmits<{ move: [ids: string[], target: DropTarget] }>()
const opened = ref(false)
const ids = ref<string[]>([])
const destination = ref<string>()
const root = ref<HTMLElement>()
const candidates = computed(() =>
  props.nodes.filter(
    node =>
      node.kind !== 'request'
      && !ids.value.includes(node.id)
      && !ancestorIds(props.nodes, node.id).some(id => ids.value.includes(id)),
  ),
)
const error = computed(() =>
  destination.value
    ? props.validate(ids.value, { id: destination.value, position: 'inside' })
    : undefined,
)
function show(selection: string[]) {
  ids.value = selection
  destination.value = undefined
  opened.value = true
}
function path(node: HttpTreeNode) {
  return [...ancestorIds(props.nodes, node.id).reverse(), node.id]
    .map(id => props.nodes.find(node => node.id === id)?.name)
    .join(' / ')
}
function submit() {
  if (!destination.value || error.value)
    return
  emit('move', ids.value, { id: destination.value, position: 'inside' })
  opened.value = false
}
function autofocus(event: Event) {
  event.preventDefault()
  nextTick(() => root.value?.querySelector<HTMLElement>('button')?.focus())
}
defineExpose({ show })
</script>

<template>
  <Dialog.Dialog v-model:open="opened">
    <Dialog.DialogContent
      @open-auto-focus="autofocus"
      @close-auto-focus="(event) => event.preventDefault()"
    >
      <Dialog.DialogHeader>
        <Dialog.DialogTitle>
          {{
            i18n.t("spaces.http.tree.move")
          }}
        </Dialog.DialogTitle>
        <Dialog.DialogDescription>
          {{
            i18n.t("spaces.http.tree.destination")
          }}
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>
      <div
        ref="root"
        class="scrollbar max-h-72 space-y-1 overflow-auto"
      >
        <Button
          v-for="node in candidates"
          :key="node.id"
          :variant="destination === node.id ? 'secondary' : 'ghost'"
          :aria-pressed="destination === node.id"
          class="w-full justify-start"
          @click="destination = node.id"
        >
          {{ path(node) }}
        </Button>
      </div>
      <UiText
        v-if="error"
        variant="sm"
        class="text-destructive"
        role="alert"
      >
        {{ i18n.t(`spaces.http.tree.errors.${error}`) }}
      </UiText>
      <Dialog.DialogFooter>
        <Button
          variant="outline"
          @click="opened = false"
        >
          {{ i18n.t("spaces.http.tree.cancel") }}
        </Button>
        <Button
          :disabled="!destination || Boolean(error)"
          @click="submit"
        >
          {{ i18n.t("spaces.http.tree.apply") }}
        </Button>
      </Dialog.DialogFooter>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
