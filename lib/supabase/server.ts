/*
  * Este módulo define una función `createClient` que se utiliza para crear una instancia del cliente de Supabase en 
  * el servidor. Utiliza la función `createServerClient` de la biblioteca `@supabase/ssr` y maneja las cookies 
  * para mantener la sesión del usuario en el servidor. La función `createClient` se exporta para que pueda ser utilizada 
  * en otras partes de la aplicación, como en los componentes de React o en las funciones de API, para interactuar con 
  * la base de datos de Supabase y realizar operaciones como autenticación, consultas y mutaciones.
*/

// Importar la función `createServerClient` de la biblioteca `@supabase/ssr` para crear un cliente de Supabase en el servidor, 
// y la función `cookies` de Next.js para manejar las cookies en el entorno del servidor.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// La función `createClient` es una función asíncrona que crea una instancia del cliente de Supabase utilizando la función 
// `createServerClient`. Esta función toma la URL de Supabase y la clave anónima como argumentos, que se obtienen de las 
// variables de entorno. Además, se configura el manejo de cookies para mantener la sesión del usuario en el servidor, 
// utilizando la función `cookies` de Next.js para obtener y establecer las cookies necesarias para la autenticación y 
// otras operaciones relacionadas con la sesión.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component - ignore
          }
        },
      },
    }
  )
}
