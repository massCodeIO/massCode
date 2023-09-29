import type { Ref } from 'vue'

export interface MenuItem {
  name: string
  value: string
}

export interface GroupItem {
  name: string
  label: string
  items: MenuItem[]
}

export interface MenuInject {
  active: Ref<string>
  items: Ref<MenuItem[]>
  groups: Ref<GroupItem[]>
  onClickItem: (item: MenuItem) => void
}
