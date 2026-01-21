from django.urls import path
from . import views

app_name = 'exams'

urlpatterns = [
    path('inscripciones/', views.exam_list, name='list'),
    path('inscribir/<int:exam_id>/', views.exam_inscription, name='enroll'),
    path('crear/', views.ExamCreateView.as_view(), name='create'),
    path('ajax/cargar-materias/', views.load_subjects, name='ajax_load_subjects'),
]