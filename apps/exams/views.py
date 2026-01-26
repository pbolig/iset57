# apps/exams/views.py
from django.views.generic.edit import CreateView
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.urls import reverse_lazy
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.http import JsonResponse

# Modelos
from .models import ExamSession, ExamEnrollment
from apps.enrollments.models import Subject, CareerEnrollment
# Formularios
from .forms import ExamSessionForm

# ========================================================
#  VISTAS PARA EL ALUMNO
# ========================================================

@login_required
def student_exam_list(request):
    """
    Muestra las mesas de examen disponibles EXCLUSIVAMENTE para la carrera del alumno.
    """
    student = request.user

    # 1. Seguridad: Verificar que el alumno tenga una carrera activa
    try:
        my_career_enrollment = CareerEnrollment.objects.get(student=student, is_active=True)
    except CareerEnrollment.DoesNotExist:
        messages.error(request, "No tienes una carrera activa asignada. No puedes ver mesas de examen.")
        return redirect('academic:student_dashboard')

    now = timezone.now()

    # 2. Buscamos mesas ABIERTAS, FUTURAS y DE SU CARRERA
    available_exams = ExamSession.objects.filter(
        subject__career=my_career_enrollment.career, # <--- FILTRO CLAVE
        state=ExamSession.State.OPEN,
        date__gt=now
    ).select_related('subject', 'subject__career').order_by('date')

    # 3. Obtenemos los IDs de las mesas donde YA está inscrito (para bloquear el botón)
    enrolled_exam_ids = ExamEnrollment.objects.filter(
        student=student
    ).values_list('exam_session_id', flat=True)

    now = timezone.now()

    context = {
        'exams': available_exams,
        'enrolled_exam_ids': enrolled_exam_ids,
        'career': my_career_enrollment.career,
        'now': now
    }
    
    return render(request, 'exams/student_exam_list.html', context)


@login_required
def exam_inscription(request, exam_id):
    """
    Procesa la inscripción a una mesa específica.
    """
    if request.method == 'POST':
        exam_session = get_object_or_404(ExamSession, pk=exam_id)
        student = request.user

        # A. Verificamos si ya existe (Doble seguridad)
        if ExamEnrollment.objects.filter(exam_session=exam_session, student=student).exists():
            messages.warning(request, f'Ya estás inscrito en {exam_session.subject.name}.')
            return redirect('exams:student_exam_list')

        # B. Creamos la instancia de inscripción
        enrollment = ExamEnrollment(
            exam_session=exam_session,
            student=student,
            modality='REGULAR' # Por defecto Regular. (Futura mejora: detectar si quedó Libre en la cursada)
        )

        try:
            # C. VALIDACIÓN FUERTE
            # Esto dispara el método clean() del modelo (chequea fechas, carrera, etc)
            enrollment.full_clean() 
            enrollment.save()
            
            messages.success(request, f'✅ ¡Inscripción exitosa a {exam_session.subject.name}!')
            
        except ValidationError as e:
            # Capturamos errores de negocio (Ej: "Ya cerró la fecha", "No es tu carrera")
            # e.messages devuelve la lista de errores limpios
            for error in e.messages:
                messages.error(request, f"No pudimos inscribirte: {error}")
                
        except Exception as e:
            messages.error(request, 'Ocurrió un error inesperado al procesar la solicitud.')

    return redirect('exams:student_exam_list')


# ========================================================
#  VISTAS PARA ADMINISTRADORES / DOCENTES
# ========================================================

class ExamCreateView(LoginRequiredMixin, UserPassesTestMixin, CreateView):
    """
    Vista para que el Admin cree una nueva Mesa de Examen.
    """
    model = ExamSession
    form_class = ExamSessionForm
    template_name = 'exams/exam_form.html'
    success_url = reverse_lazy('academic:dashboard') 

    def test_func(self):
        # Solo permite acceso si es SUPERUSER, ADMIN o COORDINADOR
        user = self.request.user
        return user.is_superuser or user.role in ['ADMIN', 'CAREER_HEAD']

    def form_valid(self, form):
        messages.success(self.request, f"Mesa de examen para '{form.instance.subject}' creada correctamente.")
        return super().form_valid(form)


def load_subjects(request):
    """
    Vista AJAX para devolver materias filtradas por carrera en el formulario de creación.
    """
    career_id = request.GET.get('career_id')
    subjects = Subject.objects.none()
    
    if career_id:
        subjects = Subject.objects.filter(career_id=career_id).order_by('year_level', 'name')
    
    # Retornamos JSON para que JavaScript llene el select
    data = [{'id': s.id, 'name': f"{s.year_level}° - {s.name}"} for s in subjects]
    
    return JsonResponse(data, safe=False)