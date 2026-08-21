/*
  Coincidencia de la palabra clave del SOS por voz. Puerto exacto de la lógica
  ya verificada en la app Flutter (voice_sos_provider.dart _normalize /
  _matchesKeyword) — mismo criterio en las dos plataformas.
*/

// Deja el texto en una forma comparable: minúsculas, sin acentos (tanto los
// precompuestos "á" como los descompuestos "a" + tilde combinante), sin
// puntuación y con los espacios colapsados.
//
// La puntuación importa más de lo que parece: el reconocedor puede devolver
// "¡Socorro!" mientras la palabra guardada es "socorro". Comparando en crudo
// contra un límite de palabra, esos dos NO coinciden y la alerta nunca se
// dispara.
export function normalizeForVoiceMatch(value: string): string {
  let out = value.toLowerCase()
  // NFD descompone "á" en "a" + tilde combinante (U+0301..U+036F), que el
  // siguiente replace elimina — cubre tanto el acento precompuesto como el
  // que el reconocedor a veces devuelve ya descompuesto.
  out = out.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // Cualquier carácter que no sea letra o número pasa a ser separador. Se
  // aplica igual a la transcripción y a la palabra guardada, así que siguen
  // siendo comparables entre sí.
  out = out.replace(/[^a-z0-9]+/g, ' ')
  return out.trim()
}

// Coincidencia por palabra completa, no por substring: con `includes` una
// palabra clave corta como "ya" disparaba un SOS real al decir "playa".
// Funciona igual con claves de varias palabras ("ayuda por favor").
export function matchesVoiceKeyword(transcript: string, keyword: string): boolean {
  const normalizedKeyword = normalizeForVoiceMatch(keyword)
  if (!normalizedKeyword) return false
  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(^| )${escaped}( |$)`)
  return pattern.test(normalizeForVoiceMatch(transcript))
}
