import os
import io
import base64
from .models import Career
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
from django.views.decorators.http import require_POST
from django.urls import reverse_lazy
from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponseRedirect
from .models import TeacherAssignment
from .forms import TeacherAssignmentForm

# LIBRERÍAS DE IMAGEN (Protección contra archivos rotos)
from PIL import Image, ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True 

User = get_user_model()

# --- VISTAS ADMIN ---
@admin_required  # O @login_required si aún no tienes el decorador listo
def dashboard_view(request):
    """
    Vista EXCLUSIVA para el Panel Administrativo.
    """
    user = request.user
    
    # Filtramos solo si es admin o superusuario
    if user.role == 'ADMIN' or user.is_superuser:
        
        # Lógica de datos administrativos
        pending_students = User.objects.filter(role='STUDENT', is_active=False).order_by('-date_joined')
        
        context = {
            'pending_students': pending_students
        }
        
        print("✅ CARGANDO PANEL ADMINISTRATIVO (academic/dashboard.html)")
        return render(request, 'academic/dashboard.html', context)
    
    else:
        # Si un alumno intenta entrar aquí, lo mandamos a su home
        return redirect('home')

@admin_required
@require_POST
def approve_student(request, user_id):
    student = get_object_or_404(User, pk=user_id)
    student.is_active = True
    student.save()
    
    # Mejora: El try/except solo debe envolver el envío de email, no el save()
    try:
        send_mail(
            'Bienvenido a ISET 57', 
            'Tu cuenta ha sido aprobada. Ya puedes iniciar sesión en el sistema.', 
            settings.DEFAULT_FROM_EMAIL, 
            [student.email],
            fail_silently=False
        )
        messages.success(request, f'Estudiante {student.last_name} aprobado y notificado.')
    except Exception as e:
        # El alumno se aprueba igual, pero avisamos que falló el correo
        print(f"Error enviando mail: {e}") 
        messages.warning(request, f'Estudiante aprobado, pero falló el envío del email ({e}).')
        
    return redirect('academic:dashboard')

@admin_required
@require_POST  # <--- IMPORTANTE: Evita borrados accidentales por URL
def reject_student(request, user_id):
    user = get_object_or_404(User, pk=user_id)
    email = user.email
    user.delete()
    messages.error(request, f'Solicitud de {email} rechazada y eliminada.')
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

@login_required
def home_redirect(request):
    """
    Esta vista actúa como un SEMÁFORO.
    Recibe al usuario y lo redirige a su panel correspondiente según su rol.
    """
    user = request.user
    
    if user.role == 'ADMIN' or user.is_superuser:
        print(f"🚦 Semáforo: Usuario {user.email} es ADMIN -> Redirigiendo a Panel Administrativo")
        return redirect('academic:dashboard') # Esta es la vista que arreglamos antes
        
    elif user.role == 'STUDENT':
        print(f"🚦 Semáforo: Usuario {user.email} es ALUMNO -> Redirigiendo a Panel Alumno")
        return redirect('academic:student_dashboard') # <--- OJO AQUÍ, crearemos esta url en el paso 2
        
    elif user.role == 'TEACHER':
        return redirect('academic:teacher_dashboard') # Futuro panel docente
        
    else:
        return redirect('academic:student_dashboard') # Por defecto

# --- Asegúrate de tener también la vista del estudiante ---
@login_required
def student_dashboard_view(request):
    # Aquí renderizamos el dashboard.html genérico (el que tiene las opciones de alumno)
    return render(request, 'dashboard.html', {'user': request.user})

class CareerListView(LoginRequiredMixin, ListView):
    model = Career
    template_name = 'academic/career_list.html'
    context_object_name = 'careers'

class CareerCreateView(LoginRequiredMixin, CreateView):
    model = Career
    template_name = 'academic/career_form.html'
    fields = ['name', 'short_name', 'description'] # Ajusta según tus campos en models.py
    success_url = reverse_lazy('academic:career_list')

class CareerUpdateView(LoginRequiredMixin, UpdateView):
    model = Career
    template_name = 'academic/career_form.html'
    fields = ['name', 'short_name', 'description']
    success_url = reverse_lazy('academic:career_list')

class CareerDeleteView(LoginRequiredMixin, DeleteView):
    model = Career
    template_name = 'academic/career_confirm_delete.html'
    success_url = reverse_lazy('academic:career_list')

    # Sobreescribimos el método que se ejecuta al confirmar
    def form_valid(self, form):
        # En lugar de borrar, desactivamos
        self.object.is_active = False
        self.object.save()
        
        # Opcional: Mensaje de éxito (si tienes mensajes configurados)
        # messages.success(self.request, "La carrera se ha desactivado correctamente.")
        
        return HttpResponseRedirect(self.success_url)
    
class TeacherAssignmentView(LoginRequiredMixin, CreateView):
    model = TeacherAssignment
    form_class = TeacherAssignmentForm
    template_name = 'academic/teacher_assignment_form.html'
    success_url = reverse_lazy('academic:dashboard')

    def form_valid(self, form):
        messages.success(self.request, f"Materia asignada correctamente al docente {form.instance.teacher.last_name}.")
        return super().form_valid(form)

@login_required
def teacher_dashboard_view(request):
    """
    Panel principal del DOCENTE.
    Muestra las materias que tiene asignadas.
    """
    # 1. Seguridad: Si no es docente, lo echamos al home general
    if request.user.role != 'TEACHER':
        return redirect('academic:home')

    # 2. Buscamos sus materias asignadas
    my_assignments = TeacherAssignment.objects.filter(
        teacher=request.user, 
        is_active=True
    ).select_related('subject', 'subject__career') # Optimizamos la consulta

    context = {
        'assignments': my_assignments
    }
    return render(request, 'academic/teacher_dashboard.html', context)