from django import forms
from .models import ExamSession

class ExamSessionForm(forms.ModelForm):
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