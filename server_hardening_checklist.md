# Server Hardening Checklist

## Sistema y acceso

- Mantener el sistema operativo y paquetes base actualizados.
- Deshabilitar acceso SSH por contraseña y permitir solo claves.
- Limitar acceso SSH por IP si es viable.
- Cambiar el puerto SSH solo si forma parte de una política más amplia, no como única medida.
- Activar `fail2ban` o equivalente para SSH y endpoints sensibles.
- Revisar periódicamente usuarios con acceso `sudo`.

## Red y perímetro

- Exponer públicamente solo `80/443`; cerrar el resto con firewall.
- Permitir acceso al backend solo desde el reverse proxy si la topología lo permite.
- Forzar HTTPS extremo a extremo.
- Confirmar HSTS en el proxy/CDN.
- Activar protección DDoS/WAF básica en CDN o proveedor.

## Aplicación

- Definir `JWT_SECRET_KEY` fuerte y rotarlo con procedimiento documentado.
- Definir `JWT_REFRESH_EXPIRE_DAYS` y `JWT_EXPIRE_MINUTES` según el riesgo aceptado.
- Definir `FRONTEND_BASE_URL` correcto para enlaces de reseteo.
- Mantener `ENABLE_API_DOCS=0` en producción salvo necesidad puntual.
- Revisar `security_events.jsonl`, `rate_limits.json` y `password_reset_tokens.json` en backups y rotación.
- Limpiar tokens de reseteo y eventos antiguos si el volumen crece.

## Datos y secretos

- Guardar `/etc/metabolic-api.env` con permisos `600`.
- No reutilizar secretos entre entornos.
- Cifrar y probar backups de base de datos y ficheros de datos.
- Verificar restauraciones de backup de forma periódica.
- No registrar contraseñas, tokens ni enlaces completos de reseteo en logs generales.

## Monitorización

- Alertar por reinicios del servicio `metabolic-api.service`.
- Alertar por picos de `401`, `403`, `429` y `5xx`.
- Revisar eventos `auth.login_failed`, `security.rate_limit_blocked` y acciones admin.
- Centralizar logs si el proyecto crece a varias máquinas.

## Despliegue y respuesta

- Mantener procedimiento de rotación de JWT y cierre forzado de sesiones.
- Documentar rollback de backend y frontend.
- Probar cambio de contraseña, logout, refresh y reset después de cada despliegue.
- Tener un procedimiento de respuesta ante compromiso:
  revocar sesiones, rotar secretos, revisar auditoría, restaurar backups si aplica.
