/*
  * Este módulo define una función `createClient` que se utiliza para crear una instancia del cliente de Supabase en 
  * el navegador.
*/

import { createBrowserClient } from '@supabase/ssr'

// La función `createClient` crea una instancia del cliente de Supabase utilizando la función `createBrowserClient` de 
// la biblioteca `@supabase/ssr`. Esta función toma la URL de Supabase y la clave anónima como argumentos, que se 
// obtienen de las variables de entorno. La función `createClient` se exporta para que pueda ser utilizada en 
// otras partes de la aplicación, como en los componentes de React o en las funciones de API, para interactuar con 
// la base de datos de Supabase y realizar operaciones como autenticación, consultas y mutaciones.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
