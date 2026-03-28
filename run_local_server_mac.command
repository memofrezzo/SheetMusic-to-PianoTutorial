#!/bin/bash
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_CMD="python"
else
  echo "No se encontro Python. Instala Python 3 para continuar."
  read -r -n 1 -p "Presiona cualquier tecla para cerrar..."
  echo
  exit 1
fi

echo "Servidor local disponible en http://localhost:8080"
open "http://localhost:8080" >/dev/null 2>&1
exec "$PYTHON_CMD" -m http.server 8080
