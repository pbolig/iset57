from apps.users.models import User
from apps.academic.models import Career, Subject

class UserFactory:
    @staticmethod
    def create_student(dni, email):
        user = User.objects.create_user(
            username=dni, 
            email=email, 
            password="password123",
            dni=dni,
            role=User.Role.STUDENT
        )
        return user

    @staticmethod
    def create_teacher(dni, email):
        user = User.objects.create_user(
            username=dni, 
            email=email, 
            password="password123",
            dni=dni,
            role=User.Role.TEACHER
        )
        return user

class AcademicFactory:
    @staticmethod
    def create_career(name="Ingeniería Test"):
        return Career.objects.create(name=name, short_name="TEST")