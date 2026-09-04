<script setup lang="ts">
import { Field, FieldError, FieldLabel } from '@/components/ui/shadcn/field'
import { Input } from '@/components/ui/shadcn/input'
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { i18n } from '@/electron'

const props = defineProps<{
  group: 'extractions' | 'assertions'
  index: number
  field: 'name' | 'path' | 'expected'
  label: string
  placeholder?: string
}>()
const model = defineModel<string | number>()
const id = useId()
const { fieldError, touchField } = useHttpRuntime()
const error = computed(() => {
  const code = fieldError(props.group, props.index, props.field)
  return code ? i18n.t(`spaces.http.runtime.validation.${code}`) : undefined
})
</script>

<template>
  <Field
    class="min-w-0 gap-0"
    :data-invalid="!!error"
  >
    <FieldLabel
      :for="id"
      class="sr-only"
    >
      {{ label }}
    </FieldLabel>
    <Input
      :id="id"
      v-model="model"
      class="h-7 min-w-0"
      :placeholder="placeholder"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${id}-error` : undefined"
      @blur="touchField(group, index, field)"
    />
    <div class="h-4 min-w-0">
      <Tooltip.Tooltip v-if="error">
        <Tooltip.TooltipTrigger as-child>
          <FieldError
            :id="`${id}-error`"
            tabindex="0"
            class="truncate text-xs leading-4"
          >
            {{ error }}
          </FieldError>
        </Tooltip.TooltipTrigger>
        <Tooltip.TooltipContent class="max-w-64">
          {{ error }}
        </Tooltip.TooltipContent>
      </Tooltip.Tooltip>
    </div>
  </Field>
</template>
