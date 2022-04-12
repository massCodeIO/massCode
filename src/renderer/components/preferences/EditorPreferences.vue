<template>
  <div class="editor-preferences">
    <AppForm>
      <AppFormItem label="Font Size">
        <AppInput
          v-model="appStore.editor.fontSize"
          type="number"
          style="width: 100px"
        />
      </AppFormItem>
      <AppFormItem label="Font Family">
        <AppInput v-model="appStore.editor.fontFamily" />
      </AppFormItem>
      <AppFormItem label="Wrap">
        <AppSelect
          v-model="appStore.editor.wrap"
          :options="wrapOptions"
        />
      </AppFormItem>
      <AppFormItem label="Tab Size">
        <AppInput
          v-model="appStore.editor.tabSize"
          type="number"
          style="width: 100px"
        />
      </AppFormItem>
      <AppFormItem label="Show Invisibles">
        <AppCheckbox
          v-model="appStore.editor.showInvisibles"
          name="showInvisibles"
        />
      </AppFormItem>
    </AppForm>
  </div>
</template>

<script setup lang="ts">
import { store } from '@/electron'
import { useAppStore } from '@/store/app'
import { watch } from 'vue'

const appStore = useAppStore()

const wrapOptions = [
  { label: 'Word Wrap', value: 'free' },
  { label: 'Off', value: 'off' }
]

watch(
  () => appStore.editor,
  v => {
    store.preferences.set('editor', { ...v })
  },
  { deep: true }
)
</script>

<style lang="scss" scoped></style>
