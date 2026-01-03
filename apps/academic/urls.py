from django.urls import path
from . import views

app_name = 'academic' # Esto es importante para usar {% url 'academic:dashboard' %}

urlpatterns = [
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('aprobar/<int:user_id>/', views.approve_student, name='approve_student'),
    path('rechazar/<int:user_id>/', views.reject_student, name='reject_student'),
]