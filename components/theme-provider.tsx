/*
  ThemeProvider es un componente que envuelve la aplicación para proporcionar soporte de temas (claro/oscuro).
- Utiliza la librería next-themes para gestionar el estado del tema y aplicar las clases CSS correspondientes
- Permite a los usuarios cambiar entre temas claro y oscuro, o seguir la preferencia del sistema
- Asegura que el tema se aplique correctamente en toda la aplicación, incluyendo componentes de terceros como Leaflet
- Proporciona una experiencia de usuario consistente y agradable adaptándose a las preferencias de cada usuario
*/

'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
