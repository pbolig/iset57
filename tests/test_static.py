import os
import sys
import django
from django.conf import settings

# 1. Configura el entorno (cambia 'nombre_de_tu_proyecto' por el nombre real de la carpeta donde está settings.py)
# Si no sabes el nombre, busca la carpeta que contiene settings.py
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings') # <--- AJUSTA ESTO

try:
    django.setup()
except Exception as e:
    print(f"Error al iniciar Django: {e}")
    sys.exit(1)

print("---- DIAGNÓSTICO DE STATIC FILES ----")
print(f"BASE_DIR: {settings.BASE_DIR}")
print(f"DEBUG mode: {settings.DEBUG}")
print(f"STATIC_URL: {settings.STATIC_URL}")

try:
    print(f"STATIC_ROOT (Donde collectstatic guarda): {settings.STATIC_ROOT}")
except AttributeError:
    print("STATIC_ROOT: No configurado")

try:
    print(f"STATICFILES_DIRS (Donde busca extras): {settings.STATICFILES_DIRS}")
except AttributeError:
    print("STATICFILES_DIRS: No configurado")

print("-------------------------------------")