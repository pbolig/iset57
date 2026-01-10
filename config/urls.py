from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.conf import settings             # <--- NUEVO: Para acceder a settings
from django.conf.urls.static import static   # <--- NUEVO: Para servir archivos estáticos

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # --- AUTENTICACIÓN Y USUARIOS ---
    # Esto incluye login, logout, password_reset (de Django)
    path('accounts/', include('django.contrib.auth.urls')),
    
    # Esto incluye TU registro y activación.
    # Tus URLs serán: /accounts/registro/ y /accounts/activate/...
    path('accounts/', include('apps.users.urls')),

    # --- ACADÉMICO ---
    path('academic/', include('apps.enrollments.urls')),
    path('academic/', include('apps.academic.urls')),
    path('examenes/', include('apps.exams.urls')),
    
    # --- REDIRECCIÓN ---
    # Redirigir la raíz (http://localhost:8000) al login directamente
    path('', RedirectView.as_view(url='/accounts/login/', permanent=False)),
]

# --- CONFIGURACIÓN PARA ARCHIVOS SUBIDOS (MEDIA) ---
# Esto es vital para que funcionen los PDFs e imágenes en desarrollo
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
