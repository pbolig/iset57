from django.contrib import admin
from django.urls import path
from django.urls import path, include
from django.views.generic import RedirectView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('django.contrib.auth.urls')),
    path('accounts/', include('apps.users.urls')),
    path('academic/', include('apps.enrollments.urls')),
    
    # Redirigir la raíz al login
    path('', RedirectView.as_view(url='/accounts/login/', permanent=False)),
]
