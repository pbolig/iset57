from django.db import models
from django.conf import settings
from apps.academic.models import Career, Subject

class CareerEnrollment(models.Model):
    """Inscripción de un alumno a una Carrera"""
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='career_enrollments',
        verbose_name="Estudiante"
    )
    career = models.ForeignKey(
        Career, 
        on_delete=models.CASCADE, 
        related_name='enrollments',
        verbose_name="Carrera"
    )
    date_joined = models.DateField(auto_now_add=True, verbose_name="Fecha de Inscripción")
    is_active = models.BooleanField(default=True, verbose_name="Activa")

    class Meta:
        verbose_name = "Inscripción a Carrera"
        verbose_name_plural = "Inscripciones a Carreras"
        unique_together = ('student', 'career') # Un alumno no se puede inscribir 2 veces a la misma

    def __str__(self):
        return f"{self.student} -> {self.career}"


class SubjectEnrollment(models.Model):
    """
    La 'Cursada' de una materia.
    Define cómo la está cursando el alumno (Regular, Libre, etc.)
    """
    CONDITION_CHOICES = [
        ('REGULAR', 'Regular'),
        ('LIBRE', 'Libre'),
        ('SEMI', 'Semi-Presencial'),
    ]

    STATUS_CHOICES = [
        ('CURSANDO', 'Cursando'),
        ('REGULARIZADA', 'Regularizada (Aprobó cursada)'),
        ('APROBADA', 'Aprobada (Final rendido)'),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='subject_enrollments'
    )
    subject = models.ForeignKey(
        Subject, 
        on_delete=models.CASCADE, 
        related_name='enrollments',
        verbose_name="Materia"
    )
    # Vinculamos con la inscripción de carrera padre
    career_enrollment = models.ForeignKey(
        CareerEnrollment,
        on_delete=models.CASCADE,
        related_name='subject_enrollments'
    )
    
    condition = models.CharField(
        max_length=10, 
        choices=CONDITION_CHOICES, 
        default='REGULAR',
        verbose_name="Condición"
    )
    
    # Campo para bloquear la edición de condición por el alumno (req: "solo por única vez")
    condition_locked = models.BooleanField(default=False, verbose_name="Condición Bloqueada")
    
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='CURSANDO',
        verbose_name="Estado Académico"
    )

    class Meta:
        verbose_name = "Cursada / Materia"
        verbose_name_plural = "Cursadas"
        unique_together = ('student', 'subject')

    def __str__(self):
        return f"{self.student} - {self.subject} ({self.condition})"