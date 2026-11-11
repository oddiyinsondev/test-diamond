import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'test_system.settings')
django.setup()

from core.models import CustomUser, Test, Question, Option, TestResult, StudentAnswer

def seed():
    print("Boshlang'ich ma'lumotlar yuklanmoqda...")

    # 1. Admin
    admin, _ = CustomUser.objects.get_or_create(
        username='admin',
        defaults={
            'full_name': 'Bosh Administrator',
            'role': 'admin',
            'is_staff': True,
            'is_superuser': True
        }
    )
    admin.set_password('123')
    admin.save()

    # 2. Teachers
    t1, _ = CustomUser.objects.get_or_create(
        username='anvar_muallim',
        defaults={
            'full_name': 'Anvar Qosimov',
            'role': 'teacher',
            'subject': 'Matematika',
            'phone': '+998 90 123 45 67'
        }
    )
    t1.set_password('123')
    t1.save()

    t2, _ = CustomUser.objects.get_or_create(
        username='dilnoza_ustoz',
        defaults={
            'full_name': 'Dilnoza Karimova',
            'role': 'teacher',
            'subject': 'Informatika',
            'phone': '+998 93 987 65 43'
        }
    )
    t2.set_password('123')
    t2.save()

    # 3. Students
    s1, _ = CustomUser.objects.get_or_create(
        username='jasur_9a',
        defaults={
            'full_name': 'Jasur Aliyev',
            'role': 'student',
            'grade': '9-A',
            'phone': '+998 94 111 22 33'
        }
    )
    s1.set_password('123')
    s1.save()

    s2, _ = CustomUser.objects.get_or_create(
        username='madina_9a',
        defaults={
            'full_name': 'Madina Rustamova',
            'role': 'student',
            'grade': '9-A',
            'phone': '+998 97 222 33 44'
        }
    )
    s2.set_password('123')
    s2.save()

    s3, _ = CustomUser.objects.get_or_create(
        username='bobur_9a',
        defaults={
            'full_name': 'Bobur Saidov',
            'role': 'student',
            'grade': '9-A',
            'phone': '+998 90 333 44 55'
        }
    )
    s3.set_password('123')
    s3.save()

    s4, _ = CustomUser.objects.get_or_create(
        username='aziza_10a',
        defaults={
            'full_name': 'Aziza Rahimova',
            'role': 'student',
            'grade': '10-A',
            'phone': '+998 91 444 55 66'
        }
    )
    s4.set_password('123')
    s4.save()

    # 4. Tests
    test1, created1 = Test.objects.get_or_create(
        title='Kvadrat tenglamalar va funksiyalar',
        teacher=t1,
        defaults={
            'description': '9-A sinf algebra kursi bo\'yicha oraliq nazorat testi',
            'subject': 'Matematika',
            'grade': '9-A',
            'duration_minutes': 15
        }
    )
    if created1:
        q_data1 = [
            ("x² - 5x + 6 = 0 tenglamaning ildizlarini toping.", ["x₁ = 2, x₂ = 3", "x₁ = -2, x₂ = -3", "x₁ = 1, x₂ = 6", "x₁ = -1, x₂ = 6"], 0),
            ("Agar diskriminant D > 0 bo'lsa, kvadrat tenglama nechta haqiqiy ildizga ega?", ["Ildizga ega emas", "1 ta ildizga ega", "2 ta turli ildizga ega", "Cheksiz ko'p"], 2),
            ("y = 2x + 4 chiziqli funksiya grafigining OY o'qi bilan kesishish nuqtasi qaysi?", ["(0, 2)", "(0, 4)", "(4, 0)", "(-2, 0)"], 1),
            ("Viyet teoremasiga ko'ra x² + px + q = 0 tenglamada ildizlar yig'indisi nimaga teng?", ["q", "-p", "p", "-q"], 1),
            ("3x² = 27 tenglamaning yechimlarini toping.", ["x = ±3", "x = 3", "x = 9", "x = ±9"], 0)
        ]
        for idx, (qtext, opts, correct_idx) in enumerate(q_data1, 1):
            q = Question.objects.create(test=test1, text=qtext, order=idx)
            for opt_i, opt_text in enumerate(opts):
                Option.objects.create(question=q, text=opt_text, is_correct=(opt_i == correct_idx))

    test2, created2 = Test.objects.get_or_create(
        title='Python dasturlash asoslari va algoritmlar',
        teacher=t2,
        defaults={
            'description': 'Informatika fanidan Python sintaksisi va ma\'lumot turlari testi',
            'subject': 'Informatika',
            'grade': '9-A',
            'duration_minutes': 10
        }
    )
    if created2:
        q_data2 = [
            ("Python tilida ekranga ma'lumot chiqarish uchun qaysi funksiya ishlatiladi?", ["echo()", "System.out.println()", "print()", "console.log()"], 2),
            ("Quyidagilardan qaysi biri o'zgarmas (immutable) ma'lumot turi hisoblanadi?", ["list", "tuple", "dict", "set"], 1),
            ("len('Salom Dunyo') ifodasi qanday natija qaytaradi?", ["10", "11", "12", "9"], 1),
            ("Python-da bir qatorda izoh (comment) qoldirish uchun qaysi belgi ishlatiladi?", ["//", "/*", "#", "<!--"], 2)
        ]
        for idx, (qtext, opts, correct_idx) in enumerate(q_data2, 1):
            q = Question.objects.create(test=test2, text=qtext, order=idx)
            for opt_i, opt_text in enumerate(opts):
                Option.objects.create(question=q, text=opt_text, is_correct=(opt_i == correct_idx))

    # 5. Sample Results for 9-A students
    # Jasur: 100% (5/5)
    r1, _ = TestResult.objects.get_or_create(
        test=test1, student=s1,
        defaults={
            'total_questions': 5,
            'correct_answers': 5,
            'score_percentage': 100,
            'time_spent_seconds': 210
        }
    )
    # Madina: 80% (4/5)
    r2, _ = TestResult.objects.get_or_create(
        test=test1, student=s2,
        defaults={
            'total_questions': 5,
            'correct_answers': 4,
            'score_percentage': 80,
            'time_spent_seconds': 285
        }
    )
    # Bobur: 60% (3/5)
    r3, _ = TestResult.objects.get_or_create(
        test=test1, student=s3,
        defaults={
            'total_questions': 5,
            'correct_answers': 3,
            'score_percentage': 60,
            'time_spent_seconds': 390
        }
    )

    print("Boshlang'ich ma'lumotlar muvaffaqiyatli saqlandi!")

if __name__ == '__main__':
    seed()
