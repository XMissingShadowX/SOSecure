/*
  Este archivo define el layout raíz de la aplicación SOSecure. 
  Aquí se configuran los metadatos globales, el viewport para dispositivos móviles, y se establece la estructura básica del HTML.
  También se incluye un ErrorBoundary para manejar errores en toda la aplicación y un script para registrar el service worker.

  Nota: Asegúrate de que el service worker (sw.js) esté correctamente configurado en la raíz del proyecto para que las funcionalidades PWA funcionen correctamente.
*/

// Importar tipos de Next.js para metadatos y viewport, así como estilos globales y componentes necesarios
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ErrorBoundary } from '@/components/error-boundary'

// Configurar las fuentes de Google Fonts para la aplicación
const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

// Definir los metadatos globales para la aplicación, incluyendo título, descripción, manifest, y configuraciones para PWA
export const metadata: Metadata = {
  // Título y descripción de la aplicación para SEO y PWA
  title: 'SOSecure - Personal Safety App',
  description: 'Your personal safety companion with SOS alerts, community crime mapping, safe route planning, and AI-powered emergency assistance.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SOSecure',
  },
  // Configuración de iconos para la aplicación, incluyendo iconos para PWA y Apple Touch Icon
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

// Configurar el viewport para asegurar que la aplicación se muestre correctamente en dispositivos móviles y 
// tenga un comportamiento de zoom controlado
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1a1b26',
}

// Este componente define el layout raíz de la aplicación, incluyendo la estructura HTML, el manejo de errores 
// y el registro del service worker
export default function RootLayout({
  // El contenido de la aplicación se renderizará dentro de este layout
  children,
}: 
// Definir el tipo de props para el componente RootLayout, que incluye los children que se renderizarán dentro del layout
Readonly<{
  // El contenido de la aplicación que se renderizará dentro del layout
  children: React.ReactNode
}>) {
  // Renderizar la estructura HTML básica, incluyendo el head con un script para establecer el tema y el 
  // body con un ErrorBoundary para manejar errores en toda la aplicación
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var theme = localStorage.getItem('sosecure-theme') || 'dark';
              document.documentElement.className = theme;
            })();
          `
        }} />
      </head>
      <body className="font-sans antialiased">
        <ErrorBoundary>
          <script dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js') }`,
          }} />
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}