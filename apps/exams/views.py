from django.views.generic.edit import CreateView
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.core.exceptions import ValidationError
from .models import ExamSession, ExamEnrollment
from .forms import ExamSessionForm
from django.urls import reverse_lazy
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from apps.enrollments.models import Subject
from django.http import JsonResponse

@login_required
def exam_list(request):
    """
    Muestra las mesas de examen disponibles y el estado de inscripción del alumno.
    """
    now = timezone.now()
    student = request.user

    # 1. Buscamos mesas ABIERTAS y FUTURAS
    # Excluimos las que ya pasaron o cerraron inscripción
    exams = ExamSession.objects.filter(
        state=ExamSession.State.OPEN,
        date__gt=now
    ).select_related('subject', 'subject__career').order_by('date')

    # 2. Obtenemos los IDs de las mesas donde el alumno YA está inscrito
    enrolled_exam_ids = ExamEnrollment.objects.filter(
        student=student
    ).values_list('exam_session_id', flat=True)

    context = {
        'exams': exams,
        'enrolled_exam_ids': enrolled_exam_ids,
        'now': now
    }
    return render(request, 'exams/exam_list.html', context)

@login_required
def exam_inscription(request, exam_id):
    """
    Procesa la inscripción a una mesa específica.
    """
    if request.method == 'POST':
        exam_session = get_object_or_404(ExamSession, pk=exam_id)
        student = request.user

        # Verificamos si ya existe (aunque lo filtramos en la vista, es doble seguridad)
        if ExamEnrollment.objects.filter(exam_session=exam_session, student=student).exists():
            messages.warning(request, f'Ya estás inscrito en {exam_session.subject.name}.')
            return redirect('exams:list')

        # Creamos la inscripción
        enrollment = ExamEnrollment(
            exam_session=exam_session,
            student=student,
            modality='REGULAR' # Por defecto Regular, luego el sistema podría validar si es Libre
        )

        try:
            # Esto dispara el método clean() que definiste en el modelo
            enrollment.full_clean() 
            enrollment.save()
            messages.success(request, f'¡Inscripción exitosa a {exam_session.subject.name}!')
        except ValidationError as e:
            # Capturamos los errores de tu validación (fechas, carrera, etc)
            # e.messages es una lista de errores
            for error in e.messages:
                messages.error(request, error)
        except Exception as e:
            messages.error(request, 'Ocurrió un error inesperado al inscribirse.')

    return redirect('exams:list')

# --- VISTA PARA ADMINISTRADORES ---
class ExamCreateView(LoginRequiredMixin, UserPassesTestMixin, CreateView):
    model = ExamSession
    form_class = ExamSessionForm
    template_name = 'exams/exam_form.html'
    success_url = reverse_lazy('academic:dashboard') # Al terminar, vuelve al dashboard

    def test_func(self):
        # Solo permite acceso si es SUPERUSER o tiene rol ADMIN
        user = self.request.user
        return user.is_superuser or user.role == 'ADMIN'

    def form_valid(self, form):
        messages.success(self.request, f"Mesa de examen para '{form.instance.subject}' creada correctamente.")
        return super().form_valid(form)
    
def load_subjects(request):
    """
    Vista AJAX para devolver materias filtradas por carrera.
    """
    career_id = request.GET.get('career_id')
    subjects = Subject.objects.none()
    
    if career_id:
        subjects = Subject.objects.filter(career_id=career_id).order_by('year_level', 'name')
    
    # Creamos una lista de diccionarios con lo que necesita el select
    data = [{'id': s.id, 'name': f"{s.year_level}° - {s.name}"} for s in subjects]
    
    return JsonResponse(data, safe=False)