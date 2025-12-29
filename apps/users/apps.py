from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    # IMPORTANTE: Cambiamos 'users' por 'apps.users'
    name = 'apps.users'