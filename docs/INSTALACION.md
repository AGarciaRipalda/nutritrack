# NutriTrack — Guía de Instalación y Despliegue

Esta guía cubre la instalación local y el despliegue en producción del proyecto NutriTrack, tanto en macOS como en Linux.

---

## 1. Requisitos previos

| Componente | Versión mínima |
|------------|----------------|
| Python     | 3.11+          |
| Node.js    | 18+            |
| Git        | cualquiera reciente |

### Instalar Git

**macOS (Homebrew):**
```bash
brew install git
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt update && sudo apt install -y git
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install -y git
```

---

### Instalar Python 3.11+

**macOS (Homebrew):**
```bash
brew install python@3.11
```

Verifica la versión:
```bash
python3 --version
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt update && sudo apt install -y python3.11 python3.11-venv python3-pip
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install -y python3.11
```

---

### Instalar Node.js 18+

**macOS (Homebrew):**
```bash
brew install node@18
```

O instala la versión LTS más reciente:
```bash
brew install node
```

**Linux — usando NodeSource (Debian/Ubuntu):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install -y nodejs npm
```

Verifica las versiones:
```bash
node --version
npm --version
```

---

## 2. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO> nutritrack
cd nutritrack
```

Estructura principal tras clonar:

```
nutritrack/
├── nutrition_assistant/   # Backend FastAPI + datos en JSON
├── nutrition_frontend/    # Frontend Next.js
├── docs/
└── iniciar_nutritrack.sh
```

---

## 3. Configurar el backend

El backend es una API FastAPI que lee y escribe datos en archivos JSON dentro de `nutrition_assistant/`. No requiere base de datos ni variables de entorno.

### 3.1 Crear y activar el entorno virtual

```bash
cd nutrition_assistant
python3 -m venv venv
```

**Activar en macOS / Linux:**
```bash
source venv/bin/activate
```

El prompt cambiará a algo como `(venv) $`.

### 3.2 Instalar dependencias

No existe un `requirements.txt` incluido; instala los paquetes directamente:

```bash
pip install fastapi uvicorn pydantic
```

### 3.3 Iniciar el servidor de desarrollo

Desde el directorio `nutrition_assistant/` con el entorno virtual activo:

```bash
uvicorn api:app --reload
```

El servidor quedará disponible en **http://localhost:8000**.

La documentación interactiva de la API (Swagger UI) está en **http://localhost:8000/docs**.

---

## 4. Configurar el frontend

El frontend es una aplicación Next.js 15. Abre una nueva terminal para este paso (deja el backend corriendo).

### 4.1 Instalar dependencias de Node

```bash
cd nutrition_frontend
npm install
```

### 4.2 Crear el archivo de variables de entorno

Crea el archivo `.env.local` en la raíz de `nutrition_frontend/`:

```bash
touch nutrition_frontend/.env.local
```

Agrega el siguiente contenido:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> Este archivo no debe incluirse en el repositorio (está en `.gitignore` por defecto en proyectos Next.js).

### 4.3 Iniciar el servidor de desarrollo

```bash
npm run dev
```

El frontend quedará disponible en **http://localhost:3000**.

---

## 5. Verificar la instalación

Con ambos servicios corriendo, abre tu navegador y comprueba:

| URL | Qué verifica |
|-----|--------------|
| http://localhost:3000 | Frontend Next.js cargado |
| http://localhost:8000/docs | API FastAPI — documentación Swagger |

Si ambas páginas cargan sin errores, la instalación es correcta.

---

## 6. Script de arranque incluido

El repositorio incluye el script `iniciar_nutritrack.sh` en la raíz. Este script fue diseñado para entornos **Windows con WSL** y no es compatible directamente con macOS o Linux nativo. Si trabajas en Mac o Linux, usa los comandos de las secciones 3 y 4 directamente. El script puede servir de referencia, pero requiere adaptación.

---

## 7. Despliegue en producción

### 7.1 Frontend — Vercel

Vercel es la plataforma recomendada para Next.js.

1. Crea una cuenta en [vercel.com](https://vercel.com).
2. Importa el repositorio desde GitHub/GitLab/Bitbucket.
3. Cuando Vercel pida la configuración del proyecto:
   - **Root Directory:** `nutrition_frontend`
   - **Framework Preset:** Next.js (detectado automáticamente)
4. Agrega la variable de entorno en el panel de Vercel:
   ```
   NEXT_PUBLIC_API_URL=https://tu-backend.ejemplo.com
   ```
5. Despliega. Vercel asignará una URL pública.

> Actualiza `NEXT_PUBLIC_API_URL` cada vez que cambie la URL del backend.

---

### 7.2 Backend — Opciones

#### Opción A: VPS con systemd (recomendado para producción)

En un servidor Linux (Ubuntu/Debian):

```bash
# Clonar el proyecto en el servidor
git clone <URL_DEL_REPOSITORIO> /opt/nutritrack
cd /opt/nutritrack/nutrition_assistant
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn pydantic
```

Crea el archivo de servicio systemd:

```bash
sudo nano /etc/systemd/system/nutritrack-api.service
```

Contenido del archivo:

```ini
[Unit]
Description=NutriTrack FastAPI Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/nutritrack/nutrition_assistant
ExecStart=/opt/nutritrack/nutrition_assistant/venv/bin/uvicorn api:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Habilita e inicia el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable nutritrack-api
sudo systemctl start nutritrack-api
sudo systemctl status nutritrack-api
```

Configura un proxy inverso (nginx) para exponer el puerto 80/443 si es necesario.

---

#### Opción B: ngrok (túnel rápido para pruebas)

Útil para exponer el backend local temporalmente sin configurar un servidor.

1. Instala ngrok: [ngrok.com/download](https://ngrok.com/download)

   **macOS:**
   ```bash
   brew install ngrok/ngrok/ngrok
   ```

   **Linux:**
   ```bash
   curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
   echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
   sudo apt update && sudo apt install ngrok
   ```

2. Autentica ngrok con tu token (obtenido en el panel de ngrok):
   ```bash
   ngrok config add-authtoken <TU_TOKEN>
   ```

3. Con el backend corriendo en el puerto 8000, abre el túnel:
   ```bash
   ngrok http 8000
   ```

4. Copia la URL pública que ngrok proporciona (ej. `https://abc123.ngrok.io`) y úsala como valor de `NEXT_PUBLIC_API_URL` en Vercel o en tu `.env.local`.

> El túnel ngrok gratuito es temporal — la URL cambia cada vez que reinicias ngrok.

---

## 8. Solución de problemas

### Puerto ya en uso

**Error:** `address already in use` al iniciar uvicorn o Next.js.

Identifica el proceso que usa el puerto:

```bash
# macOS / Linux
lsof -i :8000
lsof -i :3000
```

Termina el proceso:
```bash
kill -9 <PID>
```

O usa un puerto alternativo:
```bash
uvicorn api:app --reload --port 8001
```

---

### Versión de Python incorrecta

**Error:** `python3: command not found` o versión inferior a 3.11.

Verifica qué versión tienes:
```bash
python3 --version
```

En macOS con Homebrew, puede ser necesario usar el binario explícito:
```bash
python3.11 -m venv venv
```

---

### Versión de Node incorrecta

**Error:** Next.js 15 requiere Node.js 18+.

Verifica:
```bash
node --version
```

Si tienes varias versiones instaladas, usa `nvm` para cambiar:
```bash
nvm install 18
nvm use 18
```

---

### Errores de CORS

**Síntoma:** El frontend carga pero las llamadas a la API fallan con errores CORS en la consola del navegador.

Causas comunes:

1. `NEXT_PUBLIC_API_URL` apunta a una URL incorrecta o con puerto equivocado — verifica el archivo `.env.local`.
2. El backend no está corriendo — comprueba que uvicorn siga activo.
3. En producción, la URL del backend en la variable de entorno de Vercel no coincide con la URL real del servidor.

El backend FastAPI debe tener configurado el middleware CORS permitiendo el origen del frontend. Verifica en el código de `api.py` que el origen del frontend esté en la lista de `allow_origins`.

---

## 9. Estructura del proyecto

```
nutritrack/
├── nutrition_assistant/       # Backend
│   ├── api.py                 # Punto de entrada FastAPI
│   ├── venv/                  # Entorno virtual Python (no se versiona)
│   └── *.json                 # Archivos de datos (persisten localmente)
│
├── nutrition_frontend/        # Frontend
│   ├── app/                   # Rutas y páginas Next.js (App Router)
│   ├── components/            # Componentes React
│   ├── .env.local             # Variables de entorno locales (no se versiona)
│   ├── package.json
│   └── next.config.js
│
├── docs/                      # Documentación
│   └── INSTALACION.md         # Esta guía
│
└── iniciar_nutritrack.sh      # Script de arranque (orientado a WSL/Windows)
```

> Los archivos JSON en `nutrition_assistant/` actúan como base de datos local. No se requiere ningún motor de base de datos externo.
