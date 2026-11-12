from django.db import models
from django.contrib.auth.models import AbstractUser

class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Administrator'),
        ('teacher', "O'qituvchi"),
        ('tutor', 'Tyuter'),
        ('student', "O'quvchi"),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    full_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    grade = models.CharField(max_length=50, blank=True, null=True, help_text="Masalan: 9-A (faqat o'quvchilar uchun)")
    subject = models.CharField(max_length=100, blank=True, null=True, help_text="Masalan: Matematika (faqat o'qituvchilar uchun)")
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    bio = models.TextField(blank=True, default='')
    coins = models.PositiveIntegerField(default=0, verbose_name="Coinlar (Diamond Coins)")

    def get_avatar_url(self):
        if self.avatar:
            try:
                return self.avatar.url
            except Exception:
                pass
        initials = self.full_name[:2].upper() if self.full_name else self.username[:2].upper()
        return f"https://api.dicebear.com/7.x/initials/svg?seed={initials}&backgroundColor=0284c7,0077b6,0f172a&textColor=ffffff"

    def save(self, *args, **kwargs):
        if not self.full_name:
            self.full_name = f"{self.first_name} {self.last_name}".strip() or self.username
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} ({self.username}) - {self.get_role_display()}"



class Test(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    teacher = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='created_tests')
    subject = models.CharField(max_length=100)
    grade = models.CharField(max_length=500, default='Barchasi')
    language = models.CharField(max_length=10, choices=(('uz', "O'zbek"), ('ru', 'Русский')), default='uz')
    duration_minutes = models.PositiveIntegerField(default=15)
    start_time = models.DateTimeField(null=True, blank=True, verbose_name="Boshlanish vaqti")
    end_time = models.DateTimeField(null=True, blank=True, verbose_name="Tugash vaqti")
    max_attempts = models.PositiveIntegerField(default=1, verbose_name="Ruxsat etilgan urinishlar soni (0 bo'lsa cheksiz)")
    is_student_allowed = models.BooleanField(default=False, verbose_name="O'quvchilarga test ishlashga ruxsat")
    reward_top_count = models.PositiveIntegerField(default=0, verbose_name="Faol qatnashadigan birinchi N nafar o'quvchiga coin bonusi")
    reward_coins_amount = models.PositiveIntegerField(default=0, verbose_name="Testda faol qatnashgan o'quvchiga qo'shimcha bonus coin")
    reward_min_score = models.PositiveIntegerField(default=0, verbose_name="Bonus coin olish uchun minimal natija (%)")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.subject} - {self.grade} - {self.language})"


class Question(models.Model):
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField()
    image = models.ImageField(upload_to='question_images/', blank=True, null=True)
    image_url = models.TextField(blank=True, default='')
    order = models.PositiveIntegerField(default=1)

    def get_image_url(self):
        if self.image:
            try:
                return self.image.url
            except Exception:
                pass
        if self.image_url:
            return self.image_url
        return ''

    def __str__(self):
        return f"{self.test.title} - Q#{self.order}"


class Option(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.text} ({'To\'g\'ri' if self.is_correct else 'Noto\'g\'ri'})"


class TestResult(models.Model):
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='results')
    student = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='results')
    total_questions = models.PositiveIntegerField(default=0)
    correct_answers = models.PositiveIntegerField(default=0)
    score_percentage = models.PositiveIntegerField(default=0)
    time_spent_seconds = models.PositiveIntegerField(default=0)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.student.full_name} - {self.test.title}: {self.score_percentage}%"


class StudentAnswer(models.Model):
    result = models.ForeignKey(TestResult, on_delete=models.CASCADE, related_name='detailed_answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_option = models.ForeignKey(Option, on_delete=models.SET_NULL, null=True, blank=True)
    is_correct = models.BooleanField(default=False)


class CoinTransaction(models.Model):
    """O'quvchilarga berilgan coinlar tarixi (Audit log)"""
    student = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='coin_transactions')
    given_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='awarded_coins', verbose_name="Kim tomonidan berildi")
    amount = models.IntegerField(default=0, verbose_name="Coin miqdori (+ yoki -)")
    reason = models.CharField(max_length=255, verbose_name="Coin berish sababi")
    test_result = models.ForeignKey(TestResult, on_delete=models.SET_NULL, null=True, blank=True, related_name='coins_awarded')
    portal = models.CharField(max_length=20, blank=True, default='', verbose_name="Manba portali")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Berilgan vaqti")

    class Meta:
        verbose_name = "Coin O'tkazmasi"
        verbose_name_plural = "Coin O'tkazmalari"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.student.full_name}: {self.amount:+d} coin ({self.reason})"


class TeacherShowcase(models.Model):
    """Saytning bosh sahifasida ko'rinadigan o'qituvchilar (Admin tomonidan to'liq boshqariladi)"""
    user = models.OneToOneField(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='showcase_profile', help_text="Mavjud o'qituvchi profiliga bog'lash (ixtiyoriy)")
    name = models.CharField(max_length=255, verbose_name="O'qituvchi F.I.Sh")
    subject = models.CharField(max_length=150, verbose_name="Fani (Masalan: Biologiya, Matematika)")
    title = models.CharField(max_length=255, blank=True, default="Diamond School Fan Ustozi", verbose_name="Lavozimi / Ilmiy darajasi")
    photo = models.ImageField(upload_to='teachers/', blank=True, null=True, verbose_name="O'qituvchi surati (Fayl)")
    photo_url = models.TextField(blank=True, default="", verbose_name="Surat havolasi (URL - agar fayl yuklanmasa)")
    experience = models.CharField(max_length=150, blank=True, default="5+ yil tajriba", verbose_name="Pedagogik tajribasi")
    quote = models.TextField(blank=True, default="", verbose_name="Pedagogik shiori / Fikri")
    students_count = models.CharField(max_length=50, blank=True, default="300+", verbose_name="O'quvchilar soni")
    avg_score = models.CharField(max_length=20, blank=True, default="92%", verbose_name="O'rtacha ko'rsatkichi")
    order = models.PositiveIntegerField(default=1, verbose_name="Chiqish tartibi")
    is_visible_on_site = models.BooleanField(default=True, verbose_name="Saytda ko'rinsinmi?")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Ustoz (Bosh sahifa)"
        verbose_name_plural = "Ustozlar (Bosh sahifa)"
        ordering = ['order', 'id']

    def get_image_url(self):
        if self.photo:
            try:
                return self.photo.url
            except Exception:
                pass
        if self.photo_url:
            return self.photo_url
        if self.user and self.user.avatar:
            try:
                return self.user.avatar.url
            except Exception:
                pass
        initials = self.name[:2].upper() if self.name else 'DS'
        return f"https://api.dicebear.com/7.x/initials/svg?seed={initials}&backgroundColor=0284c7"

    def __str__(self):
        return f"{self.name} — {self.subject} ({'Faol' if self.is_visible_on_site else 'Yashirilgan'})"


class TalentedStudent(models.Model):
    """Saytning bosh sahifasidagi Iqtidorli O'quvchilar karuseli (Admin tomonidan boshqariladi)"""
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='talent_profile', help_text="Mavjud o'quvchi profiliga bog'lash (ixtiyoriy)")
    name = models.CharField(max_length=255, verbose_name="O'quvchi F.I.Sh")
    grade = models.CharField(max_length=50, default="9-A sinf", verbose_name="Sinfi")
    photo = models.ImageField(upload_to='talented_students/', blank=True, null=True, verbose_name="O'quvchi surati (Fayl)")
    photo_url = models.TextField(blank=True, default="", verbose_name="Surat havolasi (URL - agar fayl yuklanmasa)")
    achievement = models.CharField(max_length=255, verbose_name="Yutug'i / Olimpiada natijasi")
    badge = models.CharField(max_length=100, default="Oltin Medalist", verbose_name="Unvoni / Nishoni (masalan: Oltin Medalist, 1-o'rin)")
    quote = models.TextField(blank=True, default="", verbose_name="O'quvchining shiori yoki fikri")
    xp_score = models.PositiveIntegerField(default=1500, verbose_name="Reyting bali (XP)")
    order = models.PositiveIntegerField(default=1, verbose_name="Karuseldagi tartibi")
    is_active = models.BooleanField(default=True, verbose_name="Saytda ko'rinsinmi?")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Iqtidorli O'quvchi (Karusel)"
        verbose_name_plural = "Iqtidorli O'quvchilar (Karusel)"
        ordering = ['order', 'id']

    def get_image_url(self):
        if self.photo:
            try:
                return self.photo.url
            except Exception:
                pass
        if self.photo_url:
            return self.photo_url
        if self.user and self.user.avatar:
            try:
                return self.user.avatar.url
            except Exception:
                pass
        initials = self.name[:2].upper() if self.name else 'ST'
        return f"https://api.dicebear.com/7.x/initials/svg?seed={initials}&backgroundColor=00b4d8"

    def __str__(self):
        return f"{self.name} ({self.grade}) — {self.achievement}"


class ContactMessage(models.Model):
    """Saytning 'Biz bilan bog'lanish' bo'limidan kelgan arizalar va xabarlar"""
    full_name = models.CharField(max_length=200, verbose_name="F.I.Sh")
    phone = models.CharField(max_length=50, verbose_name="Telefon raqami")
    grade_interest = models.CharField(max_length=100, default="Umumiy ma'lumot", verbose_name="Qiziqqan sinfi yoki fan")
    message = models.TextField(blank=True, default="", verbose_name="Xabar / Savol")
    is_contacted = models.BooleanField(default=False, verbose_name="Bog'lanildi / Ko'rildi")
    admin_notes = models.TextField(blank=True, default="", verbose_name="Admin izohi")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yuborilgan vaqti")

    class Meta:
        verbose_name = "Bog'lanish Xabari (Ariza)"
        verbose_name_plural = "Bog'lanish Xabarlari (Arizalar)"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} ({self.phone}) — {self.grade_interest}"


class SiteSetting(models.Model):
    """Saytning barcha dinamik ma'lumotlari: telefonlar, manzil, ijtimoiy tarmoqlar va statistikalar"""
    school_name = models.CharField(max_length=150, default="Diamond School", verbose_name="Maktab nomi")
    phone_primary = models.CharField(max_length=50, default="+998 (71) 200-00-00", verbose_name="Asosiy telefon")
    phone_secondary = models.CharField(max_length=50, default="+998 (90) 123-45-67", verbose_name="Qo'shimcha telefon (Telegram)")
    email = models.EmailField(default="info@diamondschool.uz", verbose_name="Elektron pochta")
    address_uz = models.CharField(max_length=300, default="Toshkent shahri, Yunusobod tumani, Amir Temur shoh ko'chasi, 120-uy", verbose_name="Manzil (UZ)")
    address_ru = models.CharField(max_length=300, default="город Ташкент, Юнусабадский район, проспект Амира Темура, дом 120", verbose_name="Manzil (RU)")
    landmark = models.CharField(max_length=150, default="Shahriston metro bekati", verbose_name="Mo'ljal")
    working_hours_uz = models.CharField(max_length=150, default="Dushanba — Shanba, 08:30 — 18:00", verbose_name="Ish vaqti (UZ)")
    working_hours_ru = models.CharField(max_length=150, default="Понедельник — Суббота, 08:30 — 18:00", verbose_name="Ish vaqti (RU)")
    telegram_url = models.CharField(max_length=200, default="https://t.me", verbose_name="Telegram havola")
    instagram_url = models.CharField(max_length=200, default="https://instagram.com", verbose_name="Instagram havola")
    youtube_url = models.CharField(max_length=200, default="https://youtube.com", verbose_name="YouTube havola")

    # Saytning asosiy statistik ko'rsatkichlari (Admin tomonidan boshqariladi)
    stat_students = models.CharField(max_length=50, default="1,500+", verbose_name="O'quvchilar soni")
    stat_tests = models.CharField(max_length=50, default="120+", verbose_name="Testlar va olimpiadalar")
    stat_capacity = models.CharField(max_length=50, default="600+", verbose_name="O'quvchi sig'imi")
    stat_books = models.CharField(max_length=50, default="5,000+", verbose_name="Kitoblar fondi")
    stat_devices = models.CharField(max_length=50, default="100+", verbose_name="IT Qurilmalar")

    # O'quvchilar bo'limi testlari uchun global ruxsat va vaqt nazorati (Admin)
    student_tests_enabled = models.BooleanField(default=True, verbose_name="O'quvchilar bo'limi testlariga umumiy ruxsat")
    student_tests_start_time = models.DateTimeField(null=True, blank=True, verbose_name="O'quvchilar testlari ruxsat boshlanish vaqti")
    student_tests_end_time = models.DateTimeField(null=True, blank=True, verbose_name="O'quvchilar testlari ruxsat tugash vaqti")

    class Meta:
        verbose_name = "Sayt Sozlamalari & Ma'lumotlari"
        verbose_name_plural = "Sayt Sozlamalari & Ma'lumotlari"

    @classmethod
    def get_settings(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj

    def __str__(self):
        return f"{self.school_name} — Sayt Sozlamalari"


class SchoolClass(models.Model):
    """Maktabdagi barcha sinflar: O'zbek va Rus tillaridagi sinflar"""
    LANGUAGE_CHOICES = (
        ('uz', "O'zbek tili"),
        ('ru', "Rus tili (Русский)"),
    )
    name = models.CharField(max_length=50, unique=True, verbose_name="Sinf nomi (Masalan: 9-A, 9-RU)")
    grade_level = models.PositiveIntegerField(default=5, verbose_name="Sinf bosqichi (5-11)")
    language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES, default='uz', verbose_name="Ta'lim tili")
    room = models.CharField(max_length=50, blank=True, default="", verbose_name="Sinf xonasi")
    head_teacher = models.CharField(max_length=150, blank=True, default="", verbose_name="Sinf rahbari")
    tutor = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tutor_classes',
        limit_choices_to={'role': 'tutor'},
        verbose_name="Biriktirilgan tyuter",
    )
    description = models.TextField(blank=True, default="", verbose_name="Izoh / Tavsif")
    bonus_coins = models.PositiveIntegerField(default=0, verbose_name="Sinf jamg'armasi (Sinfning o'ziga berilgan coinlar)")
    is_active = models.BooleanField(default=True, verbose_name="Faol sinf")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan vaqti")

    class Meta:
        verbose_name = "Maktab Sinflari"
        verbose_name_plural = "Maktab Sinflari"
        ordering = ['grade_level', 'language', 'name']

    def __str__(self):
        lang_label = "UZ" if self.language == 'uz' else "RU"
        return f"{self.name} ({lang_label})"


class ClassCoinTransaction(models.Model):
    """Faol sinflarning o'z hisobiga berilgan coinlar tarixi (Audit log)"""
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name='coin_transactions', verbose_name="Sinf")
    tutor = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tutor_class_coin_transactions',
        verbose_name="Biriktirilgan tyuter hisobi",
    )
    given_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='awarded_class_coins', verbose_name="Kim tomonidan berildi")
    amount = models.IntegerField(default=0, verbose_name="Coin miqdori (+ yoki -)")
    reason = models.CharField(max_length=255, verbose_name="Coin berish sababi")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Berilgan vaqti")

    class Meta:
        verbose_name = "Sinf Coin O'tkazmasi"
        verbose_name_plural = "Sinf Coin O'tkazmalari"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.school_class.name}: {self.amount:+d} coin ({self.reason})"


