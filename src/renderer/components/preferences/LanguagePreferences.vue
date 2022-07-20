<template>
  <div class="language-preferences">
    <AppFormItem :label="i18n.t('preferences:language.label')">
      <AppSelect
        v-model="localValue"
        :options="options"
      />

      <AppButton
        v-if="isChanged"
        @click="onReload"
      >
        {{ i18n.t('restartApp') }}
      </AppButton>
    </AppFormItem>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/store/app'
import { computed, ref } from 'vue'
import { i18n, ipc, track } from '@/electron'

const appStore = useAppStore()

const storedValue = ref(appStore.language)
const isChanged = ref(false)

const localValue = computed({
  get: () => appStore.language,
  set: v => {
    if (v !== storedValue.value) {
      isChanged.value = true
    } else {
      isChanged.value = false
    }
    appStore.setLang(v)
    track('app/set-language', v)
  }
})

const options = [
  {
    label: i18n.t('preferences:language.en'),
    value: 'en'
  },

  {
    label: i18n.t('preferences:language.ru'),
    value: 'ru'
  }
]

const onReload = () => {
  ipc.invoke('main:restart', {})
}
</script>

<style lang="scss" scoped></style>
