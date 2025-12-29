from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from .models import ExamSession

def close_exam_act(exam_session):
    """
    Lógica para cerrar el acta de examen:
    1. Valida que todos tengan nota.
    2. Cambia estado a FINALIZED.
    3. Envía correos masivos.
    """
    
    # 1. Validaciones
    enrollments = exam_session.enrollments.all()
    
    # Verificar si hay alumnos sin nota (y que no estén ausentes)
    pending_grades = enrollments.filter(grade__isnull=True, absent=False).exists()
    
    if pending_grades:
        return False, "No se puede cerrar el acta: Hay alumnos sin nota cargada."

    if exam_session.state == ExamSession.State.FINALIZED:
        return False, "El acta ya estaba cerrada."

    # 2. Cambiar Estado
    exam_session.state = ExamSession.State.FINALIZED
    exam_session.save()

    # 3. Enviar correos (Simulación)
    print(f"\n--- INICIANDO PROCESO DE NOTIFICACIÓN PARA: {exam_session} ---")
    
    # A) Notificar a Estudiantes
    for enrollment in enrollments:
        if enrollment.absent:
            estado_nota = "Ausente"
        else:
            estado_nota = f"Calificación: {enrollment.grade}"

        student_email = enrollment.student.email
        subject = f"Nota Examen: {exam_session.subject.name}"
        message = (
            f"Hola {enrollment.student.first_name},\n\n"
            f"El acta de examen de '{exam_session.subject.name}' ha sido cerrada.\n"
            f"Fecha: {exam_session.date.strftime('%d/%m/%Y')}\n"
            f"Resultado: {estado_nota}\n\n"
            f"Saludos,\nSecretaría Académica."
        )
        
        # Enviamos el mail (en Dev saldrá por consola)
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [student_email],
            fail_silently=False,
        )

    # B) Notificar a Administración (Resumen)
    total_presentes = enrollments.filter(absent=False).count()
    admin_message = (
        f"Se ha cerrado el acta de examen ID #{exam_session.id}.\n"
        f"Materia: {exam_session.subject.name}\n"
        f"Total Evaluados: {total_presentes}\n"
        f"Ausentes: {enrollments.filter(absent=True).count()}\n"
    )
    send_mail(
        f"ALERTA: Acta Cerrada - {exam_session.subject.name}",
        admin_message,
        settings.DEFAULT_FROM_EMAIL,
        ['admin@instituto.edu.ar'], # Email fijo de la administración
    )
    
    return True, "Acta cerrada correctamente y notificaciones enviadas."