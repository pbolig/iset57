import os
import shutil
import stat
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_delete, pre_delete
from django.dispatch import receiver
from django.conf import settings

# --- 1. FUNCIÓN PARA GENERAR LA RUTA DINÁMICA ---
def user_directory_path(instance, filename):
    return 'documentacion/{0}/{1}'.format(instance.user.email, filename)

# --- 2. CLASES (MODELOS) ---
class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Administrativo"
        TEACHER = "TEACHER", "Docente"
        STUDENT = "STUDENT", "Estudiante"
        
    profile_picture = models.ImageField(
        upload_to='profile_pics/', 
        null=True, 
        blank=True, 
        verbose_name="Foto de Perfil"
    )

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

# --- 3. HELPER PARA WINDOWS ---
def remove_readonly(func, path, excinfo):
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception as e:
        print(f"No se pudo forzar el borrado de {path}: {e}")

# --- 4. SEÑALES DE LIMPIEZA ---
@receiver(post_delete, sender=UserDocument)
def auto_delete_file_on_document_delete(sender, instance, **kwargs):
    if instance.file:
        if os.path.isfile(instance.file.path):
            try:
                os.remove(instance.file.path)
                folder_path = os.path.dirname(instance.file.path)
                if os.path.exists(folder_path) and not os.listdir(folder_path):
                    os.rmdir(folder_path)
            except Exception:
                pass

@receiver(pre_delete, sender=User)
def auto_delete_user_folder_on_user_delete(sender, instance, **kwargs):
    try:
        folder_path = os.path.join(settings.MEDIA_ROOT, 'documentacion', instance.email)
        if os.path.exists(folder_path):
            shutil.rmtree(folder_path, onerror=remove_readonly)
    except Exception as e:
        print(f"Error fatal borrando carpeta: {e}")