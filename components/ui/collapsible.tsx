/*
  Componente de colapsable
  Este componente de colapsable se basa en la biblioteca Radix UI y proporciona una estructura para crear secciones 
  colapsables en una aplicación React. El colapsable se utiliza para mostrar u ocultar contenido adicional, lo que 
  es útil para organizar la información y mejorar la experiencia del usuario. El componente incluye estilos personalizados 
  y se compone de varias partes principales, como Collapsible, CollapsibleTrigger y CollapsibleContent, cada una con 
  su propia funcionalidad y estilo para facilitar la interacción del usuario con el contenido colapsable.
*/

'use client'

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
