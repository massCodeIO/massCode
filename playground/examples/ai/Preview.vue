<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Select from '@/components/ui/shadcn/select'
import { TooltipProvider } from '@/components/ui/shadcn/tooltip'
import { retry, stale, stopTimer, stream } from './demoState'
import { demoEditor, scenarios } from './fixtures'
import {
  context,
  conversation,
  dark,
  failActions,
  i18n,
  isStreaming,
  notice,
  requestDirty,
  resetComposer,
  searchMode,
  settings,
} from './mocks'

const selected = ref(scenarios[0].id)
const query = ref('')
const width = ref('420')
const language = ref('en_US')
const revision = ref(0)
const groups = computed(() => [
  ...new Set(scenarios.map(item => item.group)),
])
const catalog = computed(() =>
  groups.value
    .flatMap(group => scenarios.filter(item => item.group === group))
    .map((item, index) => ({
      ...item,
      number: String(index + 1).padStart(2, '0'),
    })),
)
const current = computed(
  () => catalog.value.find(item => item.id === selected.value)!,
)
const visible = computed(() =>
  catalog.value.filter(item =>
    `${item.number} ${item.title} ${item.group} ${item.description}`
      .toLowerCase()
      .includes(query.value.toLowerCase()),
  ),
)
function reset() {
  stopTimer()
  resetComposer(current.value.composer)
  context.value = current.value.composer?.editor ?? demoEditor
  stale.value = !!current.value.stale
  settings.value.profiles.openai.hasKey = current.value.configured !== false
  searchMode.value = current.value.search ?? 'normal'
  conversation.value = JSON.parse(JSON.stringify(current.value.conversation))
  conversation.value.historyOmitted = current.value.historyOmitted
  conversation.value.error = current.value.error
  conversation.value.diagnostic = current.value.diagnostic
  isStreaming.value = !!current.value.streaming
  failActions.value = false
  requestDirty.value = !!current.value.dirty
  notice.value = ''
  revision.value++
  if (current.value.retryOnOpen)
    void retry(conversation.value.messages.at(-1)!)
  if (current.value.animate) {
    stream(
      conversation.value.messages.at(-1)!,
      'Проверяю обработку ответа…\n\n```typescript\nasync function loadProfile() {\n  const response = await fetch("/api/profile")\n  if (!response.ok) throw new Error("HTTP error")\n  return response.json()\n}\n```\n\nГотово. Добавлена проверка статуса.',
    )
  }
}
watch(selected, reset, { immediate: true })
watch(dark, value =>
  document.documentElement.classList.toggle('dark', value))
watch(
  language,
  async (value) => {
    await i18n.changeLanguage(value)
    revision.value++
  },
  { immediate: true },
)
</script>

<template>
  <TooltipProvider>
    <div class="bg-background text-foreground flex h-screen flex-col">
      <header
        class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-5 py-3"
      >
        <div>
          <UiText
            as="h1"
            variant="lg"
            weight="semibold"
          >
            AI response lab
          </UiText>
          <UiText
            as="p"
            variant="xs"
            muted
          >
            {{ scenarios.length }} сценариев · реальные компоненты · тестовые
            данные
          </UiText>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <UiText
              as="label"
              for="playground-width"
              variant="xs"
            >
              Ширина
            </UiText>
            <Select.Select v-model="width">
              <Select.SelectTrigger
                id="playground-width"
                aria-label="Ширина"
              >
                <Select.SelectValue />
              </Select.SelectTrigger>
              <Select.SelectContent>
                <Select.SelectItem
                  v-for="size in ['340', '420', '600', '900']"
                  :key="size"
                  :value="size"
                >
                  {{ size }} px
                </Select.SelectItem>
              </Select.SelectContent>
            </Select.Select>
          </div>
          <Select.Select v-model="language">
            <Select.SelectTrigger aria-label="Язык интерфейса">
              <Select.SelectValue />
            </Select.SelectTrigger>
            <Select.SelectContent>
              <Select.SelectItem value="en_US">
                English
              </Select.SelectItem>
              <Select.SelectItem value="ru_RU">
                Русский
              </Select.SelectItem>
            </Select.SelectContent>
          </Select.Select>
          <label class="flex items-center gap-2">
            <Checkbox
              v-model="dark"
              aria-label="Тёмная тема"
            />
            <UiText variant="xs">Тёмная тема</UiText>
          </label>
          <Button
            variant="outline"
            size="sm"
            @click="reset"
          >
            Сбросить пример
          </Button>
        </div>
      </header>
      <div class="flex min-h-0 flex-1">
        <aside
          class="scrollbar w-64 shrink-0 space-y-4 overflow-y-auto border-r p-3"
        >
          <UiInput
            v-model="query"
            aria-label="Поиск сценария"
            placeholder="Найти сценарий…"
            class="w-full"
            :clearable="true"
          />
          <template
            v-for="group in groups"
            :key="group"
          >
            <section
              v-if="visible.some((item) => item.group === group)"
              class="mb-4 space-y-1"
            >
              <UiText
                as="h2"
                variant="caption"
                weight="semibold"
                muted
                class="px-2 py-2"
              >
                {{ group }}
              </UiText>
              <Button
                v-for="scenario in visible.filter(
                  (item) => item.group === group,
                )"
                :key="scenario.id"
                variant="ghost"
                class="h-auto w-full justify-start gap-2 px-2 py-2 text-left whitespace-normal"
                :class="selected === scenario.id && 'bg-accent'"
                :aria-pressed="selected === scenario.id"
                @click="selected = scenario.id"
              >
                <UiText
                  variant="caption"
                  muted
                  mono
                >
                  {{ scenario.number }}
                </UiText><UiText variant="xs">
                  {{ scenario.title }}
                </UiText>
              </Button>
            </section>
          </template>
        </aside>
        <main class="bg-muted/20 flex min-w-0 flex-1 flex-col">
          <div class="space-y-2 border-b px-5 py-3">
            <UiText
              as="h2"
              variant="base"
              weight="medium"
            >
              {{ current.number }} · {{ current.title }}
            </UiText>
            <UiText
              as="p"
              variant="sm"
              muted
            >
              {{ current.description }}
            </UiText>
            <div class="flex flex-wrap gap-4">
              <label class="flex items-center gap-2"><Checkbox
                v-model="failActions"
                aria-label="Имитировать ошибку действия"
              /><UiText variant="xs">Имитировать ошибку действия</UiText></label>
              <label class="flex items-center gap-2"><Checkbox
                v-model="requestDirty"
                aria-label="Несохранённый HTTP-запрос"
              /><UiText variant="xs">Несохранённый HTTP-запрос</UiText></label>
            </div>
          </div>
          <div class="flex min-h-0 flex-1 justify-center overflow-auto p-5">
            <div
              class="bg-background h-full max-w-full overflow-hidden rounded-lg border shadow-xs"
              :style="{ width: `${width}px` }"
            >
              <AiPanel
                :key="`${selected}-${revision}`"
                embedded
              />
            </div>
          </div>
          <footer class="border-t px-5 py-2">
            <UiText
              as="p"
              variant="xs"
              muted
            >
              {{
                notice
                  || "Кнопки работают только с демоданными. Запросы к ИИ и действия с вашим хранилищем не выполняются."
              }}
            </UiText>
          </footer>
        </main>
      </div>
    </div>
  </TooltipProvider>
</template>
