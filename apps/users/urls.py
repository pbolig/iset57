from django.urls import path
from .views import register, activate

urlpatterns = [
    path('registro/', register, name='register'),
    path('activar/<uidb64>/<token>/', activate, name='activate'),
]