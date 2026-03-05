import type { InjectionKey, ShallowRef } from 'vue'

export interface PreferencesInjection {
  scrollRef: Readonly<ShallowRef<HTMLElement | null>>
}

export const preferencesKeys: InjectionKey<PreferencesInjection>
  = Symbol('preferences')
