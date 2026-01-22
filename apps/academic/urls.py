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
    path('docentes/asignar/', views.TeacherAssignmentView.as_view(), name='assign_teacher'),
    path('docente/dashboard/', views.teacher_dashboard_view, name='teacher_dashboard'),
    
    # --- CRUD CARRERAS ---
    path('carreras/', views.CareerListView.as_view(), name='career_list'),
    path('carreras/crear/', views.CareerCreateView.as_view(), name='career_create'),
    path('carreras/editar/<int:pk>/', views.CareerUpdateView.as_view(), name='career_update'),
    path('carreras/borrar/<int:pk>/', views.CareerDeleteView.as_view(), name='career_delete'),
]