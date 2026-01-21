from django import forms
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import User
from apps.academic.models import Career
# Importamos el modelo de inscripción para vincular al alumno
from apps.enrollments.models import CareerEnrollment 

# 1. Formulario para CREAR usuarios (Admin)
class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ('username', 'email', 'dni', 'first_name', 'last_name', 'role')


# 2. Formulario para EDITAR usuarios (Admin)
class CustomUserChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = ('username', 'email', 'dni', 'first_name', 'last_name', 'role')


# 3. Formulario para Registro de Estudiantes (Público)
class StudentRegistrationForm(UserCreationForm):
    # Campo para elegir la carrera (Se mostrará como un desplegable bonito)
    career = forms.ModelChoiceField(
        queryset=Career.objects.filter(is_active=True),
        label="Carrera a cursar",
        empty_label="-- Selecciona tu carrera --",
        widget=forms.Select(attrs={'class': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500'})
    )

    class Meta:
        model = User
        # No incluimos 'role' ni 'career' en fields directos del modelo User
        fields = ('username', 'first_name', 'last_name', 'email', 'dni')
    
    def save(self, commit=True):
        # 1. Creamos la instancia del usuario pero no la guardamos en BD todavía
        user = super().save(commit=False)
        
        # 2. Asignamos datos forzados
        user.role = User.Role.STUDENT 
        user.is_active = False # El admin debe aprobarlo después
        
        if commit:
            # 3. Guardamos al usuario para que tenga un ID (pk)
            user.save()
            
            # 4. Ahora que el usuario existe, creamos la inscripción a la carrera
            selected_career = self.cleaned_data.get('career')
            
            if selected_career:
                CareerEnrollment.objects.create(
                    student=user,
                    career=selected_career,
                    # is_active=True viene por defecto en tu modelo, así que está bien
                )

        return user


# 4. Formulario para que el ALUMNO edite su propio perfil (Sin claves ni roles)
class UserProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'profile_picture']
        
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