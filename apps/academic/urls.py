from django.urls import path
from . import views

app_name = 'academic' 

urlpatterns = [
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('aprobar/<int:user_id>/', views.approve_student, name='approve_student'),
    path('rechazar/<int:user_id>/', views.reject_student, name='reject_student'),

    # URL OFICIAL REPARADA
    path('libreta/descargar/', views.generar_pdf_final, name='download_report_card'),
]