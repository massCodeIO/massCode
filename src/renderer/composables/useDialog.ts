import Button from '@/components/ui/button/Button.vue'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { i18n } from '@/electron'
import { useEventListener } from '@vueuse/core'
import {
  createVNode,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  render,
} from 'vue'

export interface DialogOptions {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  content?: string | Component
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

    let isDialogActive = true

    const cleanup = () => {
      isDialogActive = false

      if (container && container.parentNode) {
        render(null, container)
        container.parentNode.removeChild(container)
      }
    }

    return new Promise<boolean>((resolve) => {
      const DialogComponent = defineComponent({
        setup() {
          const isOpen = ref(true)

          const onConfirm = () => {
            if (!isDialogActive)
              return

            resolve(true)
            isOpen.value = false
            cleanup()
          }

          const onCancel = () => {
            if (!isDialogActive)
              return

            resolve(false)
            isOpen.value = false
            cleanup()
          }

          const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter' && isOpen.value && isDialogActive) {
              event.preventDefault()
              onConfirm()
            }
          }

          useEventListener(document, 'keydown', handleKeyDown)

          onBeforeUnmount(() => {
            isDialogActive = false
          })

          return () =>
            h(
              Dialog.Dialog,
              {
                'defaultOpen': isOpen.value,
                'open': isOpen.value,
                'onUpdate:open': (open: boolean) => {
                  isOpen.value = open
                  // Если диалог закрывается через UI, вызываем onCancel
                  if (!open && isDialogActive) {
                    onCancel()
                  }
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
                        content && typeof content === 'string'
                          ? h('div', { class: '' }, { default: () => content })
                          : content && typeof content === 'object'
                            ? h(content)
                            : null,
                        confirmText && cancelText
                          ? h(
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
                            )
                          : null,
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
