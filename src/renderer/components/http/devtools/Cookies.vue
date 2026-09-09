<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useHttpRequests } from '@/composables'
import { i18n } from '@/electron'
import { Cookie, Plus, RotateCcw, Trash2 } from 'lucide-vue-next'

const open = ref(false)
const { currentDraft } = useHttpRequests()
const domains = ref(['api.example.com', 'localhost'])
const selected = ref('api.example.com')
const newDomain = ref('')
let nextId = 3
const cookies = ref([
  {
    id: 1,
    domain: 'api.example.com',
    name: 'session_id',
    value: 'demo_session_123',
    path: '/',
    secure: true,
    httpOnly: true,
  },
  {
    id: 2,
    domain: 'api.example.com',
    name: 'theme',
    value: 'dark',
    path: '/',
    secure: false,
    httpOnly: false,
  },
])
const visible = computed(() =>
  cookies.value.filter(cookie => cookie.domain === selected.value),
)
function addDomain() {
  const value = newDomain.value.trim()
  if (!value)
    return
  if (!domains.value.includes(value))
    domains.value.push(value)
  selected.value = value
  newDomain.value = ''
}
function addCookie() {
  cookies.value.push({
    id: nextId++,
    domain: selected.value,
    name: '',
    value: '',
    path: '/',
    secure: false,
    httpOnly: false,
  })
}
watch(open, (value) => {
  if (!value)
    return
  try {
    const hostname = new URL(currentDraft.value?.url ?? '').hostname
    if (!hostname || hostname.includes('{'))
      return
    if (!domains.value.includes(hostname))
      domains.value.unshift(hostname)
    selected.value = hostname
  }
  catch {}
})
function reset() {
  cookies.value = cookies.value.filter(
    cookie => cookie.domain !== selected.value,
  )
  cookies.value.push({
    id: nextId++,
    domain: selected.value,
    name: 'session_id',
    value: 'demo_session_123',
    path: '/',
    secure: true,
    httpOnly: true,
  })
}
</script>

<template>
  <Button
    variant="ghost"
    size="sm"
    @click="open = true"
  >
    <Cookie class="size-3.5" /><UiText variant="xs">
      {{ i18n.t("spaces.http.devtools.cookies") }}
    </UiText>
  </Button>
  <Dialog.Dialog v-model:open="open">
    <Dialog.DialogContent
      class="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-4xl"
      @open-auto-focus="(e) => e.preventDefault()"
      @close-auto-focus="(e) => e.preventDefault()"
    >
      <Dialog.DialogHeader>
        <Dialog.DialogTitle>
          {{ i18n.t("spaces.http.devtools.cookies") }}
        </Dialog.DialogTitle>
        <Dialog.DialogDescription>
          {{ i18n.t("spaces.http.devtools.cookiesHint") }}
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>
      <div
        class="grid h-[420px] min-h-0 grid-cols-[180px_minmax(0,1fr)] overflow-hidden rounded-md border"
      >
        <aside class="flex min-h-0 flex-col border-r">
          <UiText
            variant="xs"
            muted
            class="border-b px-3 py-2"
          >
            {{ i18n.t("spaces.http.devtools.domains") }}
          </UiText>
          <div class="scrollbar min-h-0 flex-1 overflow-auto p-1">
            <Button
              v-for="domain in domains"
              :key="domain"
              variant="ghost"
              class="w-full justify-start"
              :class="{ 'bg-accent': selected === domain }"
              @click="selected = domain"
            >
              <UiText
                variant="xs"
                class="truncate"
              >
                {{ domain }}
              </UiText>
            </Button>
          </div>
          <form
            class="flex items-center gap-1 border-t p-2"
            @submit.prevent="addDomain"
          >
            <UiInput
              v-model="newDomain"
              variant="ghost"
              class="min-w-0"
              :placeholder="i18n.t('spaces.http.devtools.addDomain')"
              :aria-label="i18n.t('spaces.http.devtools.addDomain')"
            /><UiActionButton
              type="submit"
              :disabled="!newDomain.trim()"
              :tooltip="i18n.t('spaces.http.devtools.addDomain')"
            >
              <Plus />
            </UiActionButton>
          </form>
        </aside>
        <div class="flex min-h-0 min-w-0 flex-col">
          <div class="flex h-10 shrink-0 items-center gap-2 border-b px-3">
            <UiText
              variant="sm"
              weight="medium"
              class="truncate"
            >
              {{ selected }}
            </UiText><UiText
              variant="xs"
              muted
            >
              {{ visible.length }}
            </UiText>
            <div class="flex-1" />
            <UiActionButton
              :tooltip="i18n.t('spaces.http.devtools.reset')"
              @click="reset"
            >
              <RotateCcw />
            </UiActionButton>
          </div>
          <div class="scrollbar min-h-0 flex-1 overflow-auto">
            <div
              v-for="cookie in visible"
              :key="cookie.id"
              class="space-y-2 border-b p-3"
            >
              <div class="grid grid-cols-[1fr_1fr_28px] items-center gap-2">
                <UiInput
                  v-model="cookie.name"
                  :placeholder="i18n.t('spaces.http.devtools.name')"
                  :aria-label="i18n.t('spaces.http.devtools.name')"
                />
                <UiInput
                  v-model="cookie.value"
                  :placeholder="i18n.t('spaces.http.devtools.value')"
                  :aria-label="i18n.t('spaces.http.devtools.value')"
                />
                <UiActionButton
                  :tooltip="i18n.t('spaces.http.devtools.deleteCookie')"
                  class="text-destructive"
                  @click="
                    cookies = cookies.filter((item) => item.id !== cookie.id)
                  "
                >
                  <Trash2 />
                </UiActionButton>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <label class="flex items-center gap-2"><UiText
                  variant="xs"
                  muted
                >{{
                  i18n.t("spaces.http.devtools.path")
                }}</UiText><UiInput
                  v-model="cookie.path"
                  class="!h-6 w-20"
                  :aria-label="i18n.t('spaces.http.devtools.path')"
                /></label>
                <label class="flex items-center gap-2"><Checkbox v-model="cookie.secure" /><UiText variant="xs">{{
                  i18n.t("spaces.http.devtools.secure")
                }}</UiText></label>
                <label class="flex items-center gap-2"><Checkbox v-model="cookie.httpOnly" /><UiText variant="xs">{{
                  i18n.t("spaces.http.devtools.httpOnly")
                }}</UiText></label>
              </div>
            </div>
            <UiText
              v-if="!visible.length"
              as="div"
              variant="sm"
              muted
              class="p-6 text-center"
            >
              {{ i18n.t("spaces.http.devtools.noCookies") }}
            </UiText>
          </div>
          <div class="flex shrink-0 items-center justify-between border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              @click="addCookie"
            >
              <Plus class="size-3.5" />{{
                i18n.t("spaces.http.devtools.addCookie")
              }}
            </Button><Button
              variant="ghost"
              size="sm"
              class="text-destructive"
              :disabled="!visible.length"
              @click="
                cookies = cookies.filter((cookie) => cookie.domain !== selected)
              "
            >
              {{ i18n.t("spaces.http.devtools.clear") }}
            </Button>
          </div>
        </div>
      </div>
      <div class="flex justify-end">
        <Button
          variant="secondary"
          @click="open = false"
        >
          {{ i18n.t("spaces.http.devtools.done") }}
        </Button>
      </div>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
