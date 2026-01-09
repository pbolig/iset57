import os
import io
import base64
from django.conf import settings
from django.shortcuts import render, get_object_or_404, redirect
from django.http import HttpResponse
from django.template.loader import get_template
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from xhtml2pdf import pisa
from apps.users.decorators import admin_required
from apps.enrollments.models import SubjectEnrollment 
from apps.exams.models import ExamEnrollment

# LIBRERÍAS DE IMAGEN (Protección contra archivos rotos)
from PIL import Image, ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True 

User = get_user_model()

# --- VISTAS ADMIN ---
@admin_required
def dashboard_view(request):
    pending_students = User.objects.filter(role=User.Role.STUDENT, is_active=False).order_by('-date_joined')
    return render(request, 'academic/dashboard.html', {'pending_students': pending_students})

@admin_required
def approve_student(request, user_id):
    student = get_object_or_404(User, pk=user_id)
    student.is_active = True
    student.save()
    try:
        send_mail('Bienvenido', 'Tu cuenta ha sido aprobada.', settings.DEFAULT_FROM_EMAIL, [student.email])
        messages.success(request, f'Estudiante {student.email} aprobado.')
    except:
        messages.warning(request, 'Aprobado sin email.')
    return redirect('academic:dashboard')

@admin_required
def reject_student(request, user_id):
    get_object_or_404(User, pk=user_id).delete()
    return redirect('academic:dashboard')

# --- VISTAS ALUMNO ---
@login_required
def dashboard_student(request):
    return render(request, 'dashboard.html', {'user': request.user})

@login_required
def generar_pdf_final(request):
    """
    Versión FINAL: Convierte cualquier imagen a JPG para compatibilidad total con PDF.
    """
    print(f"\n✅ GENERANDO PDF CON CONVERSIÓN A JPG (RGB) ✅\n")

    student = request.user
    
    # 1. ICONO POR DEFECTO (JPG SEGURO - Fondo Blanco, Silueta Gris)
    # Este código Base64 es un icono de usuario genérico pero en formato JPG (sin transparencia)
    DEFAULT_ICON_JPG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAFAAUADAREAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9k="
    
    final_image_data = DEFAULT_ICON_JPG

    # 2. INTENTAR LEER FOTO REAL Y CONVERTIRLA A JPG
    if student.profile_picture:
        try:
            file_path = os.path.join(settings.MEDIA_ROOT, student.profile_picture.name)
            
            if os.path.exists(file_path):
                # Abrimos la imagen con Pillow
                with Image.open(file_path) as img:
                    
                    # --- EL TRUCO MÁGICO: Convertir a RGB (quita transparencia) ---
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    # Guardamos la imagen convertida en memoria como JPEG
                    buffer = io.BytesIO()
                    img.save(buffer, format="JPEG")
                    
                    # Codificamos a Base64
                    encoded_string = base64.b64encode(buffer.getvalue()).decode('utf-8')
                    final_image_data = f"data:image/jpeg;base64,{encoded_string}"
                    print(f"✅ FOTO REAL CONVERTIDA A JPG: {file_path}")
            else:
                print(f"❌ FOTO NO ENCONTRADA: {file_path}")

        except Exception as e:
            print(f"⚠️ ERROR PROCESANDO IMAGEN (Usando default): {e}")
            # Si falla, se queda con el DEFAULT_ICON_JPG

    # 3. CONTEXTO
    context = {
        'student': student,
        'foto_base64': final_image_data, 
        'cursadas': SubjectEnrollment.objects.filter(student=student).select_related('subject', 'subject__career').order_by('subject__year_level', 'subject__name'),
        'finales': ExamEnrollment.objects.filter(student=student, grade__isnull=False).select_related('exam_session', 'exam_session__subject').order_by('-exam_session__date'),
        'fecha_emision': timezone.now(),
    }

    # 4. RENDERIZADO
    template_path = 'libreta_final.html'
    response = HttpResponse(content_type='application/pdf')
    filename = f"Libreta_{student.dni}.pdf"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    template = get_template(template_path)
    html = template.render(context)
    
    pisa_status = pisa.CreatePDF(html, dest=response)

    if pisa_status.err:
        return HttpResponse('Error generando PDF')
    
    return response