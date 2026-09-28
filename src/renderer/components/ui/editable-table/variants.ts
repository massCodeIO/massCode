import { cva } from 'class-variance-authority'

export const rowVariants = cva(
  'border-border grid min-h-7 items-center border-b',
  {
    variants: {
      variant: {
        default: 'gap-2 px-2 py-0.5',
        compact: 'gap-0',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)
export const textVariants = cva('select-text', {
  variants: {
    variant: {
      default: 'px-2 py-1',
      compact: 'px-1 py-2',
    },
  },
  defaultVariants: { variant: 'default' },
})
