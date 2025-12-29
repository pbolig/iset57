from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, UserDocument

# --- 1. Configuración para ver los documentos DENTRO del usuario ---
class UserDocumentInline(admin.TabularInline):
    model = UserDocument
    extra = 0  # No mostramos filas vacías para agregar, solo lo que hay
    fields = ('file', 'description', 'uploaded_at')
    readonly_fields = ('uploaded_at',) # La fecha es solo lectura

# --- 2. Configuración del Admin de Usuario Principal ---
class CustomUserAdmin(UserAdmin):
    model = User
    inlines = [UserDocumentInline]


    list_display = ['username', 'email', 'first_name', 'last_name', 'dni', 'role', 'is_active']
    
    list_filter = ['role', 'is_active', 'is_staff']
    search_fields = ['username', 'email', 'first_name', 'last_name'] # Quitamos dni de aquí también por si acaso
    
    fieldsets = UserAdmin.fieldsets + (
        ('Información Extra', {'fields': ('role', 'dni', 'is_email_verified')}),
    )

admin.site.register(User, CustomUserAdmin)
