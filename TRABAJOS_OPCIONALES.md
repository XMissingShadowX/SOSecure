# Trabajos opcionales y nuevas implementaciones

Lista de hallazgos que no son parte de ningún ticket de la auditoría actual — features
huérfanas, código muerto o mejoras razonables encontradas al paso. No urgentes, quedan
para cuando el equipo decida priorizarlas.

---

## 1. Reactivar el rastreo por link para contactos sin cuenta

**Qué hay:** un sistema completo (`hooks/use-tracking.ts`, `app/api/tracking-invite/route.ts`,
`app/api/tracking-location/route.ts`, `app/tracking/[sessionId]/page.tsx`) para compartir
ubicación en tiempo real con un contacto que **no tiene cuenta SOSecure**, vía un link con
token único mandado por correo. Quedó huérfano cuando el commit `5f26391` ("ubicacion en vivo
Life360") lo reemplazó por un sistema más simple (`useLiveLocation` / `toggleSharing`) que solo
funciona entre contactos que **ya tienen cuenta** — pero nunca se borró el código viejo, ni se
quitó su importación de `before-tab.tsx`, solo dejó de estar conectado a ningún botón.

**Por qué importa:** para una app de seguridad personal, que un contacto de confianza pueda ver
tu ubicación sin tener que instalar la app y crear cuenta en el momento de una emergencia es un
caso de uso central, no cosmético — es el mismo patrón que usan Find My compartido o Life360 en
sus flujos de invitado temporal.

**Estado:** el backend y la página receptora ya están completos y ya tienen los fixes de
seguridad de esta sesión aplicados (auth, Content-Type, límite de array). Solo falta el botón/UI
en `before-tab.tsx` que llame a `startTracking(...)`.

---

## 2. ~~Carpeta `lib/app/` — copia vieja y muerta del flujo de plan familiar~~ (resuelto)

Ya no existe en el árbol actual — se eliminó en el commit `2a67a0f` ("fix: seguridad de
/api/chat y /api/emergency-chat, rate-limit del PIN en Postgres, y limpieza integral de UI").
Confirmado sin referencias colgantes.

---

## 3. ~~`app/api/plan-premium/pago/page.tsx` — página de UI mal ubicada~~ (resuelto)

También eliminada en el mismo commit `2a67a0f`. La versión real (`app/plan-premium/pago/page.tsx`)
sigue siendo la única y está correctamente enlazada desde `PremiumPlanSection`.

---

## 4. Rate limiting del PIN — placeholder en memoria, no apto para producción con múltiples instancias

**Qué hay:** `app/api/pin/verify/route.ts:20-22` ya trae el comentario explícito:
> "Placeholder de rate limiting en memoria — NO persiste entre instancias serverless. En
> producción reemplazar por Redis/Upstash (o similar) compartido entre instancias."

**Por qué importa:** en Vercel (serverless), cada instancia tiene su propio `Map` en memoria —
si hay más de una instancia sirviendo tráfico, el límite de 5 intentos / 1 minuto de bloqueo no
es real, es solo por instancia. Ya estaba documentado como pendiente desde que se implementó el
fix de PIN server-side; queda como recordatorio de que sigue sin resolverse.

---

## 5. `PLAN_FREE_VS_PREMIUM.md` — verificar que siga reflejando el gating real

**Qué hay:** un documento a nivel raíz del repo que describe qué funciones son gratis vs
premium. No se verificó línea por línea contra `lib/plan-config.ts` / `usePremium()`.

**Por qué importa:** documentos de este tipo tienden a desincronizarse del código con el
tiempo. Vale la pena un repaso rápido para confirmar que el doc sigue siendo la fuente de
verdad correcta, sobre todo antes de usarlo para decisiones de producto o marketing.

---

## 6. ~~Confirmación de correo de registro debería volver a la app Flutter~~ (implementado, falta 1 paso manual)

**Qué se hizo (repo `SOSecure_Flutter`):**
- `android/app/src/main/AndroidManifest.xml`: se agregó un segundo `<intent-filter>` en
  `MainActivity` para el esquema custom `sosecure://login-callback` (`action.VIEW` +
  categorías `DEFAULT`/`BROWSABLE`). No requiere verificación de dominio como los App Links
  `https` — es un esquema propio, `autoVerify="false"`.
- `lib/features/onboarding/sign_up_screen.dart`: el `signUp()` ahora manda
  `emailRedirectTo: 'sosecure://login-callback'` en vez de dejar que Supabase use el
  `emailRedirectTo` por defecto (la web).
- No hizo falta código de manejo del deep link — `supabase_flutter` ya escucha deep links
  automáticamente (flujo PKCE) y completa la sesión al recibir esa URI; `core/router.dart` ya
  reacciona a cambios de sesión vía `GoRouterRefreshStream(supabase.auth.onAuthStateChange)`
  y redirige fuera de `/login` en cuanto la sesión queda activa.

**Falta (paso manual, no versionado):** agregar `sosecure://login-callback` a
**Authentication → URL Configuration → Redirect URLs** en el dashboard de Supabase. Sin esto,
Supabase ignora el `emailRedirectTo` pedido y cae de vuelta a la Site URL (la web) — mismo
mecanismo de allowlist que ya aplica al flujo de "olvidé mi PIN" documentado en `CLAUDE.md`.

**Pendiente de probar:** flujo end-to-end en dispositivo físico (registrarse desde el APK,
confirmar que el correo abre la app y no el navegador, y que aterriza logueado en el shell).
