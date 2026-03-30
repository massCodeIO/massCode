<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Command from '@/components/ui/shadcn/command'
import * as Popover from '@/components/ui/shadcn/popover'
import { useEditor, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { Check } from 'lucide-vue-next'
import { languages } from './grammars/languages'

const { cursorPosition } = useEditor()
const { selectedSnippetContent, selectedSnippet, updateSnippetContent }
  = useSnippets()

const isOpen = ref(false)
const languageListRef = ref<HTMLElement>()

function onSelect(value: string) {
  isOpen.value = false
  updateSnippetContent(
    selectedSnippet.value!.id,
    selectedSnippetContent.value!.id,
    {
      label: selectedSnippetContent.value!.label,
      value: selectedSnippetContent.value!.value,
      language: value,
    },
  )
}

const selectedLanguageName = computed(() => {
  return languages.find(
    language => language.value === selectedSnippetContent.value?.language,
  )?.name
})

function fuzzySearch(list: string[], searchTerm: string) {
  return list.filter((value) => {
    const language = languages.find(l => l.value === value)
    const name = language?.name || value
    const searchChars = searchTerm.toLowerCase().split('')
    let currentIndex = 0

    return searchChars.every((char) => {
      const index = name.toLowerCase().indexOf(char, currentIndex)
      if (index === -1)
        return false
      currentIndex = index + 1
      return true
    })
  })
}

function scrollToSelectedLanguage() {
  const selectedLanguage = selectedSnippetContent.value?.language

  if (!languageListRef.value || !selectedLanguage)
    return

  const selectedItem = Array.from(
    languageListRef.value.querySelectorAll<HTMLElement>('[data-language-item]'),
  ).find(item => item.dataset.languageItem === selectedLanguage)

  selectedItem?.scrollIntoView({ block: 'center' })
}

watch(isOpen, async (open) => {
  if (!open)
    return

  await nextTick()
  requestAnimationFrame(scrollToSelectedLanguage)
})
</script>

<template>
  <div
    data-editor-footer
    class="border-border flex items-center justify-between border-t px-2 py-1 text-xs"
  >
    <div>
      <Popover.Popover v-model:open="isOpen">
        <Popover.PopoverTrigger as-child>
          <Button
            variant="ghost"
            class="-ml-1"
            :class="!selectedLanguageName && 'text-muted-foreground'"
          >
            {{ selectedLanguageName || i18n.t("placeholder.selectLanguage") }}
          </Button>
        </Popover.PopoverTrigger>
        <Popover.PopoverContent class="w-auto px-1 py-0">
          <Command.Command
            :filter-function="fuzzySearch as any"
            :model-value="selectedSnippetContent?.language"
          >
            <Command.CommandInput
              class="h-9"
              placeholder="Select Language Mode"
            />
            <Command.CommandEmpty>No language found</Command.CommandEmpty>
            <Command.CommandList>
              <Command.CommandGroup>
                <div
                  ref="languageListRef"
                  class="scrollbar max-h-[150px] overflow-y-auto"
                >
                  <Command.CommandItem
                    v-for="language in languages"
                    :key="language.value"
                    :data-language-item="language.value"
                    class="hover:bg-accent-hover transition-colors"
                    :value="language.value"
                    @select="onSelect(language.value)"
                  >
                    {{ language.name }}
                    <Check
                      class="ml-auto h-4 w-4"
                      :class="
                        selectedSnippetContent?.language === language.value
                          ? 'opacity-100'
                          : 'opacity-0'
                      "
                    />
                  </Command.CommandItem>
                </div>
              </Command.CommandGroup>
            </Command.CommandList>
          </Command.Command>
        </Popover.PopoverContent>
      </Popover.Popover>
    </div>
    <div class="mr-1">
      Ln {{ cursorPosition.row + 1 }}, Col {{ cursorPosition.column + 1 }}
    </div>
  </div>
</template>
