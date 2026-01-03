from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, UserDocument
# Importante: traer los formularios correctos
from .forms import CustomUserCreationForm, CustomUserChangeForm 

class UserDocumentInline(admin.TabularInline):
    model = UserDocument
    extra = 0
    fields = ('file', 'description', 'uploaded_at')
    readonly_fields = ('uploaded_at',)
    can_delete = True

class CustomUserAdmin(UserAdmin):
    model = User
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm

    # Configuración de visualización
    list_display = ['username', 'email', 'first_name', 'last_name', 'dni', 'role', 'is_active']
    list_filter = ['role', 'is_active', 'is_staff']
    search_fields = ['username', 'email', 'first_name', 'last_name', 'dni']

    # FORMULARIO DE CREACIÓN (Agregar Usuario)
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            # --- CORRECCIÓN: Agregamos 'role' aquí para poder elegirlo al crear ---
            'fields': ('username', 'role', 'email', 'dni', 'first_name', 'last_name', 'password_1', 'password_2'),
        }),
    )

    # FORMULARIO DE EDICIÓN (Editar Usuario)
    fieldsets = UserAdmin.fieldsets + (
        ('Información Extra', {'fields': ('role', 'dni', 'is_email_verified')}),
    )

    inlines = [UserDocumentInline]

    # Ocultar documentos al crear para evitar errores de ID
    def get_inlines(self, request, obj=None):
        if not obj:
            return []
        return self.inlines

admin.site.register(User, CustomUserAdmin)