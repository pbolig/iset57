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

# 4. Formulario para que el ALUMNO edite su propio perfil (Sin claves ni roles)
class UserProfileForm(forms.ModelForm):
    class Meta:
        model = User
        # Permitimos editar solo datos personales y la foto.
        # NO incluimos 'dni' ni 'username' para evitar problemas administrativos.
        fields = ['first_name', 'last_name', 'email', 'profile_picture']
        
        # Estilos CSS (Tailwind) para que se vea bonito
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500'}),
            'last_name': forms.TextInput(attrs={'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500'}),
            'email': forms.EmailInput(attrs={'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500'}),
            'profile_picture': forms.FileInput(attrs={'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'}),
        }
        labels = {
            'first_name': 'Nombre',
            'last_name': 'Apellido',
            'email': 'Correo Electrónico',
            'profile_picture': 'Foto de Perfil',
        }