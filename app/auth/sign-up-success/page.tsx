/*
  Este archivo define la página de éxito de registro. Dado que el proceso de registro ahora omite la confirmación por correo electrónico, esta página simplemente redirige al usuario a la página de inicio de sesión con un indicador de que se ha registrado correctamente.
  Si en el futuro decides volver a habilitar la confirmación por correo electrónico, puedes actualizar esta página para mostrar un mensaje de éxito y proporcionar instrucciones sobre cómo confirmar la cuenta.

  Nota: Asegúrate de configurar correctamente las URL de redirección en tu proyecto de Supabase
  para que apunten a esta página después del registro.
*/

// Indicar que este componente se ejecuta en el cliente para poder usar hooks de React
'use client'

// Importar la función para redirigir al usuario
import { redirect } from 'next/navigation'

// Este componente se encarga de redirigir al usuario a la página de inicio de sesión después de un registro exitoso
export default function SignUpSuccessPage() {
  redirect('/auth/login?registered=1')
}
