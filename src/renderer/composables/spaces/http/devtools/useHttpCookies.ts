import type { Ref } from 'vue'
import type { HttpCookie, HttpCookieSnapshot } from '~/shared/httpCookies'
import {
  parseCookieFields,
  serializeCookieFields,
} from '@/components/http/devtools/cookies/fields'
import { useHttpRequests } from '@/composables'
import { i18n, ipc } from '@/electron'
import { useDebounceFn } from '@vueuse/core'

export function useHttpCookies(open: Ref<boolean>) {
  const { currentRequest, currentDraft } = useHttpRequests()
  const state = ref<HttpCookieSnapshot>({
    domains: [],
    cookies: [],
    enabled: true,
  })
  const query = ref('')
  const error = ref('')
  const busy = ref(false)
  const requestId = computed(() => currentRequest.value?.id ?? null)
  const visible = computed(() => {
    const search = query.value.trim().toLowerCase()
    return state.value.cookies.filter(
      cookie =>
        !search
        || cookie.name.toLowerCase().includes(search)
        || cookie.domain.toLowerCase().includes(search),
    )
  })
  async function refresh() {
    state.value = (await ipc.invoke('spaces:http:cookies:read', {
      requestId: requestId.value,
    })) as HttpCookieSnapshot
  }
  async function action(run: () => Promise<unknown>) {
    if (busy.value)
      return
    busy.value = true
    error.value = ''
    try {
      await run()
      return true
    }
    catch {
      error.value = i18n.t('spaces.http.devtools.cookieError')
      return false
    }
    finally {
      busy.value = false
    }
  }
  async function addCookie() {
    await action(async () => {
      let domain = 'localhost'
      try {
        domain = new URL(currentDraft.value?.url ?? '').hostname || domain
      }
      catch {}
      let index = 1
      while (
        state.value.cookies.some(
          item => item.domain === domain && item.name === `Cookie_${index}`,
        )
      ) {
        index++
      }
      await ipc.invoke('spaces:http:cookies:save', {
        domain,
        raw: `Cookie_${index}=value; Path=/;`,
      })
      query.value = ''
      await refresh()
    })
  }
  async function updateCookie(
    cookie: HttpCookie,
    patch: Partial<
      Pick<
        HttpCookie,
        'name' | 'value' | 'domain' | 'path' | 'secure' | 'httpOnly'
      >
    > & { expires?: string },
  ) {
    return action(async () => {
      const fields = {
        ...parseCookieFields(cookie.raw, cookie.domain),
        ...patch,
      }
      // Explicit expiry editing replaces Max-Age, which would override Expires.
      if (patch.expires !== undefined)
        fields.maxAge = ''
      await ipc.invoke('spaces:http:cookies:save', {
        domain: fields.domain,
        originalId: cookie.id,
        raw: serializeCookieFields(fields),
      })
      await refresh()
    })
  }
  async function saveRaw(cookie: HttpCookie, raw: string) {
    return action(async () => {
      const { domain } = parseCookieFields(raw, cookie.domain)
      await ipc.invoke('spaces:http:cookies:save', {
        domain,
        originalId: cookie.id,
        raw,
      })
      await refresh()
    })
  }
  async function remove(id: string) {
    await action(async () => {
      await ipc.invoke('spaces:http:cookies:remove', { id })
      await refresh()
    })
  }
  async function clear(domain?: string) {
    await action(async () => {
      if (domain)
        await ipc.invoke('spaces:http:cookies:removeDomain', { domain })
      else await ipc.invoke('spaces:http:cookies:clear', undefined)
      await refresh()
    })
  }
  async function setEnabled(enabled: boolean | 'indeterminate') {
    await action(async () => {
      await ipc.invoke('spaces:http:cookies:setEnabled', {
        requestId: requestId.value,
        enabled: enabled === true,
      })
      await refresh()
    })
  }
  const onChanged = useDebounceFn(() => {
    if (open.value && !busy.value)
      void action(refresh)
  }, 100)
  ipc.on('spaces:http:cookies:event', onChanged)
  onBeforeUnmount(() => ipc.removeListeners('spaces:http:cookies:event'))
  watch(open, (value) => {
    if (!value)
      return
    query.value = ''
    void action(refresh)
  })

  return {
    state,
    query,
    error,
    busy,
    requestId,
    rows: visible,
    action,
    refresh,
    addCookie,
    updateCookie,
    saveRaw,
    remove,
    clear,
    setEnabled,
  }
}
