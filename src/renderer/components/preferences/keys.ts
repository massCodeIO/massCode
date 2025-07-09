import type { InjectionKey, ShallowRef } from 'vue'
import type { PerfectScrollbarExpose } from 'vue3-perfect-scrollbar'

export interface PreferencesInjection {
  scrollRef: Readonly<ShallowRef<PerfectScrollbarExpose | null>>
}

export const preferencesKeys: InjectionKey<PreferencesInjection>
  = Symbol('preferences')
