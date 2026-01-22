from django.urls import path
from .views import download_report_card, dashboard
from . import views

app_name = 'enrollments'

urlpatterns = [
    path('dashboard/', dashboard, name='dashboard'),
    path('inscripcion-materias/', views.student_enrollment_view, name='subject_enrollment'),
]