# NutriTrack — Guía de Despliegue en Oracle Cloud Infrastructure

## 1. Crear cuenta en OCI

1. Ve a [cloud.oracle.com](https://cloud.oracle.com) y regístrate (necesitas tarjeta, pero no se cobra).
2. Selecciona la región **eu-frankfurt-1** (Frankfurt) como Home Region.
3. Una vez creada la cuenta, accede a la consola de OCI.

---

## 2. Crear instancia Always Free

### 2.1 Navegar al menú

1. Menú hamburguesa → **Compute** → **Instances** → **Create Instance**.

### 2.2 Configuración recomendada

| Parámetro | Valor |
|---|---|
| **Name** | `nutritrack-server` |
| **Compartment** | El compartment por defecto (root) |
| **Placement** | Availability Domain de Frankfurt |
| **Image** | **Oracle Linux 9** (Aarch64) |
| **Shape** | `VM.Standard.A1.Flex` — **4 OCPUs, 24 GB RAM** |
| **Boot Volume** | 200 GB (máximo free tier) |

> **¿Por qué Oracle Linux 9?** Mejor soporte de la plataforma ARM de OCI, parches Security
> automáticos, y compatibilidad nativa con todos los tools de OCI.

### 2.3 Networking

- **VCN**: crea una nueva VCN o usa la existente.
- **Subnet**: usa la subnet pública por defecto.
- **Public IP**: selecciona **Assign a public IPv4 address**.

### 2.4 SSH Key

- **Generate a key pair**: descarga la clave privada (`.key`).
- O bien sube tu clave pública existente (`~/.ssh/id_rsa.pub`).

### 2.5 Crear instancia

Click en **Create**. Espera ~2 minutos hasta que el estado sea **RUNNING**.
Copia la **Public IP** (ej. `132.145.xxx.xxx`).

---

## 3. Configurar Security List (reglas de firewall)

### 3.1 Navegar

Menú → **Networking** → **Virtual Cloud Networks** → tu VCN → **Security Lists** → **Default Security List**.

### 3.2 Añadir Ingress Rules

Click en **Add Ingress Rules** y añadir las siguientes reglas:

| Puerto | Protocolo | Source CIDR | Descripción |
|---|---|---|---|
| 22 | TCP | `0.0.0.0/0` | SSH (ya debería existir) |
| 80 | TCP | `0.0.0.0/0` | HTTP (web) |
| 443 | TCP | `0.0.0.0/0` | HTTPS (si usas certificado SSL) |
| 8000 | TCP | `0.0.0.0/0` | API backend FastAPI |
| 3000 | TCP | `0.0.0.0/0` | Frontend Next.js (desarrollo) |

> **Nota**: En producción, puedes usar Nginx como reverse proxy y exponer solo 80/443.

### 3.3 Abrir puertos en el firewall del SO

Oracle Linux 9 tiene `firewalld` activo. Después de conectar por SSH, ejecuta:

```bash
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

---

## 4. Conectar por SSH

```bash
# Desde tu Mac
chmod 400 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key opc@<PUBLIC-IP>
```

> El usuario por defecto en Oracle Linux es `opc` (con sudo).

---

## 5. Instalar Docker y Docker Compose

### Oracle Linux 9 (ARM)

```bash
# Instalar Docker
sudo dnf install -y dnf-utils
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Arrancar Docker y habilitar al inicio
sudo systemctl start docker
sudo systemctl enable docker

# Permitir usar Docker sin sudo
sudo usermod -aG docker opc
newgrp docker

# Verificar
docker --version
docker compose version
```

---

## 6. Desplegar NutriTrack

### 6.1 Clonar el repositorio

```bash
git clone https://github.com/AGarciaRipalda/nutritrack.git
cd nutritrack
```

### 6.2 Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Editar `.env` con los valores de producción:

```env
POSTGRES_USER=nutritrack
POSTGRES_PASSWORD=<CONTRASEÑA_SEGURA_AQUI>
POSTGRES_DB=nutritrack
NEXT_PUBLIC_API_URL=http://<PUBLIC-IP>:8000
```

### 6.3 Construir y levantar todo

```bash
# Construir las imágenes y levantar los 3 servicios
docker compose up -d --build
```

Este comando:
1. ✅ Descarga la imagen de PostgreSQL 16
2. ✅ Ejecuta `db/init.sql` (crea las tablas)
3. ✅ Construye la imagen del backend FastAPI
4. ✅ Construye la imagen del frontend Next.js
5. ✅ Levanta todo en background

### 6.4 Verificar que todo funciona

```bash
# Ver estado de los contenedores
docker compose ps

# Ver logs
docker compose logs -f

# Probar el backend
curl http://localhost:8000/docs

# Probar desde tu iPhone o navegador
# Abre: http://<PUBLIC-IP>:8000/docs  (API)
# Abre: http://<PUBLIC-IP>:3000       (Frontend)
```

### 6.5 Migrar datos existentes (opcional)

Si tienes archivos JSON de tu despliegue anterior en Render:

```bash
# Copiar los JSON al contenedor del backend
docker cp exercise_history.json nutritrack-backend-1:/data/
docker cp adherence_log.json nutritrack-backend-1:/data/
docker cp user_profile.json nutritrack-backend-1:/data/
docker cp session.json nutritrack-backend-1:/data/

# Ejecutar la migración
docker compose exec backend python /app/migrate_data.py --data-dir /data
```

---

## 7. Comandos útiles de mantenimiento

```bash
# Reiniciar servicios
docker compose restart

# Reconstruir (tras cambios de código)
docker compose up -d --build

# Ver logs de un servicio específico
docker compose logs -f backend

# Backup de la base de datos
docker compose exec db pg_dump -U nutritrack nutritrack > backup_$(date +%Y%m%d).sql

# Restaurar backup
cat backup_20260323.sql | docker compose exec -T db psql -U nutritrack nutritrack

# Parar todo
docker compose down

# Parar y borrar volúmenes (¡BORRA LOS DATOS!)
docker compose down -v
```

---

## 8. Costes esperados

| Recurso | Coste |
|---|---|
| Instancia A1 (4 OCPU, 24 GB) | **$0 / mes** (Always Free) |
| Boot Volume 200 GB | **$0 / mes** (Always Free) |
| Bandwidth (10 TB/mes) | **$0 / mes** (Always Free) |
| **Total** | **$0 / mes** |

> El tier Always Free de OCI no caduca. La instancia Ampere A1 es permanentemente gratuita
> siempre que la cuenta se mantenga activa.
