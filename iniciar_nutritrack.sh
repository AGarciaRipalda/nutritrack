#!/bin/bash
# =============================================================================
# NutriTrack — Script de arranque
# Arranca el backend, obtiene la URL de ngrok, actualiza Vercel y despliega
# =============================================================================

# ── Rutas (no tocar si no cambia la instalación) ──────────────────────────────
BACKEND_DIR="/mnt/c/Users/Alejandro/nutrition_assistant"
CONFIG_FILE="$HOME/.nutritrack_config"
VERCEL_PROJECT_ID="prj_ybCyZyDlZPRxlhwsZpkUQat2uEbN"
APP_URL="https://nutritrack-taupe.vercel.app"

# ── Colores ───────────────────────────────────────────────────────────────────
G='\033[0;32m'; B='\033[0;34m'; Y='\033[1;33m'; R='\033[0;31m'; W='\033[1m'; N='\033[0m'
log()  { echo -e "${B}▶${N} $1"; }
ok()   { echo -e "${G}✓${N} $1"; }
warn() { echo -e "${Y}⚠${N}  $1"; }
err()  { echo -e "${R}✗${N} $1"; exit 1; }
sep()  { echo -e "${B}──────────────────────────────────────────────────${N}"; }

# ── Banner ────────────────────────────────────────────────────────────────────
clear
echo ""
echo -e "${G}${W}  ╔═╗ NutriTrack${N}"
echo -e "${G}  ╚═╝ Sistema de nutrición y entrenamiento${N}"
echo ""
sep

# ── Configuración (solo la primera vez) ───────────────────────────────────────
if [ ! -f "$CONFIG_FILE" ]; then
    echo ""
    echo -e "  ${W}Primera ejecución — configuración inicial${N}"
    echo ""
    echo "  Necesito tu token de Vercel para actualizar la URL del backend"
    echo "  automáticamente cada vez que cambie el túnel ngrok."
    echo ""
    echo "  Consíguelo en: vercel.com/account/tokens  (elige 'Full Account')"
    echo ""
    read -rp "  Pega tu Vercel token: " VERCEL_TOKEN_INPUT
    echo ""

    # Guardar token
    echo "VERCEL_TOKEN=$VERCEL_TOKEN_INPUT" > "$CONFIG_FILE"

    # Crear deploy hook una sola vez
    log "Creando deploy hook en Vercel..."
    HOOK_RESP=$(curl -s -X POST \
        -H "Authorization: Bearer $VERCEL_TOKEN_INPUT" \
        -H "Content-Type: application/json" \
        -d '{"name":"NutriTrack Start","ref":"main"}' \
        "https://api.vercel.com/v1/projects/$VERCEL_PROJECT_ID/deploy-hooks")

    HOOK_URL=$(echo "$HOOK_RESP" | python3 -c \
        "import sys,json; d=json.load(sys.stdin); print(d.get('url',''))" 2>/dev/null)

    if [ -n "$HOOK_URL" ]; then
        echo "DEPLOY_HOOK_URL=$HOOK_URL" >> "$CONFIG_FILE"
        ok "Deploy hook creado y guardado"
    else
        warn "No se pudo crear el deploy hook. El redespliegue Vercel será manual."
    fi
    echo ""
fi

# Cargar configuración guardada
# shellcheck disable=SC1090
source "$CONFIG_FILE"

# ── 1. Limpiar procesos anteriores ────────────────────────────────────────────
log "Limpiando procesos anteriores..."
pkill -f "uvicorn api:app" 2>/dev/null || true
taskkill.exe /F /IM ngrok.exe > /dev/null 2>&1 || true
sleep 1
ok "Limpieza completada"

# ── 2. Arrancar backend ───────────────────────────────────────────────────────
log "Arrancando backend FastAPI..."
cd "$BACKEND_DIR" || err "No se encontró el directorio $BACKEND_DIR"
uvicorn api:app --host 0.0.0.0 --port 8000 --log-level error \
    > /tmp/nutritrack_backend.log 2>&1 &
UVICORN_PID=$!

echo -n "  Esperando backend"
for i in $(seq 1 20); do
    if curl -s http://localhost:8000/docs > /dev/null 2>&1; then
        echo ""
        ok "Backend activo → http://localhost:8000"
        break
    fi
    if [ "$i" -eq 20 ]; then
        echo ""
        err "El backend no arrancó. Log: /tmp/nutritrack_backend.log"
    fi
    echo -n "."
    sleep 1
done

# ── 3. Obtener URL de ngrok ───────────────────────────────────────────────────
# ngrok ya está corriendo (lo arranca NutriTrack.bat antes de llamar este script)
log "Esperando túnel ngrok..."
NGROK_URL=""
for i in $(seq 1 20); do
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    tunnels = json.load(sys.stdin).get('tunnels', [])
    https = [t for t in tunnels if t.get('proto') == 'https']
    print(https[0]['public_url'] if https else '')
except:
    print('')
" 2>/dev/null)

    [ -n "$NGROK_URL" ] && break
    sleep 1
done

if [ -z "$NGROK_URL" ]; then
    err "No se pudo obtener la URL de ngrok. Comprueba que ngrok esté corriendo."
fi
ok "Túnel activo → $NGROK_URL"

# ── 4. Actualizar env var en Vercel ──────────────────────────────────────────
if [ -n "$VERCEL_TOKEN" ]; then
    log "Actualizando NEXT_PUBLIC_API_URL en Vercel..."
    python3 - <<PYEOF
import urllib.request, json

token      = "$VERCEL_TOKEN"
project_id = "$VERCEL_PROJECT_ID"
ngrok_url  = "$NGROK_URL"
headers    = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def api(method, path, body=None):
    req = urllib.request.Request(
        f"https://api.vercel.com{path}",
        data=json.dumps(body).encode() if body else None,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode()}

# Buscar si la env var ya existe
data = api("GET", f"/v9/projects/{project_id}/env?limit=100")
env  = next((e for e in data.get("envs", []) if e["key"] == "NEXT_PUBLIC_API_URL"), None)

if env:
    result = api("PATCH", f"/v9/projects/{project_id}/env/{env['id']}", {
        "value": ngrok_url,
        "target": ["production", "preview"],
    })
else:
    result = api("POST", f"/v9/projects/{project_id}/env", {
        "key":    "NEXT_PUBLIC_API_URL",
        "value":  ngrok_url,
        "target": ["production", "preview"],
        "type":   "plain",
    })

if "error" in result:
    print(f"  ⚠  Error: {result['error']}")
else:
    print(f"  → NEXT_PUBLIC_API_URL = {ngrok_url}")
PYEOF
    ok "Variable de entorno actualizada"
fi

# ── 5. Lanzar redespliegue en Vercel ─────────────────────────────────────────
if [ -n "$DEPLOY_HOOK_URL" ]; then
    log "Lanzando redespliegue en Vercel..."
    curl -s -X POST "$DEPLOY_HOOK_URL" > /dev/null
    ok "Redespliegue iniciado (listo en ~1-2 minutos)"
fi

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
sep
echo ""
echo -e "  ${G}${W}NutriTrack arrancado correctamente${N}"
echo ""
printf "  %-12s %s\n" "Backend:"  "http://localhost:8000"
printf "  %-12s %s\n" "API docs:" "http://localhost:8000/docs"
printf "  %-12s %s\n" "Ngrok:"    "$NGROK_URL"
printf "  %-12s %s\n" "App web:"  "$APP_URL"
echo ""
[ -n "$DEPLOY_HOOK_URL" ] && \
    echo -e "  ${Y}La app web estará lista con la nueva URL en ~1-2 minutos${N}"
echo ""
sep
echo ""
echo -e "  Pulsa ${W}Ctrl+C${N} para apagar todos los servicios"
echo ""

# ── Apagado limpio al cerrar ──────────────────────────────────────────────────
cleanup() {
    echo ""
    log "Apagando servicios..."
    kill "$UVICORN_PID" 2>/dev/null || true
    taskkill.exe /F /IM ngrok.exe > /dev/null 2>&1 || true
    ok "Servicios detenidos. ¡Hasta pronto!"
    exit 0
}
trap cleanup SIGINT SIGTERM

# Mantener el script vivo mostrando el log del backend
tail -f /tmp/nutritrack_backend.log 2>/dev/null &
wait "$UVICORN_PID"
