# Archivo: apps/academic/admin.py
from django.contrib import admin
from .models import Career, Subject

class SubjectInline(admin.TabularInline):
    """Permite cargar materias directamente dentro de la pantalla de Carrera"""
    model = Subject
    extra = 1

@admin.register(Career)
class CareerAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_name', 'is_active')
    inlines = [SubjectInline]

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'career', 'year_level')
    list_filter = ('career', 'year_level')
    search_fields = ['name']