from django.contrib import admin, messages
from .models import ExamSession, ExamEnrollment
from .services import close_exam_act

class ExamEnrollmentInline(admin.TabularInline):
    model = ExamEnrollment
    extra = 0
    autocomplete_fields = ['student'] # Útil si tienes muchos alumnos

@admin.register(ExamSession)
class ExamSessionAdmin(admin.ModelAdmin):
    list_display = ('subject', 'date', 'state', 'inscription_deadline')
    list_filter = ('state', 'date', 'subject__career')
    search_fields = ('subject__name',)
    autocomplete_fields = ['subject', 'examiners']
    
    # Agregamos nuestra nueva acción aquí
    actions = ['action_close_act', 'close_inscriptions']

    @admin.action(description="[PROCESO] Cerrar Acta y Notificar Alumnos")
    def action_close_act(self, request, queryset):
        """Acción para cerrar mesas seleccionadas"""
        for session in queryset:
            success, message = close_exam_act(session)
            
            if success:
                self.message_user(request, f"Mesa {session}: {message}", messages.SUCCESS)
            else:
                self.message_user(request, f"Error en mesa {session}: {message}", messages.ERROR)

    @admin.action(description="Cerrar inscripciones manualmente")
    def close_inscriptions(self, request, queryset):
        queryset.update(state=ExamSession.State.CLOSED_INSCRIPTION)