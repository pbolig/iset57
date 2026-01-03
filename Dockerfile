# 1. Imagen base: Python 3.12 versión "slim" (ligera, basada en Debian)
FROM python:3.12-slim

# 2. Variables de entorno para optimizar Python en Docker
# Evita la creación de archivos .pyc y asegura que los logs se vean en tiempo real
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. Directorio de trabajo dentro del contenedor
WORKDIR /app

# 4. INSTALACIÓN DE DEPENDENCIAS DEL SISTEMA (La parte crítica para tus PDFs)
# - build-essential, pkg-config, python3-dev: Para compilar extensiones de C
# - libcairo2-dev: OBLIGATORIO para pycairo/rlPyCairo
# - libffi-dev, libssl-dev: Para cryptography y pyHanko
# - libjpeg-dev, zlib1g-dev: Para Pillow (manejo de imágenes en PDFs)
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    python3-dev \
    libcairo2-dev \
    libffi-dev \
    libssl-dev \
    libjpeg-dev \
    zlib1g-dev \
    # Limpiamos caché para que la imagen pese menos
    && rm -rf /var/lib/apt/lists/*

# 5. Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 6. Copiar el resto del código del proyecto
COPY . .

# 7. Exponer el puerto (informativo)
EXPOSE 8000

# 8. Comando de arranque
# Nota: Para producción real deberías usar Gunicorn, pero para probar usa este:
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]