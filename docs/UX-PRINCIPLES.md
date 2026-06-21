# FacturArkos — Principios de UX/UI

Síntesis aplicada de tres skills de diseño (analizadas, no instaladas como config del agente):
**Emil Kowalski** (design engineering / motion), **pbakaus/impeccable** (anti-slop, register "product"),
**leonxlnx/taste-skill** (anti-default discipline). Repos clonados en local solo como referencia.

## Registro: PRODUCT (la UI sirve al producto, no es el producto)
Es una app de gestión para Mypes peruanas usada por perfiles distintos (cajero, gerente, contador,
admin). Prioridad: **claridad, velocidad percibida, baja carga cognitiva**. La estética sobria
Apple/iOS ya establecida se conserva; no convertir esto en una landing.

## Movimiento (Emil Kowalski)
- Curvas custom, las de CSS son débiles. Tokens en `globals.css`:
  `--ease-out: cubic-bezier(0.23,1,0.32,1)`, `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`, `--ease-drawer: cubic-bezier(0.32,0.72,0,1)`.
- Duraciones UI **< 300ms**. Botones 120–160ms, dropdowns 150–250ms, modales/drawers 200–300ms.
- **Nunca animar acciones de teclado** de alta frecuencia → la paleta ⌘K abre **instantánea**.
- `ease-out` para entradas (responde rápido); nunca `ease-in` en UI.
- Botones presionables: `:active { transform: scale(0.97) }` (feedback instantáneo).
- Nada entra desde `scale(0)` → desde `scale(0.95)` + opacidad.
- `prefers-reduced-motion`: quitar movimiento/posición, conservar fades cortos.
- Transiciones (no keyframes) para UI que se dispara rápido / interrumpible.

## Anti-slop (impeccable)
- Contraste cuerpo ≥ 4.5:1; placeholders también. Nada de gris claro "elegante" ilegible.
- Prohibido: side-stripe borders (border-left de color >1px), texto con gradiente,
  glassmorphism por defecto, plantilla hero-métrica, grids de cards idénticas infinitas.
- z-index semántico (dropdown→sticky→modal→toast→tooltip), nunca 9999.
- Cards solo cuando son el mejor affordance; nunca cards anidadas.
- Tipografía: títulos peso 600, tracking ajustado; `text-wrap: balance` en encabezados.

## Anti-default (taste-skill)
- "Lee el contexto antes de diseñar." Nada de morado-IA, no defaults por reflejo.
- Cada perfil ve lo suyo (navegación por rol) → menos ruido = más usable.

## Pase de impeccable ejecutado (2026-06-20)
Se corrió el flujo real de la skill sobre el proyecto: **critique** (Nielsen 10 → 36/40 "Excelente", register product) + **detector determinista** (Assessment B) + **polish**.
Hallazgos corregidos: foco de teclado visible (`:focus-visible` global, persona Sam), targets táctiles ≥40px en botones-badge (`@media pointer:coarse`, persona Casey), capitalización ES de la fecha del dashboard, `z-index:9999`→token semántico `--z-tour`, y un **bug real de responsive**: regla vieja `.sidebar{width:64px}` rompía el off-canvas móvil (el sidebar asomaba) → eliminada; tablas anchas ahora hacen scroll dentro de su tarjeta en móvil (`.panel{overflow-x:auto}`). Excepción aceptada: animación de tamaño del spotlight del tour (redimensiona entre objetivos; legítima per Emil).

## Pase audit+polish: POS y Reportes (2026-06-21)
Pantallas más densas, con el flujo `audit` (5 dimensiones) + `polish`.
- **POS** (`/pos`, full-screen): grid `1fr 380px` → colapsa a 1 columna en ≤820px (carrito full-width fijo al pie para cobrar con el pulgar); botones de cantidad `−/+` ahora táctiles (≥44px en `pointer:coarse`) con `aria-label`. Clases `.pos-grid/.pos-cart/.qty-btn`.
- **Reportes**: método de pago en español vía `lib/labels` (no "CASH"); botón "Aplicar" redundante → texto de ayuda (las fechas ya recargan); mini-barra `.bar` para comparar montos por método.
Detector: 0 anti-patrones en ambas. Gotcha recordado: `next build` pisa el `.next` del dev server (chunks rotos) → tras buildear, reiniciar `pnpm dev` y limpiar `.next`.

## Pase de consistencia en todas las listas (2026-06-21)
Patrón unificado de carga/vacío en las 8 pantallas de lista (comprobantes, cobranzas, inventario, compras, clientes, cotizaciones, productos, recurrente): estado inicial **`null`** → `<SkeletonRows>` mientras carga → `<EmptyState>` (con ícono, guía y acción) cuando está realmente vacío → tabla con datos. Esto elimina el "flash de vacío" (antes inicializaban en `[]` y mostraban "No hay…" antes de cargar). Estados de enum siempre en español: cotizaciones (Abierta/Convertida/Anulada), recurrente (Activo/Pausado/Finalizado), métodos de pago vía `lib/labels`. Detector impeccable: 0 anti-patrones en `(admin)`.

## Pase delight: Dashboard (2026-06-21)
Toques puntuales (register product: delight en momentos, no en páginas), todos <1s y con `prefers-reduced-motion`:
- **Saludo según la hora**: "Buenos días/tardes/noches, {nombre}" (antes "Hola").
- **Conteo animado de KPIs** al llegar al panel: `<AnimatedNumber>` en `ui.tsx` (0→valor, ease-out cúbico ~700ms, instantáneo si reduce-motion; re-anima cuando llegan los datos = momento de "arribo").
- **Lift sutil en accesos rápidos** (`.quick:hover` translateY -1px + ícono +1px) con `--ease-out`.
Detector: 0 anti-patrones. No se añadió delight decorativo en el resto (la fiabilidad/consistencia llevan el resto).

## Navegación full-screen + nitidez (2026-06-21)
- Pantallas sin sidebar **por diseño**: `/` y `/precios` (marketing), `/login` `/registro` `/bienvenida` (auth/onboarding), `/tienda/[orgId]` `/portal/[orgId]` (públicas, pestaña nueva), `/imprimir/[id]` (impresión). El **POS** es modo enfoque pero ahora tiene botón **"← Panel"** para volver al dashboard (antes solo "Salir"=logout, desorientaba).
- "Rasgoso" en Windows: `-webkit-font-smoothing: antialiased` adelgaza el texto en pantallas no-Retina; se desactiva vía `@media (max-resolution: 143dpi)` para usar ClearType nativo (más limpio). En Retina/Mac se mantiene.
- El badge "N · 1 Issue" abajo-izquierda es el overlay de Next **dev** (no aparece en producción).

## Reglas vivas del proyecto
- Estados/etiquetas siempre en español (`lib/labels.ts`).
- Sin `window.prompt/confirm`: usar el `DialogProvider` (`useDialog`).
- Estados vacíos con guía (`EmptyState`), carga con `Skeleton`, feedback con `Toast`.
- Navegación agrupada y filtrada por rol (`lib/nav.ts`); ⌘K para saltar a todo.
