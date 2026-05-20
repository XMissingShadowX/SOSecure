/*
  Componente de grupo de botones
  Este componente de grupo de botones se basa en la biblioteca Radix UI y proporciona una estructura para crear 
  grupos de botones interactivos en una aplicación React. El grupo de botones se utiliza para organizar varios 
  botones relacionados entre sí, lo que facilita la navegación y la interacción del usuario. El componente incluye 
  estilos personalizados y se compone de una sola parte principal: ButtonGroup, que se encarga de aplicar los 
  estilos y la funcionalidad deseada al grupo de botones que se le pase como hijo.
*/

'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonGroupVariants = cva(
  'flex w-fit items-stretch',
  {
    variants: {
      orientation: {
        horizontal: 'flex-row',
        vertical: 'flex-col',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  }
)

interface ButtonGroupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof buttonGroupVariants> {}

function ButtonGroup({ className, orientation, ...props }: ButtonGroupProps) {
  return (
    <div
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  )
}

export { ButtonGroup }
