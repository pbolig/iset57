from django.shortcuts import redirect
from django.contrib import messages

def admin_required(view_func):
    """
    Decorador para asegurar que el usuario sea ADMINISTRATIVO.
    Si es alumno o no está logueado, lo patea fuera.
    """
    def wrapper_func(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('login')
        
        # Verificamos si el rol es ADMIN (o si es superusuario de Django)
        if request.user.role == 'ADMIN' or request.user.is_superuser:
            return view_func(request, *args, **kwargs)
        else:
            messages.error(request, "No tienes permisos para acceder a esa zona.")
            return redirect('login') # O a donde quieras mandarlos
            
    return wrapper_func