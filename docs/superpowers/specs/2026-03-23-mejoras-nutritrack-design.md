
# NutriTrack — Plan de Mejoras: Diseño Técnico
**Fecha:** 2026-03-23
**Proyecto:** NutriTrack (Next.js 15 + FastAPI + JSON storage)

## Resumen ejecutivo

Plan de 5 fases para implementar 12 mejoras en NutriTrack: 2 gaps críticos y 10 mejoras nuevas agrupadas por tema. Las fases son independientes y verificables individualmente.

---

## Fase 0 — Gaps urgentes

### Gap 1: Visualización de compensación activa en dashboard

**Objetivo:** Mostrar en el dashboard cuando el usuario está en período de compensación post-comodín.

**Diseño:**
- `CheatDayContext` ya calcula `compensation[]` con días activos
- Añadir tarjeta/banner en `/app/page.tsx` que lea `compensation` del contexto
- Mostrar: días restantes, déficit adicional por día, fecha de fin
- Renderizar solo cuando `compensation` tiene entradas activas (condición ya existe en `/app/diet/page.tsx`)

**Archivos afectados:**
- `nutrition_frontend/app/page.tsx` — añadir tarjeta de compensación activa
- `nutrition_frontend/context/CheatDayContext.tsx` — sin cambios (lógica ya existe)

**Criterios de aceptación:**
- Banner visible en dashboard cuando hay compensación activa
- No visible cuando no hay compensación activa
- Muestra días restantes y déficit adicional correctamente

---

### Gap 2: Sincronización del comodín al backend

**Objetivo:** Persistir el estado del comodín en servidor para no perderlo al cambiar de dispositivo.

**Diseño:**
- Nuevos endpoints FastAPI:
  - `POST /cheatday` — guarda un `CheatDayRecord`
  - `GET /cheatday` — devuelve historial de comodines
- Modelo persiste en `cheatday_history.json`
- `CheatDayContext` migra de localStorage puro a: cargar desde backend al montar, escribir al backend en cada cambio, mantener localStorage como caché offline
- Migración automática: si localStorage tiene datos y backend está vacío, push único al inicializar
- Conflict resolution strategy: backend wins. If both localStorage and backend have data from different periods, backend data takes precedence on load. On first push (localStorage → backend), only push if backend has no records for the current week.

**Archivos afectados:**
- `nutrition_assistant/api.py` — añadir endpoints `/cheatday`
- `nutrition_frontend/context/CheatDayContext.tsx` — añadir sync con backend
- `nutrition_frontend/lib/api.ts` — añadir funciones `saveCheatDay()`, `getCheatDays()`

**Criterios de aceptación:**
- Estado del comodín persiste en `cheatday_history.json`
- Al recargar la app, el estado se carga desde backend
- Migración automática de datos localStorage existentes
- Sin pérdida de funcionalidad offline (localStorage como caché)

---

## Fase 1 — Dashboard enriquecido

### 1.1 Bonus kcal de ejercicio visible

**Objetivo:** Mostrar en dieta y dashboard las calorías extra ganadas por registrar ejercicio de hoy.

**Diseño:**
- El endpoint `POST /exercise/today-training` ya devuelve `bonus_kcal`
- Guardar `bonus_kcal` en el estado de `/app/diet/page.tsx`
- Mostrar como chip/badge junto al presupuesto calórico: "＋120 kcal por ejercicio de hoy"
- Mostrar también en dashboard si el bonus fue registrado ese día
- Note: `bonus_kcal` is already calculated and returned by the backend (api.py lines 293–297). Before implementing, audit `nutrition_frontend/app/diet/page.tsx` to confirm whether it is already displayed. If not, capture it from the API response and display as described.

**Archivos afectados:**
- `nutrition_frontend/app/diet/page.tsx` — capturar y mostrar `bonus_kcal`
- `nutrition_frontend/app/page.tsx` — mostrar bonus en resumen del día

**Criterios de aceptación:**
- Badge visible en dieta cuando `bonus_kcal > 0`
- Badge visible en dashboard el mismo día
- No visible si no hay ejercicio registrado

---

### 1.2 Indicador de cumplimiento por macro

**Objetivo:** Mostrar porcentaje de cumplimiento de cada macro respecto al objetivo diario.

**Diseño:**
- Datos ya disponibles en dieta (macros objetivo vs consumidos)
- Añadir tres barras de progreso debajo del donut: proteína / carbos / grasas
- Colores: verde ≥90%, amarillo 70–89%, rojo <70%
- Visible en dashboard y en `/app/diet/page.tsx`

**Archivos afectados:**
- `nutrition_frontend/app/diet/page.tsx` — añadir barras de progreso por macro
- `nutrition_frontend/app/page.tsx` — añadir indicador en resumen de macros

**Criterios de aceptación:**
- Tres barras con porcentaje numérico y color semafórico
- Se actualiza al marcar/desmarcar comidas
- Visible en ambas páginas

---

### 1.3 Acciones rápidas en alertas del dashboard

**Objetivo:** Cada alerta del dashboard tiene un botón de navegación directa a la página de acción.

**Diseño:**
- Sin cambios en backend — puramente frontend
- Mapeo de tipo de alerta → ruta:
  - "Registrar peso" → `/progress`
  - "Encuesta semanal" → `/report`
  - "Plan desactualizado" → `/weekly-plan`
  - "Comodín disponible" → `/diet`
- Añadir botón con `router.push()` en cada alerta renderizada

**Archivos afectados:**
- `nutrition_frontend/app/page.tsx` — añadir botones de acción en cada alerta
- `nutrition_frontend/app/components/AlertCard.tsx` (si existe) o inline

**Criterios de aceptación:**
- Cada alerta tiene botón "Ir ahora" o similar
- Navegación directa a la página correcta
- Botón no aparece en alertas sin acción definida

---

## Fase 2 — Gestión del plan

### 2.1 Alerta de plan desactualizado

**Objetivo:** Mostrar banner cuando el backend indica que el plan está desactualizado.

**Diseño:**
- El endpoint de dieta ya devuelve flag `stale`
- Banner amarillo en `/app/diet/page.tsx` cuando `stale === true`
- Mensaje: "Tu plan está desactualizado" + botón "Regenerar"
- Banner desaparece al regenerar exitosamente

**Archivos afectados:**
- `nutrition_frontend/app/diet/page.tsx` — leer flag `stale` y mostrar banner

**Criterios de aceptación:**
- Banner visible cuando `stale === true`
- Banner oculto cuando `stale === false`
- Botón en banner dispara regeneración y refresca

---

### 2.2 Botón regenerar plan semanal

**Objetivo:** Permitir regenerar el plan desde la UI sin acceso al backend directo.

**Diseño:**
- Añadir botón "Regenerar plan" en `/app/weekly-plan/page.tsx`
- Llama al endpoint existente de generación de plan
- Muestra estado de carga durante la operación
- Diálogo de confirmación previo para evitar regeneraciones accidentales
- Refresca la vista al completar

**Archivos afectados:**
- `nutrition_frontend/app/weekly-plan/page.tsx` — añadir botón con confirmación. Use existing `regenerateWeeklyPlan()` function in `nutrition_frontend/lib/api.ts` (line 445) and existing endpoint `POST /diet/weekly/regenerate`. This task is UI-only — add confirmation dialog and spinner to `weekly-plan/page.tsx`.

**Criterios de aceptación:**
- Botón visible en la página del plan semanal
- Diálogo de confirmación antes de regenerar
- Spinner durante la operación
- Vista actualizada tras regeneración exitosa

---

### 2.3 Historial/archivo de PDFs de reportes

**Objetivo:** Archivar PDFs generados y permitir descargar reportes anteriores.

**Diseño:**
- Backend crea directorio `reports/` y guarda cada PDF como `report_YYYY-WW.pdf` al generarlo
- Nuevo endpoint `GET /reports` devuelve lista de reportes archivados (nombre, fecha, URL de descarga)
- Nuevo endpoint `GET /reports/{filename}` sirve el archivo
- En `/app/report/page.tsx` se añade sección "Reportes anteriores" con lista y descarga
- If a report for the same week already exists, overwrite it (same week = same plan). Filenames follow `report_YYYY-WW.pdf` format.

**Archivos afectados:**
- `nutrition_assistant/api.py` — modificar endpoint de PDF para archivar, añadir `GET /reports` y `GET /reports/{filename}`
- `nutrition_frontend/app/report/page.tsx` — añadir sección de historial
- `nutrition_frontend/lib/api.ts` — añadir `getReportsList()`

**Criterios de aceptación:**
- PDF archivado automáticamente al generarse
- Lista de reportes visible en `/app/report`
- Descarga directa de cada reporte anterior
- Reportes ordenados por fecha descendente

---

## Fase 3 — Datos y exportación

### 3.1 Endpoint de métricas de adherencia

**Objetivo:** Agregar datos de adherencia para mostrar tendencias y patrones.

**Diseño:**
- Nuevo endpoint `GET /adherence/metrics?days=7|30`
- Agrega `adherence_log.json` y devuelve:
  - Porcentaje de cumplimiento por comida
  - Tendencia diaria (datos para sparkline)
  - Comidas más frecuentemente saltadas
  - Racha actual de días con adherencia >80%
- En `/app/progress/page.tsx` nueva sección con Recharts (ya usado en el proyecto)

**Archivos afectados:**
- `nutrition_assistant/api.py` — añadir endpoint `/adherence/metrics`
- `nutrition_assistant/adherence.py` — añadir función de agregación
- `nutrition_frontend/app/progress/page.tsx` — añadir sección de métricas
- `nutrition_frontend/lib/api.ts` — añadir `getAdherenceMetrics()`

**Criterios de aceptación:**
- Endpoint devuelve métricas para 7 y 30 días
- Gráficos visibles en `/app/progress`
- Racha calculada correctamente
- Comidas problemáticas identificadas

---

### 3.2 Exportar datos en CSV/Excel

**Objetivo:** Permitir al usuario descargar todos sus datos personales.

**Diseño:**
- Nuevo endpoint `GET /export?format=csv|xlsx&from=YYYY-MM-DD&to=YYYY-MM-DD`
- Compila en una descarga: historial de peso, adherencia por día/comida, ejercicio registrado, encuestas semanales, macros consumidos
- `openpyxl` para Excel, módulo `csv` estándar para CSV
- En `/app/settings/page.tsx` botón "Exportar mis datos" con selector de rango de fechas y formato

**Archivos afectados:**
- `nutrition_assistant/api.py` — añadir endpoint `/export`
- `nutrition_frontend/app/settings/page.tsx` — añadir sección de exportación
- `nutrition_frontend/lib/api.ts` — añadir `exportData()`
- Add `openpyxl` to `nutrition_assistant/requirements.txt` as a new dependency.

**Criterios de aceptación:**
- Descarga funcional en CSV y XLSX
- Rango de fechas configurable
- Todos los tipos de datos incluidos
- Nombre de archivo incluye rango de fechas

---

## Fase 4 — Micronutrientes completo

### 4.1 Modelo de datos extendido

**Objetivo:** Incluir micronutrientes en el modelo de alimento.

**Campos añadidos:** fibra, sodio, potasio, vitamina A, C, D, B12, calcio, hierro, magnesio, zinc.

**Diseño:**
- Extender el modelo de alimento en backend para incluir estos campos
- Mapear campos desde OpenFoodFacts en el parser existente (muchos ya disponibles)
- Campos sin datos quedan `null` y se muestran como "sin datos" en UI
- Actualizar `food_database.json` o recalcular al vuelo

**Archivos afectados:**
- `nutrition_assistant/api.py` — OpenFoodFacts integration is inline here (approx line 1561); extend the food dict mapping to include new micronutrient fields
- `nutrition_assistant/diet.py` — food data stored as plain dicts here; introduce a typed structure or extend the existing dict schema to include micronutrient keys
- Note: No `models.py` or `food_parser.py` exist in the project; changes must be made to the files where food data is actually handled.

**Criterios de aceptación:**
- Food model includes all 11 micronutrient fields; null for missing data; OpenFoodFacts mapper updated.

---

### 4.2 Objetivos configurables por usuario

**Objetivo:** Permitir al usuario definir sus objetivos de micronutrientes.

**Diseño:**
- Valores por defecto basados en RDA según perfil (edad, género, peso)
- Sección "Objetivos de micronutrientes" en `/app/settings/page.tsx`
- Usuario puede sobrescribir cualquier valor
- Persisten en `user_profile.json` junto al resto del perfil
- Nuevo endpoint `PUT /profile/micronutrient-goals` o extender `PUT /profile`

**Archivos afectados:**
- `nutrition_assistant/api.py` — extender endpoint de perfil
- `nutrition_assistant/calculator.py` — añadir cálculo de RDA por defecto
- `nutrition_frontend/app/settings/page.tsx` — añadir sección de micronutrientes

**Criterios de aceptación:**
- RDA defaults calculated on profile save; all values editable in settings; persisted in user_profile.json.

---

### 4.3 Tracking diario de micronutrientes

**Objetivo:** Mostrar consumo de micronutrientes del día vs objetivo.

**Diseño:**
- Nuevo endpoint `GET /micronutrients/today` — suma micronutrientes de comidas consumidas
- Sección colapsable "Micronutrientes del día" en `/app/diet/page.tsx`
- Barras de progreso igual que macros (verde/amarillo/rojo)
- Se actualiza al marcar/desmarcar comidas

**Archivos afectados:**
- `nutrition_assistant/api.py` — añadir endpoint `/micronutrients/today`
- `nutrition_frontend/app/diet/page.tsx` — añadir sección colapsable

**Criterios de aceptación:**
- Section visible in diet page; updates on meal check/uncheck; null fields shown as 'sin datos'.

---

### 4.4 Visualización histórica de micronutrientes

**Objetivo:** Ver tendencias de micronutrientes en los últimos días.

**Diseño:**
- Nueva pestaña "Micronutrientes" en `/app/progress/page.tsx`
- Gráficos de línea (Recharts) para los últimos 7/30 días
- Selector de nutriente a visualizar
- Nuevo endpoint `GET /micronutrients/history?days=7|30`

**Archivos afectados:**
- `nutrition_assistant/api.py` — añadir endpoint `/micronutrients/history`
- `nutrition_frontend/app/progress/page.tsx` — añadir pestaña de micronutrientes

**Criterios de aceptación (Fase 4 completa):**
- Campos de micronutrientes presentes en modelo de alimento
- RDA calculada por defecto según perfil
- Objetivos editables en settings
- Sección colapsable en dieta con barras de progreso
- Pestaña histórica en progreso con gráficos
- Campos `null` mostrados como "sin datos"

---

## Orden de implementación y dependencias

```
F0 (Gaps) → F1 (Dashboard) → F2 (Gestión plan) → F3 (Datos) → F4 (Micronutrientes)
```

- Gap 2 de F0 (sync backend) debe completarse antes de cualquier feature que añada nuevo estado que requiera sincronización. Gap 1 de F0 (banner dashboard) y las fases F1, F2 y F3 son independientes entre sí.
- F1, F2, F3 son independientes entre sí (pueden implementarse en cualquier orden)
- F4 requiere el modelo de alimento extendido — no depende de otras fases pero es la más larga

## Stack de referencia

- Frontend: Next.js 15 (App Router), React Context, Tailwind, Recharts
- Backend: Python + FastAPI, almacenamiento JSON
- Estado global: DietDayContext + CheatDayContext (localStorage + backend tras F0)
