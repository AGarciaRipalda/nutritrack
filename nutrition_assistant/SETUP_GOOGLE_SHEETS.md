# Configurar Google Sheets para el historial de gym

## Pasos

### 1. Crear un proyecto en Google Cloud
1. Ve a https://console.cloud.google.com/
2. Crea un nuevo proyecto (o usa uno existente)
3. Activa la **Google Sheets API**: APIs y servicios → Biblioteca → busca "Google Sheets API" → Activar

### 2. Crear una Service Account
1. APIs y servicios → Credenciales → Crear credenciales → **Cuenta de servicio**
2. Dale un nombre (ej: `nutritrack-reader`)
3. En el paso 3 de la creación, descarga la clave JSON:
   - Pestaña "Claves" → Agregar clave → Crear clave nueva → JSON
4. Guarda el archivo descargado como:
   ```
   nutrition_assistant/google_credentials.json
   ```

### 3. Compartir el spreadsheet con la Service Account
1. Abre el archivo JSON descargado y copia el valor de `"client_email"` (algo como `nutritrack-reader@tu-proyecto.iam.gserviceaccount.com`)
2. Abre tu Google Sheet
3. Haz clic en "Compartir" → pega ese email → rol **Lector** → Enviar

### 4. Verificar
Reinicia el backend y ve a la pestaña **Gym (Sheets)** en la sección de Entrenamiento.
El badge mostrará "Google Sheets" en verde si la conexión es correcta,
o "Excel local" en azul si lee desde el archivo local como fallback.

## Datos del spreadsheet configurado
- **ID**: `1zxZeuvjVO0hB0zRiq9DcM9iuVoLQh5wzsFC3PWzQVfk`
- **GID de la hoja**: `627901101`
