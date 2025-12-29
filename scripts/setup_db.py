import os
import sys
import json
import django
from pathlib import Path

# 1. Configurar el entorno de Django
# Obtenemos la ruta base del proyecto (dos niveles arriba de este script)
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

# 2. Importar los modelos (SOLO DESPUÉS de django.setup())
from apps.academic.models import Career, Subject

def load_academic_data():
    json_path = BASE_DIR / 'scripts' / 'seeds' / 'academic_data.json'
    
    print(f"--> Leyendo datos desde: {json_path}")
    
    try:
        with open(json_path, 'r', encoding='utf-8') as file:
            careers_data = json.load(file)
            
        for career_data in careers_data:
            # Crear o recuperar la carrera (evita duplicados)
            career, created = Career.objects.get_or_create(
                name=career_data['name'],
                defaults={
                    'short_name': career_data['short_name'],
                    'description': career_data.get('description', '')
                }
            )
            
            action = "Creada" if created else "Ya existe"
            print(f"[{action}] Carrera: {career.name}")
            
            # Cargar materias de esa carrera
            subjects = career_data.get('subjects', [])
            for sub in subjects:
                subject, sub_created = Subject.objects.get_or_create(
                    name=sub['name'],
                    career=career,
                    defaults={'year_level': sub['year']}
                )
                if sub_created:
                    print(f"   + Materia agregada: {subject.name} (Año {subject.year_level})")

        print("\n¡Carga de datos académicos finalizada con éxito!")

    except FileNotFoundError:
        print("ERROR: No se encontró el archivo academic_data.json")
    except Exception as e:
        print(f"ERROR: Ocurrió un problema: {e}")

if __name__ == '__main__':
    print("Iniciando script de setup inicial de Base de Datos...")
    load_academic_data()