# Usamos una imagen oficial de Python liviana
FROM python:3.11-slim

# Evita que Python escriba archivos .pyc y fuerza la salida estándar (logs) en tiempo real
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Instalamos dependencias del sistema necesarias para mysqlclient y otras herramientas
# build-essential y default-libmysqlclient-dev son claves para conectar con MySQL luego
RUN apt-get update && apt-get install -y \
    build-essential \
    default-libmysqlclient-dev \
    pkg-config \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copiamos primero los requerimientos para aprovechar la caché de Docker
COPY requirements.txt /app/

# Instalamos las dependencias de Python
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copiamos el resto del código del proyecto
COPY . /app/

# Exponemos el puerto donde correrá Django
EXPOSE 8000

# Por defecto corremos este comando, pero docker-compose lo puede sobreescribir
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]