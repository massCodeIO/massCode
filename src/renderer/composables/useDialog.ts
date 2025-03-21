import Button from '@/components/ui/button/Button.vue'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { i18n } from '@/electron'
import { useMagicKeys } from '@vueuse/core'
import { createVNode, defineComponent, h, ref, render } from 'vue'

export interface DialogOptions {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  content?: any
}

export function useDialog() {
  const createDialogContainer = () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    return container
  }

  const showDialog = (options: DialogOptions = {}) => {
    const { title, description, confirmText, cancelText, content } = options

    const container = createDialogContainer()

    return new Promise<boolean>((resolve) => {
      const DialogComponent = defineComponent({
        setup() {
          const isOpen = ref(true)

          const onConfirm = () => {
            resolve(true)
            isOpen.value = false
          }

          const onCancel = () => {
            resolve(false)
            isOpen.value = false
          }

          const { enter } = useMagicKeys()

          watch(enter, () => {
            onConfirm()
          })

          return () =>
            h(
              Dialog.Dialog,
              {
                'defaultOpen': isOpen.value,
                'open': isOpen.value,
                'onUpdate:open': (open: boolean) => {
                  isOpen.value = open
                },
              },
              {
                default: () => [
                  h(
                    Dialog.DialogContent,
                    { class: 'sm:max-w-[425px]' },
                    {
                      default: () => [
                        h(
                          Dialog.DialogHeader,
                          {},
                          {
                            default: () => [
                              h(
                                Dialog.DialogTitle,
                                {},
                                { default: () => title },
                              ),
                              description
                                ? h(
                                    Dialog.DialogDescription,
                                    {},
                                    { default: () => description },
                                  )
                                : null,
                            ],
                          },
                        ),
                        content
                          ? h('div', { class: '' }, { default: () => content })
                          : null,
                        h(
                          Dialog.DialogFooter,
                          {},
                          {
                            default: () => [
                              h(
                                Button,
                                {
                                  size: 'md',
                                  onClick: onCancel,
                                },
                                { default: () => cancelText },
                              ),
                              h(
                                Button,
                                {
                                  variant: 'primary',
                                  size: 'md',
                                  onClick: onConfirm,
                                },
                                { default: () => confirmText },
                              ),
                            ],
                          },
                        ),
                      ],
                    },
                  ),
                ],
              },
            )
        },
      })

      render(createVNode(DialogComponent), container)
    })
  }

  const confirm = (options: DialogOptions) => {
    const defaultOptions = {
      title: 'Confirm',
      confirmText: i18n.t('button.confirm'),
      cancelText: i18n.t('button.cancel'),
    }

    return showDialog({ ...defaultOptions, ...options })
  }

  return {
    showDialog,
    confirm,
  }
}
