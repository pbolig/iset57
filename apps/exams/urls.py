from django.urls import path
from . import views

app_name = 'exams'

urlpatterns = [
    # Cambiamos 'views.exam_list' por 'views.student_exam_list' para que coincida con tu views.py
    path('inscripciones/', views.student_exam_list, name='list'),
    path('inscribir/<int:exam_id>/', views.exam_inscription, name='enroll'),
    
    path('crear/', views.ExamCreateView.as_view(), name='create'),
    path('ajax/cargar-materias/', views.load_subjects, name='ajax_load_subjects'),
]