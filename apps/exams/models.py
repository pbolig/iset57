from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from django.core.exceptions import ValidationError

# Importamos Subject y Career de Academic
from apps.academic.models import Subject, Career

class ExamSession(models.Model):
    """
    Representa una MESA DE EXAMEN (Turno de examen).
    """
    
    class State(models.TextChoices):
        OPEN = 'OPEN', 'Abierta (Inscripciones)'
        CLOSED_INSCRIPTION = 'CLOSED_INSCRIPTION', 'Inscripción Cerrada'
        IN_EVALUATION = 'IN_EVALUATION', 'En Evaluación'
        GRADING = 'GRADING', 'Cargando Notas'
        FINALIZED = 'FINALIZED', 'Acta Cerrada'

    subject = models.ForeignKey(
        Subject, 
        on_delete=models.CASCADE,
        verbose_name="Materia"
    )
    date = models.DateTimeField(verbose_name="Fecha y Hora del Examen")
    
    inscription_deadline_days = models.PositiveIntegerField(
        default=2, # Sugerencia: 48hs antes suele ser lo estándar, pero 10 está bien si es tu regla.
        verbose_name="Días de cierre antes del examen"
    )
    
    state = models.CharField(
        max_length=20, 
        choices=State.choices, 
        default=State.OPEN,
        verbose_name="Estado de la Mesa"
    )
    
    examiners = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        limit_choices_to={'role__in': ['TEACHER', 'CAREER_HEAD', 'ADMIN']},
        verbose_name="Tribunal Docente"
    )
    
    class Meta:
        verbose_name = "Mesa de Examen"
        verbose_name_plural = "Mesas de Examen"
        ordering = ['date']

    def __str__(self):
        return f"{self.subject} - {self.date.strftime('%d/%m/%Y %H:%M')}"

    @property
    def inscription_deadline(self):
        """Devuelve la FECHA LÍMITE exacta para inscribirse."""
        return self.date - timedelta(days=self.inscription_deadline_days)

    def check_auto_close(self):
        """Cierra la inscripción automáticamente si pasó la fecha."""
        if self.state == self.State.OPEN:
            if timezone.now() >= self.inscription_deadline:
                self.state = self.State.CLOSED_INSCRIPTION
                self.save()
                return True
        return False


class ExamEnrollment(models.Model):
    """
    Inscripción de un alumno a una Mesa (Acta Volante).
    """
    exam_session = models.ForeignKey(
        ExamSession, 
        on_delete=models.CASCADE,
        related_name='enrollments',
        verbose_name="Mesa de Examen"
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='exam_enrollments',
        verbose_name="Estudiante"
    )
    
    modality = models.CharField(
        max_length=20, 
        choices=[('REGULAR', 'Regular'), ('LIBRE', 'Libre')],
        default='REGULAR',
        verbose_name="Modalidad"
    )
    
    date_enrolled = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Inscripción")

    # Resultados del examen
    is_confirmed_by_teacher = models.BooleanField(
        default=False, 
        verbose_name="Confirmado"
    )
    
    grade = models.DecimalField(
        max_digits=4, 
        decimal_places=2, 
        null=True, 
        blank=True,
        verbose_name="Nota Final"
    )
    
    absent = models.BooleanField(default=False, verbose_name="Ausente")

    class Meta:
        verbose_name = "Inscripción a Examen"
        verbose_name_plural = "Inscripciones a Exámenes"
        unique_together = ('exam_session', 'student') # Un alumno solo se anota 1 vez por mesa

    def __str__(self):
        return f"{self.student} -> {self.exam_session.subject}"

    def clean(self):
        """Validaciones de Negocio"""
        
        # 1. Validar Carrera: El alumno debe tener inscripción activa en la carrera de la materia
        career_of_subject = self.exam_session.subject.career
        
        # Usamos related_name='enrollments' definido en CareerEnrollment
        has_enrollment = career_of_subject.enrollments.filter(
            student=self.student,
            is_active=True
        ).exists()

        if not has_enrollment:
            raise ValidationError(
                f"El estudiante no pertenece a la carrera '{career_of_subject.name}'."
            )

        # 2. Validar Fecha Límite (Solo si es una inscripción nueva)
        if not self.pk: 
            deadline = self.exam_session.inscription_deadline
            if timezone.now() > deadline:
                raise ValidationError(
                    f"La inscripción cerró el {deadline.strftime('%d/%m/%Y a las %H:%M')}."
                )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)