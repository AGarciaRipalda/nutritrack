# NutriTrack

Aplicación web de seguimiento nutricional y entrenamiento personalizado. Genera planes de dieta semanales adaptados al perfil del usuario, registra ejercicio, peso y adherencia, y ofrece informes semanales con recomendaciones.

## Estructura del repositorio

```
nutritrack/
├── nutrition_frontend/   # Next.js 15 — interfaz web
└── nutrition_assistant/  # FastAPI — backend con lógica nutricional
```

---

## Frontend — `nutrition_frontend`

### Stack

| Tecnología | Versión |
|---|---|
| Next.js | 15.x |
| React | 19 |
| Tailwind CSS | 4 |
| shadcn/ui | — |
| Recharts | 2.x |
| TypeScript | 5 |

### Páginas

| Ruta | Descripción |
|---|---|
| `/` | Dashboard con resumen diario, alertas y macros |
| `/diet` | Dieta del día con opción de regenerar o intercambiar platos |
| `/weekly-plan` | Plan semanal completo + lista de la compra + exportación a PDF |
| `/training` | Registro de ejercicio y generación de rutinas (gym / calistenia) |
| `/progress` | Histórico de peso, tendencia y adherencia semanal |
| `/report` | Informe semanal con encuesta de sensaciones y recomendaciones |
| `/settings` | Perfil, preferencias alimentarias y eventos próximos |

### Instalación

```bash
cd nutrition_frontend
npm install        # o pnpm install
npm run dev        # http://localhost:3000
```

### Variables de entorno

Crea `nutrition_frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

En producción (Vercel) configura esta variable apuntando a la URL pública del backend (p.ej. túnel ngrok o servidor desplegado).

---

## Backend — `nutrition_assistant`

### Stack

| Tecnología | Descripción |
|---|---|
| FastAPI | Framework HTTP |
| Pydantic v2 | Validación de modelos |
| Uvicorn | Servidor ASGI |
| Python 3.11+ | — |

### Módulos principales

| Archivo | Responsabilidad |
|---|---|
| `api.py` | Endpoints REST (perfil, dieta, ejercicio, peso, encuesta…) |
| `diet.py` | Generación de planes de dieta adaptativos |
| `calculator.py` | BMR, TDEE y cálculo de macros (Mifflin-St. Jeor) |
| `storage.py` | Persistencia de perfil y sesión en JSON |
| `exercise_log.py` | Tipos de ejercicio y cálculo de kcal quemadas (MET) |
| `weight_tracker.py` | Historial de peso y análisis de progreso |
| `adherence.py` | Registro de adherencia diaria |
| `weekly_report.py` | Generación del informe semanal |
| `competition_planner.py` | Ajuste calórico por evento/competición próximos |
| `shopping_list.py` | Lista de la compra a partir del plan semanal |
| `training.py` | Rutinas Full Body, PPL y calistenia |

### Endpoints principales

```
GET  /profile                    Perfil del usuario
PUT  /profile                    Actualizar perfil

GET  /diet/today                 Dieta adaptada del día
POST /diet/today/regenerate      Regenerar dieta del día
POST /diet/today/{meal}/swap     Intercambiar un plato

GET  /diet/weekly                Plan semanal
POST /diet/weekly/regenerate     Regenerar plan semanal
GET  /diet/shopping-list         Lista de la compra

POST /exercise/yesterday         Registrar ejercicio de ayer
POST /exercise/today-training    Registrar entrenamiento de hoy
GET  /exercise/history           Historial de ejercicio

POST /weight                     Registrar peso
GET  /weight/history             Historial de peso

GET  /report/weekly              Informe semanal
POST /survey                     Enviar encuesta semanal

GET  /preferences                Preferencias alimentarias
PUT  /preferences                Actualizar preferencias

POST /event                      Crear evento próximo
DELETE /event                    Eliminar evento

GET  /dashboard                  Resumen completo en una sola petición
```

Documentación interactiva disponible en `http://localhost:8000/docs` (Swagger UI).

### Instalación

```bash
cd nutrition_assistant
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install fastapi uvicorn pydantic
uvicorn api:app --reload        # http://localhost:8000
```

---

## Despliegue

| Servicio | Entorno |
|---|---|
| **Vercel** | Frontend (`nutrition_frontend`) |
| **ngrok / servidor propio** | Backend (`nutrition_assistant`) |

Para usar el backend desde Vercel con ngrok:

```bash
ngrok http 8000
# Copia la URL https://xxxx.ngrok-free.app
# → Configura NEXT_PUBLIC_API_URL en Vercel con esa URL
```

> El frontend incluye el header `ngrok-skip-browser-warning: true` en todas las peticiones para evitar el interstitial de ngrok.

---

## Datos de usuario

El backend persiste los datos en archivos JSON locales (en el directorio de `nutrition_assistant`). Estos archivos **no se incluyen en el repositorio**:

- `user_profile.json` — perfil del usuario
- `session.json` — sesión activa (dieta del día, plan semanal)
- `preferences.json` — preferencias alimentarias
- `exercise_history.json`, `weight_history.json`, `adherence_log.json`, `survey_history.json` — históricos

---

## Licencia

MIT
