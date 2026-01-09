from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, UserDocument  # <--- AQUÍ SÍ FUNCIONA (porque estamos en la carpeta users)

class CustomUserAdmin(UserAdmin):
    model = User
    
    # 1. VISUALIZACIÓN EN LA LISTA
    list_display = ['username', 'email', 'first_name', 'last_name', 'dni', 'role', 'is_active']
    
    # 2. FORMULARIO DE EDICIÓN
    # Agregamos 'profile_picture' aquí
    fieldsets = UserAdmin.fieldsets + (
        ('Información Académica', {'fields': ('dni', 'role', 'profile_picture', 'is_email_verified')}),
    )
    
    # 3. FORMULARIO DE CREACIÓN
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Información Académica', {'fields': ('dni', 'role', 'profile_picture', 'email')}),
    )

# REGISTRO
admin.site.register(User, CustomUserAdmin)

@admin.register(UserDocument)
class UserDocumentAdmin(admin.ModelAdmin):
    list_display = ('user', 'description', 'uploaded_at')