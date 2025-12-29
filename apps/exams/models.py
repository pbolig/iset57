from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from django.core.exceptions import ValidationError
from apps.academic.models import Subject

class ExamSession(models.Model):
    """
    Representa una MESA DE EXAMEN.
    El administrador carga la fecha y la materia.
    """
    
    # Estados de la mesa según tu requerimiento
    class State(models.TextChoices):
        OPEN = 'OPEN', 'Abierta (Inscripciones)'
        CLOSED_INSCRIPTION = 'CLOSED_INSCRIPTION', 'Inscripción Cerrada'
        IN_EVALUATION = 'IN_EVALUATION', 'En Evaluación (Docente confirma modalidades)'
        GRADING = 'GRADING', 'Evaluando (Carga de Notas)'
        FINALIZED = 'FINALIZED', 'Acta Cerrada'

    subject = models.ForeignKey(
        Subject, 
        on_delete=models.CASCADE,
        verbose_name="Materia"
    )
    date = models.DateTimeField(verbose_name="Fecha del Examen")
    
    # Configuramos los 10 días por defecto, pero editable por BD como pediste
    inscription_deadline_days = models.PositiveIntegerField(
        default=10, 
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
        limit_choices_to={'role__in': ['TEACHER', 'CAREER_HEAD']},
        verbose_name="Tribunal Docente"
    )

    class Meta:
        verbose_name = "Mesa de Examen"
        verbose_name_plural = "Mesas de Examen"
        ordering = ['-date']

    def __str__(self):
        return f"{self.subject} - {self.date.strftime('%d/%m/%Y %H:%M')}"

    @property
    def inscription_deadline(self):
        """Calcula la fecha límite exacta para inscribirse"""
        return self.date - timedelta(days=self.inscription_deadline_days)

    def check_auto_close(self):
        """Método para verificar si debe cerrarse automáticamente la inscripción"""
        if self.state == self.State.OPEN and timezone.now() >= self.inscription_deadline:
            self.state = self.State.CLOSED_INSCRIPTION
            self.save()
            return True
        return False


class ExamEnrollment(models.Model):
    """
    Inscripción de un alumno a una mesa específica.
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
        verbose_name="Modalidad Confirmada"
    )
    
    is_confirmed_by_teacher = models.BooleanField(
        default=False, 
        verbose_name="Confirmado por Docente"
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
        unique_together = ('exam_session', 'student')

    def __str__(self):
        return f"{self.student} - {self.exam_session}"

    # =================================================================
    #   ### NUEVO CÓDIGO DE VALIDACIÓN AQUÍ ###
    # =================================================================

    def clean(self):
        """Validaciones de negocio antes de guardar"""
        
        # 1. Validar que el alumno pertenezca a la carrera de la materia
        # Para esto, buscamos si existe una inscripción activa del alumno en esa carrera
        career_of_subject = self.exam_session.subject.career
        
        has_enrollment = career_of_subject.enrollments.filter(
            student=self.student,
            is_active=True
        ).exists()

        if not has_enrollment:
            raise ValidationError(
                f"El estudiante no está inscrito en la carrera '{career_of_subject.name}' y no puede rendir esta materia."
            )

        # 2. Validar fechas (Si intenta inscribirse tarde)
        # self.pk es None cuando se está creando. Si ya existe (editando nota), no validamos fecha.
        if not self.pk: 
            deadline = self.exam_session.inscription_deadline
            if timezone.now() > deadline:
                raise ValidationError(f"La inscripción a esta mesa cerró el {deadline.strftime('%d/%m/%Y')}.")
            
    def save(self, *args, **kwargs):
        # Ejecutamos las validaciones antes de guardar
        self.clean()
        super().save(*args, **kwargs)