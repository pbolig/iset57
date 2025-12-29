from django.contrib import admin
from .models import CareerEnrollment, SubjectEnrollment

class SubjectEnrollmentInline(admin.TabularInline):
    model = SubjectEnrollment
    extra = 0
    can_delete = False
    readonly_fields = ('subject', 'status') # Para que solo vean, no toquen mucho aquí

@admin.register(CareerEnrollment)
class CareerEnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'career', 'date_joined')
    list_filter = ('career', 'date_joined')
    inlines = [SubjectEnrollmentInline] # Ver materias cursadas dentro de la inscripción

@admin.register(SubjectEnrollment)
class SubjectEnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'subject', 'condition', 'status')
    list_filter = ('condition', 'status', 'subject__year_level')
    search_fields = ('student__dni', 'subject__name')