from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from apps.users.decorators import admin_required

User = get_user_model()

@admin_required
def dashboard_view(request):
    """
    Muestra lista de estudiantes pendientes de aprobación.
    """
    # Filtramos: Que sean ESTUDIANTES y que NO estén activos
    pending_students = User.objects.filter(
        role=User.Role.STUDENT, 
        is_active=False
    ).order_by('-date_joined') # Los más recientes primero

    return render(request, 'academic/dashboard.html', {
        'pending_students': pending_students
    })

@admin_required
def approve_student(request, user_id):
    """
    Activa al estudiante y envía mail de bienvenida.
    """
    student = get_object_or_404(User, pk=user_id)
    
    student.is_active = True
    student.save()
    
    # Enviar mail de aviso
    try:
        subject = '¡Bienvenido al Instituto! Tu cuenta ha sido aprobada'
        message = f"""Hola {student.first_name},
        
Tu documentación ha sido revisada y aceptada.
Ya puedes iniciar sesión en el sistema para inscribirte a las materias.

Atte,
La Administración."""
        
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [student.email])
        messages.success(request, f'Estudiante {student.email} aprobado y notificado.')
    except Exception as e:
        messages.warning(request, f'Estudiante aprobado, pero falló el envío del mail: {e}')

    return redirect('academic:dashboard')

@admin_required
def reject_student(request, user_id):
    """
    Elimina la solicitud del estudiante (y sus archivos automáticamente).
    """
    student = get_object_or_404(User, pk=user_id)
    
    # Guardamos el email antes de borrarlo para el mensaje
    email_address = student.email
    
    # Al borrar el usuario, se disparan las señales que hicimos antes 
    # y borran la carpeta de documentos. ¡Magia! ✨
    student.delete()
    
    messages.error(request, f'Solicitud de {email_address} rechazada y eliminada.')
    return redirect('academic:dashboard')