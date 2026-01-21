from django import forms
from .models import TeacherAssignment, Career
from apps.users.models import User
from apps.enrollments.models import Subject

class TeacherAssignmentForm(forms.ModelForm):
    # Campo auxiliar para filtrar por Carrera
    career = forms.ModelChoiceField(
        queryset=Career.objects.filter(is_active=True),
        label="1. Filtrar por Carrera",
        empty_label="-- Seleccione Carrera --",
        required=False,
        widget=forms.Select(attrs={'class': 'w-full px-4 py-2 border border-gray-300 rounded-lg'})
    )
    
    teacher = forms.ModelChoiceField(
        queryset=User.objects.filter(role='TEACHER', is_active=True),
        label="Docente",
        empty_label="-- Seleccione Docente --",
        widget=forms.Select(attrs={'class': 'w-full px-4 py-2 border border-gray-300 rounded-lg'})
    )

    class Meta:
        model = TeacherAssignment
        fields = ['teacher', 'subject']
        widgets = {
            'subject': forms.Select(attrs={'class': 'w-full px-4 py-2 border border-gray-300 rounded-lg'}),
        }
        labels = {
            'subject': '2. Materia a Asignar'
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Inicialmente vacío hasta que elijan carrera
        self.fields['subject'].queryset = Subject.objects.none()

        # Si hay datos (POST) o carrera seleccionada, cargamos las materias
        if 'career' in self.data:
            try:
                career_id = int(self.data.get('career'))
                self.fields['subject'].queryset = Subject.objects.filter(career_id=career_id).order_by('year_level', 'name')
            except (ValueError, TypeError):
                pass