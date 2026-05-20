/*
  Este módulo define funciones de utilidad que se utilizan en toda la aplicación SOSecure. Actualmente, incluye la 
  función `cn` que combina clases de Tailwind CSS utilizando las bibliotecas `clsx` y `tailwind-merge`. La función 
  `cn` toma una lista de clases como argumentos, las combina utilizando `clsx` para manejar condiciones y luego las 
  optimiza utilizando `twMerge` para eliminar clases redundantes y resolver conflictos. Esta función es esencial para
  gestionar las clases de estilo de manera eficiente en los componentes de React, permitiendo una aplicación más limpia y 
  mantenible de Tailwind CSS en toda la aplicación.
*/


// Importar las funciones `clsx` y `twMerge` de las bibliotecas correspondientes para combinar y optimizar clases de Tailwind CSS,
// así como el tipo `ClassValue` para definir el tipo de los argumentos que se pueden pasar a la función `cn`.
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// La función `cn` combina clases de Tailwind CSS utilizando las funciones `clsx` y `twMerge`. Toma una lista de clases
// como argumentos, las combina utilizando `clsx` para manejar condiciones y luego las optimiza utilizando `twMerge` para 
// eliminar clases redundantes y resolver conflictos. Esta función es esencial para gestionar las clases de estilo de manera 
// eficiente en los componentes de React, permitiendo una aplicación más limpia y mantenible de Tailwind CSS en toda la aplicación.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
