<script setup lang="ts">
import UiInput from '~/renderer/components/ui/input/Input.vue'
import { useFolders } from '~/renderer/composables'
import { icons, iconsSet } from './icons'

interface Props {
  nodeId: number
  onSetIcon?: (nodeId: number, iconName: string) => Promise<void>
}

const props = defineProps<Props>()

const { updateFolder, getFolders } = useFolders()

const search = ref('')

const containerRef = useTemplateRef('containerRef')

const iconsBySearch = computed(() => {
  if (search.value === '') {
    return icons
  }
  return icons.filter(i => i.name?.includes(search.value.toLowerCase()))
})

const selectedIndex = ref(-1)

function onKeydown(e: KeyboardEvent) {
  const len = iconsBySearch.value.length

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIndex.value + 1 < len) {
      selectedIndex.value += 1
    }
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIndex.value - 1 >= 0) {
      selectedIndex.value -= 1
    }
  }
  else if (e.key === 'Enter') {
    e.preventDefault()
    onSet(iconsBySearch.value[selectedIndex.value].name!)
  }
}

async function onSet(name: string) {
  if (!props.nodeId)
    return

  if (props.onSetIcon) {
    await props.onSetIcon(props.nodeId, name)
  }
  else {
    await updateFolder(props.nodeId, { icon: name })
    await getFolders()
  }

  containerRef.value?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  )
}

watch(
  () => search.value,
  () => {
    selectedIndex.value = -1
  },
)

watch(
  () => iconsBySearch.value,
  () => {
    if (selectedIndex.value >= iconsBySearch.value.length) {
      selectedIndex.value = -1
    }
  },
  { immediate: true },
)

watch(selectedIndex, () => {
  if (selectedIndex.value >= 0) {
    const el = document.getElementById(`icon-${selectedIndex.value}`)
    el?.scrollIntoView({
      behavior: 'auto',
      block: 'nearest',
    })
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="space-y-5"
  >
    <div>
      <UiInput
        v-model="search"
        placeholder="Search..."
        @keydown="onKeydown"
      />
    </div>
    <div class="scrollbar max-h-[200px] overflow-y-auto">
      <div class="grid auto-rows-[36px] grid-cols-8 gap-2">
        <div
          v-for="(icon, index) in iconsBySearch"
          :id="`icon-${index}`"
          :key="icon.name"
          class="user-select-none flex items-center justify-center rounded-md"
          :class="index === selectedIndex ? 'bg-muted' : 'hover:bg-muted'"
          @click="onSet(icon.name!)"
        >
          <span
            class="*:size-5"
            v-html="iconsSet[icon.name!]"
          />
        </div>
      </div>
    </div>
  </div>
</template>
