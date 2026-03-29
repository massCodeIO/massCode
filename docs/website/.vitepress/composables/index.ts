import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useDark() {
  const isDark = ref(false)

  const checkIsDark = () => {
    isDark.value = document.documentElement.classList.contains('dark')
  }

  onMounted(() => {
    checkIsDark()

    const observer = new MutationObserver(() => {
      checkIsDark()
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    onBeforeUnmount(() => observer.disconnect())
  })

  return { isDark }
}
