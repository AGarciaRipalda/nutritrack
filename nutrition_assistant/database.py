"""
Módulo de conexión a PostgreSQL.

Proporciona un pool de conexiones y funciones helper para ejecutar queries.
Si DATABASE_URL no está definida, las funciones devuelven None y el backend
sigue funcionando con los archivos JSON como fallback.
"""

import os
import json
import contextlib
from typing import Optional

_pool = None
_DB_AVAILABLE = False


def _get_pool():
    """Inicializa el pool de conexiones de forma lazy."""
    global _pool, _DB_AVAILABLE
    if _pool is not None:
        return _pool

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        _DB_AVAILABLE = False
        return None

    try:
        from psycopg2 import pool as pg_pool
        _pool = pg_pool.SimpleConnectionPool(1, 5, database_url)
        _DB_AVAILABLE = True
        print("  ✓ Conectado a PostgreSQL.", flush=True)
        return _pool
    except Exception as e:
        print(f"  ⚠ No se pudo conectar a PostgreSQL: {e}", flush=True)
        print("  ℹ Continuando con almacenamiento JSON.", flush=True)
        _DB_AVAILABLE = False
        return None


def is_db_available() -> bool:
    """True si hay conexión a PostgreSQL disponible."""
    _get_pool()
    return _DB_AVAILABLE


@contextlib.contextmanager
def get_cursor(commit=True):
    """Context manager que proporciona un cursor de PostgreSQL.

    Uso:
        with get_cursor() as cur:
            cur.execute("SELECT * FROM user_profiles")
            rows = cur.fetchall()

    Si la DB no está disponible, lanza RuntimeError.
    """
    p = _get_pool()
    if p is None:
        raise RuntimeError("PostgreSQL no disponible")

    conn = p.getconn()
    try:
        cur = conn.cursor()
        yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        p.putconn(conn)


def fetchone(query: str, params=None) -> Optional[dict]:
    """Ejecuta una query y devuelve la primera fila como dict."""
    with get_cursor(commit=False) as cur:
        cur.execute(query, params)
        if cur.description is None:
            return None
        cols = [d[0] for d in cur.description]
        row = cur.fetchone()
        return dict(zip(cols, row)) if row else None


def fetchall(query: str, params=None) -> list[dict]:
    """Ejecuta una query y devuelve todas las filas como lista de dicts."""
    with get_cursor(commit=False) as cur:
        cur.execute(query, params)
        if cur.description is None:
            return []
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def execute(query: str, params=None):
    """Ejecuta una query de escritura (INSERT/UPDATE/DELETE)."""
    with get_cursor(commit=True) as cur:
        cur.execute(query, params)
        return cur.rowcount
