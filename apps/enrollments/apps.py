from django.apps import AppConfig


class EnrollmentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.enrollments' # <--- No olvides el 'apps.'

    def ready(self):
        # Esto es vital para que funcione la automatización (Signals)
        import apps.enrollments.signals