from django.shortcuts import render, get_object_or_404, redirect
from django.http import HttpResponse
from django.template.loader import get_template
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from xhtml2pdf import pisa
from .models import SubjectEnrollment, CareerEnrollment
from apps.exams.models import ExamEnrollment
from django.contrib import messages
from apps.academic.models import Subject

@login_required
def dashboard(request):
    """
    Pantalla principal después del login.
    Muestra opciones según si es Alumno o Docente.
    """
    return render(request, 'dashboard.html', {
        'user': request.user
    })

@login_required
def download_report_card(request):
    """
    Genera un PDF con la Libreta Digital del alumno logueado.
    """
    student = request.user
    
    # 1. Recuperar Cursadas (Materias Regulares/Libres)
    cursadas = SubjectEnrollment.objects.filter(
        student=student
    ).select_related('subject', 'subject__career').order_by('subject__year_level', 'subject__name')
    
    # 2. Recuperar Finales Rendidos
    finales = ExamEnrollment.objects.filter(
        student=student,
        grade__isnull=False # Solo los que tienen nota
    ).select_related('exam_session', 'exam_session__subject').order_by('-exam_session__date')

    # 3. Contexto para el template
    context = {
        'student': student,
        'cursadas': cursadas,
        'finales': finales,
        'fecha_emision': timezone.now()
    }

    # 4. Renderizar PDF
    template_path = 'report_card.html'
    response = HttpResponse(content_type='application/pdf')
    # Esto hace que se descargue con nombre bonito:
    filename = f"Libreta_{student.dni}.pdf"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    template = get_template(template_path)
    html = template.render(context)

    # Crear PDF
    pisa_status = pisa.CreatePDF(html, dest=response)

    if pisa_status.err:
        return HttpResponse('Tuvimos algunos errores <pre>' + html + '</pre>')
    
    return response

@login_required
def student_enrollment_view(request):
    """
    Permite al alumno inscribirse a las materias de su carrera.
    """
    user = request.user

    # 1. Obtenemos la inscripción a la carrera del alumno
    # Si no tiene carrera, lo mandamos al home o mostramos error
    try:
        career_enrollment = CareerEnrollment.objects.get(student=user, is_active=True)
    except CareerEnrollment.DoesNotExist:
        messages.error(request, "No tienes una carrera activa asignada. Contacta a administración.")
        return redirect('academic:student_dashboard')

    # 2. Obtenemos las materias de ESA carrera
    career_subjects = Subject.objects.filter(career=career_enrollment.career).order_by('year_level', 'name')

    # 3. Obtenemos las materias donde YA está inscripto (para deshabilitarlas en el HTML)
    existing_enrollments_ids = SubjectEnrollment.objects.filter(
        student=user, 
        status='CURSANDO' # O las que quieras filtrar
    ).values_list('subject_id', flat=True)

    if request.method == 'POST':
        # Obtenemos la lista de IDs de materias seleccionadas
        selected_subjects_ids = request.POST.getlist('subjects')
        
        if not selected_subjects_ids:
            messages.warning(request, "Debes seleccionar al menos una materia.")
        else:
            count = 0
            for sub_id in selected_subjects_ids:
                # Evitamos duplicados por seguridad
                if int(sub_id) not in existing_enrollments_ids:
                    SubjectEnrollment.objects.create(
                        student=user,
                        subject_id=sub_id,
                        career_enrollment=career_enrollment,
                        condition='REGULAR', # Por defecto arranca Regular
                        status='CURSANDO'
                    )
                    count += 1
            
            messages.success(request, f"Te has inscripto correctamente a {count} materias.")
            return redirect('academic:student_dashboard')

    context = {
        'career': career_enrollment.career,
        'subjects': career_subjects,
        'existing_ids': existing_enrollments_ids
    }
    return render(request, 'enrollments/student_enrollment_form.html', context)