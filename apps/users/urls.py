from django.urls import path
from .views import register, activate
from . import views

urlpatterns = [
    path('registro/', register, name='register'),
    path('activar/<uidb64>/<token>/', activate, name='activate'),
    path('perfil/editar/', views.edit_profile, name='edit_profile'),
]