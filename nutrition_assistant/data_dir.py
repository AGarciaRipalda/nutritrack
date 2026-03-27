"""
Directorio de datos persistentes.

En local:   DATA_DIR = directorio del propio módulo (comportamiento actual)
En Render:  DATA_DIR = /data  (disco persistente montado en render.yaml)

Para cambiar, basta con establecer la variable de entorno DATA_DIR.
"""
import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent))
DATA_DIR.mkdir(parents=True, exist_ok=True)
