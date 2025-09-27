<script setup lang="ts">
import * as Command from '@/components/ui/shadcn/command'
import * as Popover from '@/components/ui/shadcn/popover'
import { useEditor, useSnippets } from '@/composables'
import { Check } from 'lucide-vue-next'
import { languages } from './grammars/languages'

const { cursorPosition } = useEditor()
const { selectedSnippetContent, selectedSnippet, updateSnippetContent }
  = useSnippets()

const isOpen = ref(false)

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
  return list.filter((name) => {
    // Реализуем нечеткий поиск, разбивая поисковый запрос на символы
    // и проверяя их последовательное вхождение в название языка
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
</script>

<template>
  <div
    data-editor-footer
    class="border-border flex items-center justify-between border-t px-2 py-1 text-xs"
  >
    <div>
      <Popover.Popover v-model:open="isOpen">
        <Popover.PopoverTrigger as-child>
          <UiButton
            variant="icon"
            class="-ml-1"
          >
            {{ selectedLanguageName }}
          </UiButton>
        </Popover.PopoverTrigger>
        <Popover.PopoverContent class="w-auto py-0">
          <Command.Command :filter-function="fuzzySearch as any">
            <Command.CommandInput
              class="h-9"
              placeholder="Select Language Mode"
            />
            <Command.CommandEmpty>No language found</Command.CommandEmpty>
            <Command.CommandList>
              <Command.CommandGroup>
                <PerfectScrollbar :options="{ minScrollbarLength: 20 }">
                  <div class="_overflow-y-auto max-h-[150px]">
                    <Command.CommandItem
                      v-for="language in languages"
                      :key="language.value"
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
                </PerfectScrollbar>
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
