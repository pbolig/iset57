from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_delete, pre_delete
from django.dispatch import receiver
from django.conf import settings
import os
import shutil
import stat # <--- NECESARIO PARA PERMISOS DE WINDOWS

# --- 1. FUNCIÓN PARA GENERAR LA RUTA DINÁMICA ---
def user_directory_path(instance, filename):
    return 'documentacion/{0}/{1}'.format(instance.user.email, filename)

class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Administrativo"
        TEACHER = "TEACHER", "Docente"
        STUDENT = "STUDENT", "Estudiante"

    dni = models.CharField(max_length=20, unique=True, verbose_name="DNI / Pasaporte")
    role = models.CharField(max_length=50, choices=Role.choices, default=Role.STUDENT)
    is_email_verified = models.BooleanField(default=False)

class UserDocument(models.Model):
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='documents',
        verbose_name="Usuario"
    )
    description = models.CharField(max_length=100, verbose_name="Descripción del archivo")
    
    file = models.FileField(
        upload_to=user_directory_path,
        verbose_name="Archivo"
    )
    
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.description}"

# ==============================================================================
# HELPER PARA WINDOWS (FUERZA BRUTA)
# ==============================================================================
def remove_readonly(func, path, excinfo):
    """
    Función auxiliar para desbloquear archivos en Windows que no se dejan borrar.
    Cambia los permisos a 'Escritura' y reintenta el borrado.
    """
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception as e:
        print(f"No se pudo forzar el borrado de {path}: {e}")

# ==============================================================================
# SEÑALES DE LIMPIEZA
# ==============================================================================

# 1. Si borras un DOCUMENTO individual
@receiver(post_delete, sender=UserDocument)
def auto_delete_file_on_document_delete(sender, instance, **kwargs):
    if instance.file:
        if os.path.isfile(instance.file.path):
            try:
                os.remove(instance.file.path)
                # Intentamos borrar carpeta si quedó vacía
                folder_path = os.path.dirname(instance.file.path)
                # Verificamos si existe antes de listar para evitar error
                if os.path.exists(folder_path) and not os.listdir(folder_path):
                     os.rmdir(folder_path)
            except Exception as e:
                pass # Silenciamos errores menores aquí

# 2. Si borras un USUARIO (Usamos pre_delete para ganar la carrera al bloqueo)
@receiver(pre_delete, sender=User)
def auto_delete_user_folder_on_user_delete(sender, instance, **kwargs):
    try:
        # Ruta: media/documentacion/email
        folder_path = os.path.join(settings.MEDIA_ROOT, 'documentacion', instance.email)
        
        if os.path.exists(folder_path):
            # onerror=remove_readonly es la clave para que Windows obedezca
            shutil.rmtree(folder_path, onerror=remove_readonly)
            print(f"--- Carpeta {folder_path} ELIMINADA (Forzado) ---")
            
    except Exception as e:
        print(f"Error fatal borrando carpeta: {e}")