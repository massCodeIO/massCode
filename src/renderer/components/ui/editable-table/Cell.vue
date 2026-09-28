<script setup lang="ts">
import { Input } from '@/components/ui/shadcn/input'
import { useCellDraft } from './useCellDraft'

const props = defineProps<{
  value: string
  label: string
  placeholder?: string
  type?: 'text' | 'password'
  disabled?: boolean
  save: (value: string) => Promise<boolean | void> | boolean | void
}>()
const emit = defineEmits<{ input: [value: string], blur: [] }>()
const { draft, pending, focus, cancel, commit } = useCellDraft(
  () => props.value,
  value => props.save(value),
)
function onInput(value: string | number) {
  draft.value = String(value)
  emit('input', draft.value)
}
async function onBlur() {
  await commit()
  emit('blur')
}
function onEnter(event: KeyboardEvent) {
  if (event.isComposing)
    return
  const input = event.target as HTMLInputElement
  input.blur()
}
function onEscape(event: KeyboardEvent) {
  cancel()
  emit('input', draft.value)
  const input = event.target as HTMLInputElement
  input.blur()
}
</script>

<template>
  <Input
    :model-value="draft"
    variant="ghost"
    :type="type ?? 'text'"
    :aria-label="label"
    :placeholder="placeholder"
    :disabled="disabled || pending"
    @update:model-value="onInput"
    @focus="focus"
    @blur="onBlur"
    @keydown.enter="onEnter"
    @keydown.esc.stop="onEscape"
  />
</template>
