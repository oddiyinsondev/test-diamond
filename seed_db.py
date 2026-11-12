import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'test_system.settings')
django.setup()

from core.models import CustomUser


def seed():
    print("Boshlang'ich admin hisobi tayyorlanmoqda...")

    admin, _ = CustomUser.objects.get_or_create(
        username='maktabdiamond',
        defaults={
            'full_name': 'Bosh Administrator',
            'role': 'admin',
            'is_staff': True,
            'is_superuser': True,
            'is_active': True,
        }
    )
    admin.role = 'admin'
    admin.is_staff = True
    admin.is_superuser = True
    admin.is_active = True
    admin.set_password('maktabdiamond')
    admin.save()

    print("Faqat administrator hisobi ('maktabdiamond') muvaffaqiyatli saqlandi!")


if __name__ == '__main__':
    seed()
