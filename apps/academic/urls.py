from django.urls import path
from . import views

app_name = 'academic' 

urlpatterns = [
    path('home/', views.home_redirect, name='home'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('approve/<int:user_id>/', views.approve_student, name='approve_student'),
    path('reject/<int:user_id>/', views.reject_student, name='reject_student'),
    path('libreta/descargar/', views.generar_pdf_final, name='download_report_card'),
    path('student-dashboard/', views.student_dashboard_view, name='student_dashboard'),
]