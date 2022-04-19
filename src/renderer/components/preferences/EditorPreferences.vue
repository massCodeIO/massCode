<template>
  <div class="editor-preferences">
    <AppForm>
      <h4>Editor</h4>
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
      <AppFormItem label="Highlight Line">
        <AppCheckbox
          v-model="appStore.editor.highlightLine"
          name="showInvisibles"
        />
      </AppFormItem>
      <AppFormItem label="Highlight Gutter">
        <AppCheckbox
          v-model="appStore.editor.highlightGutter"
          name="showInvisibles"
        />
      </AppFormItem>
      <h4>Prettier</h4>
      <AppFormItem label="Trailing Comma">
        <AppSelect
          v-model="appStore.editor.trailingComma"
          :options="trailingCommaOptions"
        />
      </AppFormItem>
      <AppFormItem label="Semi">
        <AppCheckbox
          v-model="appStore.editor.semi"
          name="semi"
        />
      </AppFormItem>
      <AppFormItem label="Single Quote">
        <AppCheckbox
          v-model="appStore.editor.singleQuote"
          name="semi"
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

const trailingCommaOptions = [
  { label: 'None', value: 'none' },
  { label: 'All', value: 'all' },
  { label: 'ES6', value: 'es6' }
]

watch(
  () => appStore.editor,
  v => {
    store.preferences.set('editor', { ...v })
  },
  { deep: true }
)
</script>

<style lang="scss" scoped>
h4 {
  &:first-child {
    margin-top: 0;
  }
  margin-bottom: 0;
}
</style>
