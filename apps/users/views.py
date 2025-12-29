from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.template.loader import render_to_string
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.sites.shortcuts import get_current_site
from django.contrib.auth import get_user_model
from django.db import IntegrityError # Importamos esto para capturar errores de duplicados

from .forms import StudentRegistrationForm
from .models import UserDocument

User = get_user_model()

def register(request):
    if request.method == 'POST':
        form = StudentRegistrationForm(request.POST) 
        files = request.FILES.getlist('documents')
        
        # 1. Validar que haya archivos
        if not files:
            messages.error(request, 'Error: Debes adjuntar documentación obligatoria.')
            return render(request, 'registration/register.html', {'form': form})

        if form.is_valid():
            try:
                # --- CREACIÓN MANUAL DEL USUARIO ---
                
                # 2. Obtener datos (Usamos request.POST para asegurar que vienen del HTML)
                email = form.cleaned_data.get('email')
                dni = request.POST.get('dni')
                first_name = request.POST.get('first_name')
                last_name = request.POST.get('last_name')
                
                # Obtener contraseña (UserCreationForm usa 'password1')
                password = form.cleaned_data.get('password1')
                if not password:
                    # Fallback por si cleaned_data falla
                    password = request.POST.get('password1')

                # DEBUG: Imprimir en la consola negra qué estamos intentando guardar
                print(f"--- INTENTO DE REGISTRO ---")
                print(f"Email: {email}, DNI: {dni}, Nombre: {first_name}")
                
                # 3. Instanciar objeto (Sin guardar todavía)
                user = User()
                user.username = email  # Username igual al email
                user.email = email
                user.dni = dni
                user.first_name = first_name
                user.last_name = last_name
                user.is_active = False
                user.role = User.Role.STUDENT
                
                # 4. Encriptar contraseña y Guardar
                user.set_password(password)
                user.save()

                # 5. Guardar Archivos
                for f in files:
                    UserDocument.objects.create(user=user, file=f, description=f.name)
                
                # 6. Enviar Email
                try:
                    current_site = get_current_site(request)
                    subject = 'Activa tu cuenta en InstitutoApp'
                    message = render_to_string('registration/account_activation_email.html', {
                        'user': user,
                        'domain': current_site.domain,
                        'uid': urlsafe_base64_encode(force_bytes(user.pk)),
                        'token': default_token_generator.make_token(user),
                    })
                    
                    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
                    messages.success(request, 'Registro exitoso. Revisa tu correo o la consola para activar.')
                    return redirect('login')
                
                except Exception as e:
                    # Si falla el mail, el usuario YA se creó, así que lo mandamos al login igual
                    print(f"Error enviando mail: {e}")
                    messages.warning(request, f'Usuario creado, pero hubo un error con el envío del correo.')
                    return redirect('login')

            except IntegrityError as e:
                # Esto captura si el DNI o el Email ya existen
                print(f"Error de Integridad: {e}")
                messages.error(request, f"Error: Ya existe un usuario con ese DNI o Email.")
                return render(request, 'registration/register.html', {'form': form})
                
            except Exception as e:
                # Cualquier otro error técnico
                print(f"--- ERROR CRÍTICO: {e} ---")
                messages.error(request, f"Error del sistema: {e}")
                return render(request, 'registration/register.html', {'form': form})

        else:
            messages.error(request, 'Por favor corrige los errores del formulario.')
    else:
        form = StudentRegistrationForm()

    return render(request, 'registration/register.html', {'form': form})

def activate(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is not None and default_token_generator.check_token(user, token):
        user.is_email_verified = True
        user.save()
        messages.success(request, '¡Correo validado! Tu cuenta está en revisión.')
        return redirect('login')
    else:
        messages.error(request, 'El link de activación es inválido o expiró.')
        return redirect('login')