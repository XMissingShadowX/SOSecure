/*
  Componente de botón
  Este componente de botón se basa en la biblioteca Radix UI y proporciona una estructura para crear botones 
  interactivos en una aplicación React. El botón se utiliza para realizar acciones o enviar formularios. El 
  componente incluye estilos personalizados y se compone de una sola parte principal: Button, que se encarga 
  de aplicar los estilos y la funcionalidad deseada al botón que se le pase como hijo.
*/

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 ease-spring active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_8px_-2px_rgba(0,0,0,0.35)] hover:bg-primary/90',
        destructive:
          'bg-destructive text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_8px_-2px_rgba(0,0,0,0.35)] hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'glass glass-interactive hover:shadow-md',
        secondary:
          'glass glass-interactive text-secondary-foreground hover:shadow-md',
        ghost:
          'hover:bg-accent/60 hover:backdrop-blur-md hover:text-accent-foreground dark:hover:bg-accent/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
