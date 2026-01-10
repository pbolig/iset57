from django.urls import path
from . import views

app_name = 'exams'

urlpatterns = [
    path('inscripciones/', views.exam_list, name='list'),
    path('inscribir/<int:exam_id>/', views.exam_inscription, name='enroll'),
]