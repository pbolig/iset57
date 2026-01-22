from django.contrib import admin
from .models import CareerEnrollment, SubjectEnrollment

class SubjectEnrollmentInline(admin.TabularInline):
    model = SubjectEnrollment
    extra = 0
    # can_delete = False  # Lo dejo comentado por si necesitas borrar pruebas manuales
    # readonly_fields = ('subject', 'status') # Lo comento para darte libertad de editar ahora en desarrollo

@admin.register(CareerEnrollment)
class CareerEnrollmentAdmin(admin.ModelAdmin):
    # Agregué 'is_active' para ver si está dada de baja o alta
    list_display = ('student', 'career', 'is_active', 'date_joined')
    
    # Filtros laterales
    list_filter = ('career', 'is_active', 'date_joined')
    
    # IMPORTANTE: Buscador para encontrar rápido a tu alumno por DNI o Apellido
    search_fields = ('student__last_name', 'student__first_name', 'student__dni', 'student__email')
    
    inlines = [SubjectEnrollmentInline]

@admin.register(SubjectEnrollment)
class SubjectEnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'subject', 'condition', 'status', 'final_grade')
    list_filter = ('condition', 'status', 'subject__year_level', 'subject__career')
    search_fields = ('student__dni', 'student__last_name', 'subject__name')