import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const variants = cva(
  'inline-flex items-center justify-center rounded cursor-default focus-visible:outline-none leading-none transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-button text-button-fg hover:bg-button-fg/20',
        primary: 'bg-primary text-white hover:bg-primary/70',
        icon: 'bg-transparent hover:bg-black/10',
      },
      size: {
        sm: 'px-2 h-5',
        md: 'px-4 h-6',
      },
    },

    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
)

export type Variants = VariantProps<typeof variants>
