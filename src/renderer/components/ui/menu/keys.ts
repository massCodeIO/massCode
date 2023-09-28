import type { InjectionKey } from 'vue'
import type { MenuInject } from './types'

export const menuKey: InjectionKey<MenuInject> = Symbol('menu')
