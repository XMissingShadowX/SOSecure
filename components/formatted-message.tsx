// Renderiza texto con **negritas** y saltos de línea sin usar dangerouslySetInnerHTML,
// evitando que contenido de usuario o de la IA pueda inyectar HTML/JS.
export function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n')

  return (
    <>
      {lines.map((line, lineIdx) => {
        const parts = line.split(/(\*\*.*?\*\*)/g).filter(Boolean)
        return (
          <span key={lineIdx}>
            {parts.map((part, partIdx) => {
              const boldMatch = part.match(/^\*\*(.*)\*\*$/)
              return boldMatch ? <strong key={partIdx}>{boldMatch[1]}</strong> : part
            })}
            {lineIdx < lines.length - 1 && <br />}
          </span>
        )
      })}
    </>
  )
}
