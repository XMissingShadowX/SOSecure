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
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'

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

// La web (Next.js) autentica por cookies — el cliente Flutter no tiene cookie jar
// compartido con Supabase, así que manda el access token como `Authorization: Bearer`.
// Cualquier ruta de app/api/* que deba servir a ambos clientes (web y Flutter) debe usar
// esta función en vez de `createClient() + auth.getUser()` directo, o las requests desde
// Flutter siempre van a fallar como no autenticadas (401) sin que el cliente se entere,
// porque el fetch nunca lanza error por un 401 con body JSON válido.
export async function getAuthedUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    const anon = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await anon.auth.getUser(token)
    return user
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Igual que getAuthedUser pero devuelve el cliente en vez del user — para rutas
// que necesitan hacer un .rpc()/.from() que dependa de auth.uid() (RLS, RPCs
// security definer como has_premium_access) en nombre de quien llama, sea web
// (cookies) o Flutter (Bearer). El cliente admin() con service role NO sirve
// para esto: auth.uid() dentro del RPC resolvería a null.
export async function getRequestScopedClient(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    )
  }
  return createClient()
}
