<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    value: unknown
    label?: string
    initiallyOpen?: boolean
  }>(),
  { initiallyOpen: false },
)
const open = ref(props.initiallyOpen)
const children = computed(() =>
  props.value !== null && typeof props.value === 'object'
    ? Object.entries(props.value)
    : null,
)
const expandable = computed(
  () =>
    children.value !== null
    || (typeof props.value === 'string'
      && (props.value.length > 100 || props.value.includes('\n'))),
)
const text = computed(() =>
  typeof props.value === 'string' ? props.value : JSON.stringify(props.value),
)
const summary = computed(() =>
  children.value
    ? `${Array.isArray(props.value) ? '[…]' : '{…}'} (${children.value.length})`
    : text.value,
)
</script>

<template>
  <div class="min-w-0">
    <Button
      v-if="expandable"
      variant="ghost"
      size="sm"
      class="h-7 w-full justify-start gap-1 px-1"
      :aria-expanded="open"
      @click="open = !open"
    >
      <ChevronDown
        v-if="open"
        class="size-3 shrink-0"
      />
      <ChevronRight
        v-else
        class="size-3 shrink-0"
      />
      <UiText
        v-if="label"
        variant="xs"
        mono
        class="shrink-0"
      >
        {{ label }}:
      </UiText>
      <UiText
        variant="xs"
        mono
        muted
        class="truncate"
      >
        {{ summary }}
      </UiText>
    </Button>
    <UiText
      v-else
      as="div"
      variant="xs"
      mono
      class="px-1 py-1 break-words whitespace-pre-wrap select-text"
    >
      <UiText
        v-if="label"
        variant="xs"
        mono
        muted
      >
        {{ label }}:
      </UiText>{{ text }}
    </UiText>
    <div
      v-if="open && expandable"
      class="ml-3 border-l pl-2"
    >
      <template v-if="children">
        <JsonTree
          v-for="[key, item] in children"
          :key="key"
          :label="key"
          :value="item"
        />
      </template>
      <UiText
        v-else
        as="pre"
        variant="xs"
        mono
        class="py-1 break-words whitespace-pre-wrap select-text"
      >
        {{ text }}
      </UiText>
    </div>
  </div>
</template>
