<script setup lang="ts">
import type { PerfectScrollbarExpose } from 'vue3-perfect-scrollbar'
import type { TagItem } from './types'
import { i18n } from '@/electron'
import { X } from 'lucide-vue-next'

interface Props {
  modelValue: TagItem[]
  placeholder?: string
  suggestions: TagItem[]
}

interface Emits {
  (e: 'update:modelValue', value: TagItem[]): void
  (e: 'createTag', value: TagItem): void
  (e: 'deleteTag', value: TagItem): void
  (e: 'addTag', value: TagItem): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: `${i18n.t('placeholder.addTag')}...`,
})

const emit = defineEmits<Emits>()

const tags = ref<TagItem[]>([...props.modelValue])
const inputValue = ref('')
const filteredSuggestions = ref<TagItem[]>([])
const warningTagIndex = ref<number | null>(null)
const selectedSuggestionIndex = ref(-1)

const isFocused = ref(false)

const inputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const suggestionsRef = ref<HTMLDivElement | null>(null)
const scrollbarRef = ref<
  (PerfectScrollbarExpose & { $el: HTMLElement }) | null
>(null)

const dropdownStyle = ref({
  top: '0px',
  left: '0px',
  width: '0px',
})

function updateDropdownPosition() {
  nextTick(() => {
    if (containerRef.value && suggestionsRef.value) {
      const rect = containerRef.value.getBoundingClientRect()

      const availableHeight = window.innerHeight - rect.bottom - 10 // 10px - отступ снизу
      const maxHeight = Math.min(240, availableHeight)

      dropdownStyle.value = {
        top: `${rect.bottom}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      }

      if (scrollbarRef.value?.$el) {
        scrollbarRef.value.$el.style.maxHeight = `${maxHeight}px`
      }
    }
  })
}

function addTag() {
  const value = inputValue.value.trim()
  if (
    value
    && !tags.value.some(tag => tag.name.toLowerCase() === value.toLowerCase())
  ) {
    const existingTag = props.suggestions.find(
      suggestion => suggestion.name.toLowerCase() === value.toLowerCase(),
    )

    if (existingTag) {
      tags.value.push({ ...existingTag })
      emit('addTag', { ...existingTag })
    }
    else {
      const newId = Date.now()
      const newTag = { id: newId, name: value }
      tags.value.push(newTag)
      emit('createTag', newTag)
    }

    inputValue.value = ''
    filteredSuggestions.value = []
    selectedSuggestionIndex.value = -1
  }
}

function removeTag(index: number) {
  const tagToRemove = tags.value[index]
  tags.value.splice(index, 1)
  warningTagIndex.value = null
  emit('deleteTag', tagToRemove)
}

function removeLastTag() {
  if (inputValue.value === '' && tags.value.length > 0) {
    const lastIndex = tags.value.length - 1

    if (warningTagIndex.value === lastIndex) {
      // Второе нажатие backspace - удаляем тег
      const tagToRemove = tags.value[lastIndex]
      tags.value.pop()
      warningTagIndex.value = null
      emit('deleteTag', tagToRemove)
    }
    else {
      // Первое нажатие backspace - показываем предупреждение
      warningTagIndex.value = lastIndex
    }
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    inputValue.value = ''
    filteredSuggestions.value = []
    warningTagIndex.value = null
    inputRef.value?.blur()
    return
  }

  if (filteredSuggestions.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      // Переход на следующий элемент или в начало списка
      selectedSuggestionIndex.value
        = (selectedSuggestionIndex.value + 1) % filteredSuggestions.value.length

      ensureSelectedSuggestionVisible()
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault()
      // Переход на предыдущий элемент или в конец списка
      selectedSuggestionIndex.value
        = selectedSuggestionIndex.value <= 0
          ? filteredSuggestions.value.length - 1
          : selectedSuggestionIndex.value - 1

      ensureSelectedSuggestionVisible()
    }
    else if (e.key === 'Enter') {
      e.preventDefault()

      if (selectedSuggestionIndex.value !== -1) {
        selectSuggestion(
          filteredSuggestions.value[selectedSuggestionIndex.value],
        )
      }
      else {
        addTag()
      }

      warningTagIndex.value = null
    }
  }
  else if (e.key === 'Enter') {
    e.preventDefault()
    addTag()
    warningTagIndex.value = null
  }

  if (e.key === 'Backspace') {
    removeLastTag()
  }
  else if (
    e.key !== 'ArrowDown'
    && e.key !== 'ArrowUp'
    && e.key !== 'Enter'
    && e.key !== 'Escape'
  ) {
    warningTagIndex.value = null
  }
}

function ensureSelectedSuggestionVisible() {
  nextTick(() => {
    const listItems = suggestionsRef.value?.querySelectorAll('li')
    const scrollContainer = suggestionsRef.value?.querySelector('.ps')

    if (listItems && scrollContainer && selectedSuggestionIndex.value >= 0) {
      const selectedItem = listItems[selectedSuggestionIndex.value]

      if (selectedItem) {
        const containerRect = scrollContainer.getBoundingClientRect()
        const selectedRect = selectedItem.getBoundingClientRect()

        if (selectedRect.top < containerRect.top) {
          // Элемент выше видимой области
          scrollContainer.scrollTop -= containerRect.top - selectedRect.top
        }
        else if (selectedRect.bottom > containerRect.bottom) {
          // Элемент ниже видимой области
          scrollContainer.scrollTop
            += selectedRect.bottom - containerRect.bottom
        }
      }
    }
  })
}

function updateFilteredSuggestions() {
  if (inputValue.value) {
    const lowerCaseInput = inputValue.value.toLowerCase()
    filteredSuggestions.value = props.suggestions
      .filter(
        suggestion => !tags.value.some(tag => tag.id === suggestion.id),
      )
      .filter(suggestion =>
        suggestion.name.toLowerCase().includes(lowerCaseInput),
      )

    if (filteredSuggestions.value.length > 0) {
      updateDropdownPosition()
    }
  }
  else {
    filteredSuggestions.value = []
  }
}

function handleInput() {
  updateFilteredSuggestions()
}

function selectSuggestion(suggestion: TagItem) {
  if (!tags.value.some(tag => tag.id === suggestion.id)) {
    tags.value.push({ ...suggestion })
    emit('addTag', { ...suggestion })
    inputValue.value = ''
    filteredSuggestions.value = []
    selectedSuggestionIndex.value = -1
  }
}

function focusInput() {
  inputRef.value?.focus()
  isFocused.value = true
  if (filteredSuggestions.value.length > 0) {
    updateDropdownPosition()
  }
}

function handleBlur() {
  setTimeout(() => {}, 200)

  nextTick(() => {
    isFocused.value = false
    filteredSuggestions.value = []
    warningTagIndex.value = null
    selectedSuggestionIndex.value = -1
    inputValue.value = ''
  })
}

function resetWarning() {
  warningTagIndex.value = null
}

function handleResize() {
  if (isFocused.value && filteredSuggestions.value.length > 0) {
    updateDropdownPosition()
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

watch(
  () => props.modelValue,
  (newValue) => {
    tags.value = [...newValue]
  },
  { deep: true },
)

watch(filteredSuggestions, () => {
  selectedSuggestionIndex.value = -1
})

watch(isFocused, (newValue) => {
  if (newValue && filteredSuggestions.value.length > 0) {
    updateDropdownPosition()
  }
})

watch(
  () => filteredSuggestions.value,
  () => {
    nextTick(() => {
      if (scrollbarRef.value) {
        scrollbarRef.value.ps?.update()
      }
    })
  },
)
</script>

<template>
  <div
    ref="containerRef"
    class="relative flex flex-wrap items-center gap-1 rounded px-2 py-1"
    @click="focusInput"
  >
    <div
      v-for="(tag, index) in tags"
      :key="tag.id"
      class="bg-list-selection text-text flex items-center rounded-sm px-1.5 py-0.5 text-xs select-none"
      :class="{ 'ring-primary ring-1': warningTagIndex === index }"
      @click="resetWarning"
    >
      <div>{{ tag.name }}</div>
      <X
        class="hover:text-text-muted relative top-[1px] -mr-0.5 ml-1 h-3 w-3"
        @click.stop="removeTag(index)"
      />
    </div>
    <input
      ref="inputRef"
      v-model="inputValue"
      type="text"
      :placeholder="tags.length ? '' : placeholder"
      class="w-full min-w-[120px] flex-1 bg-transparent text-xs outline-none"
      @keydown="handleKeydown"
      @input="handleInput"
      @focus="focusInput"
      @blur="handleBlur"
    >
  </div>
  <div
    v-if="isFocused && filteredSuggestions.length > 0"
    ref="suggestionsRef"
    class="bg-bg border-border fixed z-50 rounded-md border shadow-lg"
    :style="dropdownStyle"
  >
    <PerfectScrollbar
      ref="scrollbarRef"
      :options="{ minScrollbarLength: 20, suppressScrollX: true }"
    >
      <ul class="w-full p-1">
        <li
          v-for="(suggestion, index) in filteredSuggestions"
          :key="suggestion.id"
          class="cursor-pointer rounded-sm px-2 py-0.5 text-sm"
          :class="[
            `suggestion-item-${index}`,
            index === selectedSuggestionIndex
              ? 'bg-list-selection text-text'
              : 'hover:bg-list-selection',
          ]"
          @mousedown.prevent="selectSuggestion(suggestion)"
          @mouseover="selectedSuggestionIndex = index"
        >
          {{ suggestion.name }}
        </li>
      </ul>
    </PerfectScrollbar>
  </div>
</template>
