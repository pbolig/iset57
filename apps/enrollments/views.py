from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse
from django.template.loader import get_template
from django.contrib.auth.decorators import login_required
from xhtml2pdf import pisa
from .models import SubjectEnrollment
from apps.exams.models import ExamEnrollment

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

# Necesitamos importar timezone aquí, agregalo al inicio si falta
from django.utils import timezone