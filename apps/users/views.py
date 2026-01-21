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
from django.contrib.auth.decorators import login_required
from django.contrib.auth.hashers import make_password
from .forms import UserProfileForm
from .forms import StudentRegistrationForm
from .models import UserDocument, User

# Si tu archivo decorators.py está en la carpeta users:
from .decorators import admin_required

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

@admin_required
def create_teacher_view(request):
    if request.method == 'POST':
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        email = request.POST.get('email')
        dni = request.POST.get('dni')
        
        # 1. VERIFICAR EMAIL (Primero buscamos por mail)
        user_by_email = User.objects.filter(email=email).first()
        
        if user_by_email:
            # Si el mail existe, aplicamos tu lógica inteligente
            if user_by_email.role == 'TEACHER':
                messages.info(request, f"ℹ️ El docente {user_by_email.first_name} ya existe con ese email. Redirigiendo a asignación.")
                return redirect('academic:assign_teacher')
            else:
                messages.error(request, f"⛔ Error: El email {email} ya pertenece a un {user_by_email.get_role_display()}. No se puede duplicar.")
                return redirect('create_teacher') # Nos quedamos en el formulario

        # 2. VERIFICAR DNI (¡Esto es lo que faltaba!)
        # Si llegamos acá, el email es nuevo. Pero... ¿y el DNI?
        user_by_dni = User.objects.filter(dni=dni).first()
        
        if user_by_dni:
            # Si el DNI existe (pero con otro mail), es un conflicto de datos
            messages.error(request, f"⛔ Error de Integridad: El DNI {dni} ya está registrado a nombre de {user_by_dni.first_name} {user_by_dni.last_name} ({user_by_dni.email}).")
            return redirect('create_teacher')

        # 3. CREAR USUARIO (Solo si pasó los dos filtros anteriores)
        try:
            user = User.objects.create(
                username=email,
                email=email,
                first_name=first_name,
                last_name=last_name,
                dni=dni,
                role='TEACHER',
                is_active=True,
                password=make_password(dni)
            )
            
            # Enviar mail
            send_mail(
                'Bienvenido al Plantel Docente',
                f'Hola {first_name}, tu cuenta ha sido creada.\n\nUsuario: {email}\nClave provisoria: {dni}\n\nIngresa en: http://127.0.0.1:8000/accounts/login/',
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=True # Para que no explote si falla el mail en local
            )
            
            messages.success(request, f"✅ Docente {first_name} {last_name} creado exitosamente.")
            return redirect('academic:assign_teacher')

        except Exception as e:
            # Captura cualquier otro error raro de base de datos
            messages.error(request, f"Ocurrió un error inesperado al guardar: {e}")

    return render(request, 'users/create_teacher.html')