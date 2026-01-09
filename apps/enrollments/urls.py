from django.urls import path
from .views import download_report_card, dashboard

urlpatterns = [
    path('dashboard/', dashboard, name='dashboard'),
]