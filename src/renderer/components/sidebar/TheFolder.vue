<template>
  <div
    class="folder"
    @dblclick="isEdit = true"
    @keypress="onKyePress"
  >
    <div
      v-if="!isEdit"
      class="name"
    >
      <div>
        {{ name }}
      </div>
    </div>
    <input
      v-else
      ref="inputRef"
      v-model="localName"
      type="text"
    >
  </div>
</template>

<script setup lang="ts">
import { emitter } from '@/composable'
import { useFolderStore } from '@/store/folders'
import { onClickOutside } from '@vueuse/core'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

interface Props {
  id: string
  name: string
}

const props = defineProps<Props>()
const folderStore = useFolderStore()

const backupName = ref(props.name)
const isEdit = ref(false)

const inputRef = ref<HTMLInputElement>()

const localName = computed({
  get: () => props.name,
  set: v => folderStore.patchFoldersById(props.id, { name: v })
})

onClickOutside(inputRef, async () => {
  isEdit.value = false
  if (!props.name) {
    await folderStore.patchFoldersById(props.id, { name: backupName.value })
  }
  backupName.value = props.name
})

const onKyePress = (e: KeyboardEvent) => {
  if (e.code === 'Enter') isEdit.value = false
}

watch(isEdit, () => {
  nextTick(() => inputRef.value?.select())
})

const onRename = (id: string) => {
  if (id === props.id) isEdit.value = true
}

emitter.on('folder:rename', onRename)

onUnmounted(() => {
  emitter.off('folder:rename', onRename)
})
</script>

<style lang="scss" scoped>
.folder {
  width: 100%;
  input {
    border: 0;
    background: #fff;
    outline: var(--color-primary) solid 1px;
    width: 95%;
    padding: 0;
    margin: 0;
  }
}
.name {
  user-select: none;
  display: table;
  table-layout: fixed;
  width: 90%;
  overflow: hidden;
  > div {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
  }
}
</style>
