import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const variants = cva(
  'inline-flex items-center justify-center rounded cursor-default focus-visible:outline-none leading-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-button text-button-fg hover:bg-button-hover',
        primary: 'bg-primary text-white hover:bg-primary/70',
        danger: 'bg-red-700 text-white hover:bg-red-700/70',
        icon: 'bg-transparent hover:bg-button-hover hover:[&>svg]:text-button-fg hover:text-button-fg [&>svg]:text-button-fg',
      },
      size: {
        sm: 'px-2 h-5',
        md: 'px-4 h-6',
        icon: 'h-5 w-8',
        iconText: 'h-5 px-2',
      },
    },

    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
)

export type Variants = VariantProps<typeof variants>
