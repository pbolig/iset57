from django import forms
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import User

# 1. Formulario para CREAR usuarios (Admin)
class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        # Solo listamos tus campos personalizados + username/email.
        # UserCreationForm se encarga MÁGICAMENTE de agregar password_1 y password_2 al final.
        fields = ('username', 'email', 'dni', 'first_name', 'last_name', 'role')

    # No hace falta reescribir save() ni clean_password_2(), Django ya lo hace por ti.


# 2. Formulario para EDITAR usuarios (Admin)
class CustomUserChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = ('username', 'email', 'dni', 'first_name', 'last_name', 'role')


# 3. Formulario para Registro de Estudiantes (Público)
class StudentRegistrationForm(UserCreationForm):
    class Meta:
        model = User
        # Aquí NO ponemos 'role' para que el estudiante no pueda elegirse como Admin
        fields = ('username', 'first_name', 'last_name', 'email', 'dni')
    
    def save(self, commit=True):
        user = super().save(commit=False)
        
        # CORRECCIÓN IMPORTANTE:
        # Usamos la constante del modelo en lugar de escribir 'student' a mano.
        # En tu modelo definiste: STUDENT = "STUDENT" (Mayúsculas probables)
        user.role = User.Role.STUDENT 
        
        if commit:
            user.save()
        return user