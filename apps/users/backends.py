# apps/users/backends.py
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()

class EmailOrUsernameModelBackend(ModelBackend):
    """
    Permite autenticar usuarios usando su correo electrónico O su nombre de usuario.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        # 1. Intentamos buscar el usuario por email O por username
        try:
            # Buscamos alguien que tenga ese email O ese username
            user = User.objects.get(Q(username__iexact=username) | Q(email__iexact=username))
        except User.DoesNotExist:
            return None
        except User.MultipleObjectsReturned:
            # Si por error hay varios (no debería pasar), tomamos el primero
            user = User.objects.filter(Q(username__iexact=username) | Q(email__iexact=username)).order_by('id').first()

        # 2. Si existe y la contraseña es correcta, y puede autenticarse
        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None