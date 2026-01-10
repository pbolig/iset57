from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.template.loader import render_to_string
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.sites.shortcuts import get_current_site
from django.contrib.auth import get_user_model, login, authenticate
from django.contrib.auth.decorators import login_required
from .forms import UserProfileForm

# No necesitamos IntegrityError porque el form ya valida duplicados antes de guardar
from .forms import StudentRegistrationForm
from .models import UserDocument

User = get_user_model()

def register(request):
    if request.method == 'POST':
        # Pasamos POST y FILES al formulario
        form = StudentRegistrationForm(request.POST)
        files = request.FILES.getlist('documents')
        
        # 1. Validación manual de archivos (porque no son parte del modelo User)
        if not files:
            messages.error(request, 'Error: Debes adjuntar documentación obligatoria.')
            return render(request, 'registration/register.html', {'form': form})

        if form.is_valid():
            try:
                # --- AQUÍ ESTÁ LA MAGIA DEL FORMULARIO ---
                # save(commit=False) crea el objeto User con los datos limpios (dni, nombre, pass hasheado)
                # pero NO lo guarda en la BD todavía.
                user = form.save(commit=False)
                
                # Configuramos los campos extra que no vienen en el form
                user.is_active = False  # Desactivado hasta verificar email
                user.is_email_verified = False
                # El rol ya debería venir del form si usamos la corrección anterior, 
                # pero por seguridad lo forzamos aquí también si quieres.
                user.role = User.Role.STUDENT 
                
                # Ahora sí, guardamos definitivamente en la BD
                user.save()

                # 2. Guardar Archivos (Ahora que el user tiene ID)
                for f in files:
                    UserDocument.objects.create(user=user, file=f, description=f.name)
                
                # 3. Enviar Email
                current_site = get_current_site(request)
                subject = 'Activa tu cuenta en InstitutoApp'
                message = render_to_string('registration/account_activation_email.html', {
                    'user': user,
                    'domain': current_site.domain,
                    'uid': urlsafe_base64_encode(force_bytes(user.pk)),
                    'token': default_token_generator.make_token(user),
                })
                
                send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
                
                messages.success(request, 'Registro exitoso. Revisa tu correo para activar la cuenta.')
                return redirect('login')
                
            except Exception as e:
                # Si falla el envío de mail o la subida de archivos
                print(f"Error en proceso de registro: {e}")
                messages.warning(request, f'El usuario se creó, pero hubo un error enviando el correo: {e}')
                return redirect('login')
        else:
            # Si form.is_valid() es False, Django guarda los errores en form.errors
            # y se muestran solos en el template. No hace falta capturar IntegrityError manualmente.
            messages.error(request, 'Por favor corrige los errores indicados en el formulario.')
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
        # Validamos el email
        user.is_email_verified = True
        
        # OJO: Dejamos is_active = False para que requiera aprobación manual de un admin.
        # Si quisieras entrada directa, cambia esto a True.
        user.is_active = False 
        
        user.save()
        messages.success(request, '¡Correo validado! Tu cuenta está en revisión por la administración.')
        return redirect('login')
    else:
        messages.error(request, 'El link de activación es inválido o expiró.')
        return redirect('login')
    
@login_required
def edit_profile(request):
    if request.method == 'POST':
        # request.FILES es vital para que lleguen las imágenes
        form = UserProfileForm(request.POST, request.FILES, instance=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, '¡Tu perfil ha sido actualizado correctamente!')
            # Redirigimos al dashboard para que vea el cambio
            return redirect('academic:dashboard') 
    else:
        # Cargamos el formulario con los datos actuales del usuario
        form = UserProfileForm(instance=request.user)
    
    return render(request, 'users/profile_edit.html', {'form': form})