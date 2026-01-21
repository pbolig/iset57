from django import forms
from .models import ExamSession
from apps.academic.models import Career
from apps.enrollments.models import Subject
        
class ExamSessionForm(forms.ModelForm):
    # Campo "Carrera" auxiliar (no se guarda en ExamSession, es solo para filtrar)
    career = forms.ModelChoiceField(
        queryset=Career.objects.filter(is_active=True),
        label="1. Seleccionar Carrera",
        empty_label="-- Seleccione Carrera --",
        required=False,
        widget=forms.Select(attrs={'class': 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500'})
    )

    class Meta:
        model = ExamSession
        fields = ['subject', 'date', 'inscription_deadline_days', 'state', 'examiners']
        
        widgets = {
            'subject': forms.Select(attrs={'class': 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500'}),
            # Input nativo de HTML5 para fecha y hora
            'date': forms.DateTimeInput(attrs={'type': 'datetime-local', 'class': 'w-full px-4 py-2 border border-gray-300 rounded-lg'}),
            'inscription_deadline_days': forms.NumberInput(attrs={'class': 'w-full px-4 py-2 border border-gray-300 rounded-lg'}),
            'state': forms.Select(attrs={'class': 'w-full px-4 py-2 border border-gray-300 rounded-lg'}),
            'examiners': forms.SelectMultiple(attrs={'class': 'w-full px-4 py-2 border border-gray-300 rounded-lg h-32'}),
        }
        labels = {
            'subject': 'Materia',
            'date': 'Fecha y Hora del Examen',
            'inscription_deadline_days': 'Días de cierre anticipado',
            'state': 'Estado Inicial',
            'examiners': 'Tribunal Docente (Opcional)',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # 1. Por defecto, la lista de materias está VACÍA (para obligar a elegir carrera)
        self.fields['subject'].queryset = Subject.objects.none()

        # 2. Si el usuario envió el formulario (POST), cargamos las materias de esa carrera
        # para que la validación no falle.
        if 'career' in self.data:
            try:
                career_id = int(self.data.get('career'))
                self.fields['subject'].queryset = Subject.objects.filter(career_id=career_id).order_by('year_level', 'name')
            except (ValueError, TypeError):
                pass  
        
        # 3. Si estamos EDITANDO una mesa existente, cargamos la carrera y sus materias
        elif self.instance.pk:
            self.fields['career'].initial = self.instance.subject.career
            self.fields['subject'].queryset = Subject.objects.filter(career=self.instance.subject.career).order_by('year_level', 'name')