/*
  Componente de relación de aspecto
  Este componente de relación de aspecto se basa en la biblioteca Radix UI y proporciona una estructura para crear 
  contenedores con una relación de aspecto específica en una aplicación React. La relación de aspecto se utiliza para 
  mantener una proporción constante entre el ancho y la altura de un elemento, lo que es útil para mostrar contenido 
  multimedia como imágenes o videos. El componente incluye estilos personalizados y se compone de una sola parte 
  principal: AspectRatio, que se encarga de aplicar la relación de aspecto deseada al contenido que se le pase como hijo.
*/

'use client'

import * as AspectRatioPrimitive from '@radix-ui/react-aspect-ratio'

function AspectRatio({
  ...props
}: React.ComponentProps<typeof AspectRatioPrimitive.Root>) {
  return <AspectRatioPrimitive.Root data-slot="aspect-ratio" {...props} />
}

export { AspectRatio }
