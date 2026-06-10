# Plan Familiar — SOSecure

Función para vender una **suscripción anual** que protege a **5 usuarios** (titular + 4 invitados). Incluye la gestión de miembros, un apartado en **Ajustes**, y una **página web de pago** a la que se redirige al usuario.

---

## 1. Modelo de negocio

| Concepto | Valor |
|---|---|
| Plan | Anual |
| Usuarios | 5 en total (incluye al titular) |
| Precio sugerido | $499 MXN / año *(configurable)* |
| Cobro | 1 pago al año |

El precio, el número de cupos y los textos se cambian en **un solo lugar**: `lib/plan-config.ts`.

---

## 2. Archivos que agrega esta función

Copia cada archivo a la **misma ruta** dentro de tu proyecto:

```
supabase/migrations/20240003_family_plan.sql   ← esquema de base de datos
lib/plan-config.ts                              ← precio y configuración
lib/family.ts                                   ← helpers de cliente (grupos/miembros)
components/family-plan-section.tsx              ← sección "Plan Familiar" en Ajustes
components/app-shell.tsx                         ← MODIFICADO (3 cambios)
app/plan-familiar/pago/page.tsx                 ← página WEB de pago
app/plan-familiar/aceptar/page.tsx              ← aceptar invitación
app/api/family/invite/route.ts                  ← enviar invitaciones (Resend)
app/api/family/checkout/route.ts                ← crear sesión de pago / activar
app/api/family/webhook/route.ts                 ← activar tras pago real
app/api/family/accept/route.ts                  ← vincular miembro por token
```

### Cambios en `components/app-shell.tsx`
1. Import de `FamilyPlanSection`.
2. Un `useEffect` que completa invitaciones pendientes tras iniciar sesión.
3. La sección `<FamilyPlanSection />` dentro del diálogo de Ajustes + scroll vertical en el diálogo.

> El archivo `components/app-shell.tsx` incluido ya trae los 3 cambios aplicados; puedes reemplazar el tuyo directamente.

---

## 3. Base de datos

Ejecuta `supabase/migrations/20240003_family_plan.sql` en **Supabase → SQL Editor**.

Crea dos tablas:

- **`family_groups`** — 1 grupo por titular. Guarda el estado de la suscripción (`pending` / `active` / …), el proveedor de pago y el periodo de vigencia.
- **`family_members`** — hasta 5 filas por grupo (incluye al titular). Cada miembro se invita por correo y se vincula a su cuenta al aceptar.

Incluye:
- **Trigger** que impide pasar de 5 miembros (a nivel base de datos, no se puede burlar).
- **RLS**: el titular gestiona su grupo y sus miembros; cada miembro ve su propia fila.
- **RPC `has_active_family_plan()`** para desbloquear funciones premium:
  ```ts
  const { data } = await supabase.rpc('has_active_family_plan') // true/false
  ```

---

## 4. Variables de entorno

Agrega a `.env.local` (y a Vercel):

```env
# Ya las tienes
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
NEXT_PUBLIC_APP_URL=https://sosecure.site

# Pasarela de pago (elige UNA). Si dejas ambas vacías, funciona el MODO DEMO.
MERCADOPAGO_ACCESS_TOKEN=        # recomendado en México
# STRIPE_SECRET_KEY=
```

---

## 5. Cómo funciona el flujo

```
Ajustes → Plan Familiar → "Activar plan"
   │  (redirige a una página web)
   ▼
/plan-familiar/pago   ── "Pagar" ──►  /api/family/checkout (create-session)
   │                                        │
   │                          ┌─────────────┴─────────────┐
   │                    pasarela configurada        sin pasarela
   │                          │                           │
   │                  redirige a Mercado Pago      formulario DEMO
   │                  / Stripe (página segura)     (activa al instante)
   │                          │
   │                    el usuario paga
   │                          │
   │                    webhook activa el plan ──► /api/family/webhook
   ▼
regresa a /plan-familiar/pago?status=success  →  "¡Plan activado!"
```

**Invitar miembros** (cuando el plan está activo):

```
Ajustes → Plan Familiar → escribe correo → "Enviar invitación"
   │
   ▼
/api/family/invite  →  Resend envía correo con enlace
   │
   ▼
el invitado abre /plan-familiar/aceptar?token=...
   │
   ├─ con sesión  → se une al instante
   └─ sin sesión  → inicia sesión y se une automáticamente al volver
```

---

## 6. El método de pago: opción implementada y la alternativa

### Opción A — Página web + redirección (la que pediste, ya implementada)

El botón de Ajustes **redirige a una página web** (`/plan-familiar/pago`) y de ahí a la **página segura del proveedor** (Mercado Pago u Stripe). El cobro nunca toca tu servidor; el proveedor confirma por webhook.

- **Pros:** evitas la comisión del 15–30 % de Google Play; soporta tarjeta, **OXXO**, **SPEI** y transferencia con Mercado Pago; mismo flujo en web y en el APK; PCI lo cubre el proveedor (no guardas tarjetas).
- **Contras:** la política de Google Play pide que las **suscripciones digitales dentro de la app** usen su sistema de cobro. Para estar tranquilo en producción, abre el pago en el **navegador del sistema** (no dentro del WebView):

  ```bash
  npm install @capacitor/browser
  ```
  ```ts
  import { Browser } from '@capacitor/browser'
  // en components/family-plan-section.tsx, reemplaza goToPayment():
  const goToPayment = async () => {
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/plan-familiar/pago/`
    await Browser.open({ url })   // abre el navegador externo
  }
  ```
  Para la presentación del hackathon, la redirección normal (`window.location.href`) ya funciona.

### Opción B (alternativa) — Pago nativo dentro de la app (Google Play Billing / Apple IAP)

Cobro **dentro** del APK usando la facturación de la tienda, normalmente vía un plugin como **RevenueCat** (`@revenuecat/purchases-capacitor`) o `@capacitor-community/in-app-purchases`.

- **Pros:** es lo que Google/Apple exigen para bienes digitales; checkout nativo, sin salir de la app; RevenueCat sincroniza el estado de la suscripción por ti.
- **Contras:** comisión de la tienda (15–30 %); requiere configurar productos en Play Console / App Store Connect; no aplica a la versión web; más trabajo de configuración.

### Recomendación

Para un servicio de **seguridad personal con componente de respuesta real**, Mercado Pago/Stripe por web (Opción A) suele aceptarse y te ahorra la comisión. Si el plan se considera "contenido digital puro" y publicas en Play Store, ten lista la **Opción B** o abre el pago en el navegador externo como se indicó. Mantén `has_active_family_plan()` como única fuente de verdad: así puedes cambiar de pasarela sin tocar el resto de la app.

---

## 7. Activar una pasarela real

### Mercado Pago (recomendado en México)
1. Crea una app en <https://www.mercadopago.com.mx/developers> y copia el **Access Token**.
2. Ponlo en `MERCADOPAGO_ACCESS_TOKEN`.
3. En el panel, configura el **Webhook** apuntando a `https://sosecure.site/api/family/webhook` (evento *payment*).
4. Prueba con las tarjetas de sandbox de Mercado Pago.

### Stripe
1. Copia tu **Secret Key** a `STRIPE_SECRET_KEY`.
2. En Stripe → Developers → Webhooks, agrega `https://sosecure.site/api/family/webhook` y escucha `checkout.session.completed`.
3. Tarjeta de prueba: `4242 4242 4242 4242`.

> **Producción:** verifica la firma del webhook (`Stripe-Signature` o `x-signature` de Mercado Pago) antes de activar el plan. El código actual deja el punto marcado para que lo agregues.

---

## 8. Probar en modo demostración (sin pasarela)

1. No pongas `MERCADOPAGO_ACCESS_TOKEN` ni `STRIPE_SECRET_KEY`.
2. Ajustes → Plan Familiar → **Activar plan** → se abre el formulario demo.
3. Usa cualquier tarjeta ficticia (p. ej. `4242 4242 4242 4242`, `12/30`, `123`) → **Pagar**.
4. El plan queda **activo** al instante y ya puedes invitar miembros.
5. Para multiusuario, abre la invitación en una **ventana de incógnito** con otra cuenta (como ya haces tus pruebas).

---

## 9. Notas técnicas

- La página de pago usa estilos propios (prefijo `.pf-`) para verse bien aunque se abra fuera de la app y sin depender del tema.
- La sesión de Supabase se comparte porque el APK carga el sitio remoto (`server.url` en `capacitor.config.ts`), así que la redirección interna mantiene al usuario autenticado.
- El límite de 5 lo aplica la base de datos; el front solo lo muestra.
- La vinculación de invitados se hace en el servidor con `SUPABASE_SERVICE_ROLE_KEY`, por eso no se expone ninguna policy por token.
