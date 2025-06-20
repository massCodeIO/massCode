<script setup lang="ts">
import { i18n, ipc } from '@/electron'

interface Emits {
  (e: 'closeToast'): void
}

const emit = defineEmits<Emits>()

const message = computed(() => {
  return i18n.t('messages:special.supportMessage', {
    tagStart: '<a id="donate" href="#" class="text-blue-500">',
    tagEnd: '</a>',
  })
})

onMounted(() => {
  document.getElementById('donate')?.addEventListener('click', () => {
    ipc.invoke('system:open-external', 'https://masscode.io/donate')
    emit('closeToast')
  })
})
</script>

<template>
  <div v-html="message" />
</template>
