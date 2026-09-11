<script setup lang="ts">
import { useHttpEnvironments } from '@/composables/spaces/http/useHttpEnvironments'

const props = defineProps<{
  environmentId: number
  name: string
  value: string
}>()
const { environments, updateHttpEnvironment } = useHttpEnvironments()
const draft = ref(props.value)
const editing = ref(false)
watch(
  () => props.value,
  (value) => {
    if (!editing.value)
      draft.value = value
  },
)
async function save() {
  editing.value = false
  if (draft.value === props.value)
    return
  const env = environments.value.find(
    item => item.id === props.environmentId,
  )
  if (!env || env.secretKeys.includes(props.name))
    return
  await updateHttpEnvironment(env.id, {
    variables: { ...env.variables, [props.name]: draft.value },
  })
}
</script>

<template>
  <UiInput
    v-model="draft"
    variant="ghost"
    class="!h-7 min-w-0"
    :aria-label="name"
    @focus="editing = true"
    @blur="save"
    @keydown.enter="save"
  />
</template>
