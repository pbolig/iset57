from django.db import models
from django.conf import settings

class Career(models.Model):
    """Definición de las Carreras (ej: Tecnicatura en Sistemas)"""
    name = models.CharField(max_length=200, verbose_name="Nombre de la Carrera")
    short_name = models.CharField(max_length=50, verbose_name="Abreviatura")
    description = models.TextField(blank=True, verbose_name="Descripción")
    is_active = models.BooleanField(default=True, verbose_name="Activa")

    class Meta:
        verbose_name = "Carrera"
        verbose_name_plural = "Carreras"
        
    def __str__(self):
        return self.name

class Subject(models.Model):
    """Materias que pertenecen a una carrera"""
    
    # Definimos los años posibles (1, 2, 3)
    YEAR_CHOICES = [
        (1, '1er Año'),
        (2, '2do Año'),
        (3, '3er Año'),
    ]

    name = models.CharField(max_length=200, verbose_name="Nombre de la Materia")
    career = models.ForeignKey(
        Career, 
        on_delete=models.CASCADE, 
        related_name='subjects',
        verbose_name="Carrera"
    )
    year_level = models.IntegerField(
        choices=YEAR_CHOICES, 
        verbose_name="Año de Cursada"
    )
    
    # Opcional: Para controlar correlatividades en el futuro
    # prerequisites = models.ManyToManyField('self', blank=True, symmetrical=False)

    class Meta:
        verbose_name = "Materia"
        verbose_name_plural = "Materias"
        ordering = ['career', 'year_level', 'name']

    def __str__(self):
        return f"{self.name} ({self.get_year_level_display()} - {self.career.short_name})"
    
class TeacherAssignment(models.Model):
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='assignments',
        limit_choices_to={'role': 'TEACHER'}, 
        verbose_name="Docente"
    )
    subject = models.ForeignKey(
        Subject,  # Aquí usamos Subject directamente porque está definido arriba
        on_delete=models.CASCADE,
        related_name='teachers',
        verbose_name="Materia"
    )
    date_assigned = models.DateField(auto_now_add=True, verbose_name="Fecha de Asignación")
    is_active = models.BooleanField(default=True, verbose_name="Activo")

    class Meta:
        verbose_name = "Asignación Docente"
        verbose_name_plural = "Asignaciones Docentes"
        unique_together = ('teacher', 'subject')

    def __str__(self):
        return f"{self.teacher} -> {self.subject}"