from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import CareerEnrollment, SubjectEnrollment

@receiver(post_save, sender=CareerEnrollment)
def auto_enroll_first_year(sender, instance, created, **kwargs):
    """
    Cuando se crea una inscripción a carrera, inscribir automáticamente
    al alumno a todas las materias de 1er año de esa carrera.
    """
    if created:
        print(f"--> Detectada nueva inscripción de {instance.student} a {instance.career}")
        
        # 1. Buscar todas las materias de 1er año de esa carrera
        first_year_subjects = instance.career.subjects.filter(year_level=1)
        
        created_count = 0
        for subject in first_year_subjects:
            # 2. Crear la cursada (SubjectEnrollment)
            # Usamos get_or_create por seguridad para no duplicar si ya existe
            obj, created_sub = SubjectEnrollment.objects.get_or_create(
                student=instance.student,
                subject=subject,
                defaults={
                    'career_enrollment': instance,
                    'condition': 'REGULAR', # Por defecto Regular (tu requisito)
                    'condition_locked': False # El alumno podrá cambiarlo 1 vez
                }
            )
            if created_sub:
                created_count += 1
        
        print(f"--> Se inscribió automáticamente a {created_count} materias de 1er año.")