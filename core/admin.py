from django.contrib import admin
from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin
from .models import (
    CustomUser, Test, Question, Option, TestResult, StudentAnswer,
    TeacherShowcase, TalentedStudent, ContactMessage, SiteSetting, SchoolClass,
    CoinTransaction, ClassCoinTransaction
)


@admin.register(TeacherShowcase)
class TeacherShowcaseAdmin(admin.ModelAdmin):
    list_display = ('photo_preview', 'name', 'subject', 'title', 'experience', 'order', 'is_visible_on_site', 'created_at')
    list_display_links = ('photo_preview', 'name')
    list_editable = ('order', 'is_visible_on_site', 'subject')
    list_filter = ('is_visible_on_site', 'subject')
    search_fields = ('name', 'subject', 'title', 'quote')
    ordering = ('order', 'id')

    fieldsets = (
        ("Asosiy Ma'lumotlar", {
            'fields': ('name', 'subject', 'title', 'user', 'order', 'is_visible_on_site')
        }),
        ("O'qituvchi Surati", {
            'fields': ('photo', 'photo_url'),
            'description': "Surat faylini yuklang yoki to'g'ridan-to'g'ri rasm havolasini (URL) kiriting."
        }),
        ("Pedagogik Tavsif va Natijalar", {
            'fields': ('experience', 'quote', 'students_count', 'avg_score')
        })
    )

    def photo_preview(self, obj):
        img_url = obj.get_image_url()
        return format_html(
            '<img src="{}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 1.5px solid #0284c7; background: #0f172a;" onerror="this.src=\'https://api.dicebear.com/7.x/initials/svg?seed=TC\'" />',
            img_url
        )
    photo_preview.short_description = "Surati"


@admin.register(TalentedStudent)
class TalentedStudentAdmin(admin.ModelAdmin):
    list_display = ('photo_preview', 'name', 'grade', 'achievement', 'badge', 'xp_score', 'order', 'is_active')
    list_display_links = ('photo_preview', 'name')
    list_editable = ('order', 'is_active', 'badge', 'grade')
    list_filter = ('is_active', 'grade', 'badge')
    search_fields = ('name', 'grade', 'achievement', 'badge', 'quote')
    ordering = ('order', 'id')

    fieldsets = (
        ("O'quvchi Ma'lumotlari", {
            'fields': ('name', 'grade', 'user', 'order', 'is_active')
        }),
        ("Surat", {
            'fields': ('photo', 'photo_url'),
            'description': "O'quvchining haqiqiy suratini yuklang yoki rasm URL havolasini kiriting."
        }),
        ("Yutuqlari va Unvoni", {
            'fields': ('achievement', 'badge', 'quote', 'xp_score')
        })
    )

    def photo_preview(self, obj):
        img_url = obj.get_image_url()
        return format_html(
            '<img src="{}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid #00b4d8; background: #0f172a;" onerror="this.src=\'https://api.dicebear.com/7.x/initials/svg?seed=ST\'" />',
            img_url
        )
    photo_preview.short_description = "Surati"


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('avatar_preview', 'username', 'full_name', 'role_badge', 'grade_or_subject', 'coins_badge', 'phone', 'is_staff')
    list_display_links = ('avatar_preview', 'username')
    list_filter = ('role', 'is_staff', 'is_active', 'grade', 'subject')
    search_fields = ('username', 'full_name', 'phone', 'email')
    ordering = ('-date_joined',)

    fieldsets = UserAdmin.fieldsets + (
        ("Diamond Maktab Profili", {
            'fields': ('role', 'full_name', 'phone', 'grade', 'subject', 'coins', 'avatar', 'bio')
        }),
    )

    def coins_badge(self, obj):
        if obj.role in ('student', 'tutor'):
            return format_html('<span style="background: rgba(245, 158, 11, 0.15); color: #b45309; padding: 3px 8px; border-radius: 6px; font-weight: 800;">🪙 {} Coins</span>', obj.coins)
        return "-"
    coins_badge.short_description = "Coinlar"

    def avatar_preview(self, obj):
        return format_html(
            '<img src="{}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1.5px solid #38bdf8;" onerror="this.src=\'https://api.dicebear.com/7.x/initials/svg?seed={}\'" />',
            obj.get_avatar_url(),
            obj.username
        )
    avatar_preview.short_description = "Avatar"

    def role_badge(self, obj):
        colors = {
            'admin': ('#dc2626', '#fee2e2'),
            'teacher': ('#0284c7', '#e0f2fe'),
            'tutor': ('#7c3aed', '#ede9fe'),
            'student': ('#10b981', '#dcfce7')
        }
        fg, bg = colors.get(obj.role, ('#475569', '#f1f5f9'))
        return format_html(
            '<span style="background:{}; color:{}; padding: 3px 10px; border-radius: 12px; font-weight:700; font-size: 0.78rem;">{}</span>',
            bg, fg, obj.get_role_display()
        )
    role_badge.short_description = "Roli"

    def grade_or_subject(self, obj):
        if obj.role == 'teacher':
            return f"Fan: {obj.subject or 'Belgilanmagan'}"
        elif obj.role == 'tutor':
            classes = list(obj.tutor_classes.filter(is_active=True).values_list('name', flat=True))
            return f"Sinflari: {', '.join(classes) if classes else 'Biriktirilmagan'}"
        elif obj.role == 'student':
            return f"Sinf: {obj.grade or 'Belgilanmagan'}"
        return "Boshqaruv"
    grade_or_subject.short_description = "Sinf / Fan"


@admin.register(CoinTransaction)
class CoinTransactionAdmin(admin.ModelAdmin):
    list_display = ('student', 'amount_badge', 'reason', 'given_by', 'test_result', 'created_at')
    list_filter = ('created_at', 'student__grade')
    search_fields = ('student__full_name', 'student__username', 'reason', 'given_by__full_name')
    ordering = ('-created_at',)

    def amount_badge(self, obj):
        color = '#10b981' if obj.amount >= 0 else '#ef4444'
        prefix = '+' if obj.amount > 0 else ''
        return format_html('<span style="color: {}; font-weight: 850;">🪙 {}{}</span>', color, prefix, obj.amount)
    amount_badge.short_description = "Miqdori"


class OptionInline(admin.TabularInline):
    model = Option
    extra = 4


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('test', 'order', 'text_snippet', 'has_image')
    list_filter = ('test__subject', 'test__grade')
    search_fields = ('text',)
    inlines = [OptionInline]

    def text_snippet(self, obj):
        return (obj.text[:60] + '...') if len(obj.text) > 60 else obj.text
    text_snippet.short_description = "Savol matni"

    def has_image(self, obj):
        return bool(obj.image or obj.image_url)
    has_image.boolean = True
    has_image.short_description = "Rasm bormi?"


@admin.register(Test)
class TestAdmin(admin.ModelAdmin):
    list_display = ('title', 'teacher', 'subject', 'grade', 'language', 'is_student_allowed', 'duration_minutes', 'questions_count', 'created_at')
    list_editable = ('is_student_allowed',)
    list_filter = ('is_student_allowed', 'subject', 'grade', 'language')
    search_fields = ('title', 'description')

    def questions_count(self, obj):
        return obj.questions.count()
    questions_count.short_description = "Savollar soni"


@admin.register(TestResult)
class TestResultAdmin(admin.ModelAdmin):
    list_display = ('student', 'test', 'score_badge', 'correct_answers', 'total_questions', 'time_spent', 'submitted_at')
    list_filter = ('score_percentage', 'test__subject', 'test__grade')
    search_fields = ('student__full_name', 'student__username', 'test__title')

    def score_badge(self, obj):
        color = '#10b981' if obj.score_percentage >= 80 else ('#0284c7' if obj.score_percentage >= 60 else '#ef4444')
        return format_html(
            '<strong style="color: {}; font-size: 0.95rem;">{}%</strong>',
            color, obj.score_percentage
        )
    score_badge.short_description = "Ball"

    def time_spent(self, obj):
        m = obj.time_spent_seconds // 60
        s = obj.time_spent_seconds % 60
        return f"{m}m {s}s"
    time_spent.short_description = "Vaqt"


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'phone', 'grade_interest', 'is_contacted', 'status_badge', 'created_at')
    list_filter = ('is_contacted', 'grade_interest', 'created_at')
    search_fields = ('full_name', 'phone', 'message', 'admin_notes')
    list_editable = ('is_contacted',)
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)

    def status_badge(self, obj):
        if obj.is_contacted:
            return format_html('<span style="color: #10b981; font-weight: 750;">✔ Bog\'lanildi</span>')
        return format_html('<span style="color: #ef4444; font-weight: 750;">⏳ Kutilmoqda</span>')
    status_badge.short_description = "Holati"


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    list_display = ('school_name', 'phone_primary', 'phone_secondary', 'email', 'stat_students', 'stat_tests')

    fieldsets = (
        ("Maktab Aloqa Ma'lumotlari", {
            'fields': ('school_name', 'phone_primary', 'phone_secondary', 'email', 'address_uz', 'address_ru', 'landmark', 'working_hours_uz', 'working_hours_ru')
        }),
        ("Ijtimoiy Tarmoqlar", {
            'fields': ('telegram_url', 'instagram_url', 'youtube_url')
        }),
        ("Asosiy Statistik Ko'rsatkichlar", {
            'fields': ('stat_students', 'stat_tests', 'stat_capacity', 'stat_books', 'stat_devices')
        }),
        ("O'quvchilar Test Ruxsati (Global)", {
            'fields': ('student_tests_enabled', 'student_tests_start_time', 'student_tests_end_time')
        })
    )


@admin.register(SchoolClass)
class SchoolClassAdmin(admin.ModelAdmin):
    list_display = ('name', 'grade_level', 'language_badge', 'bonus_coins', 'tutor', 'room', 'head_teacher', 'is_active', 'created_at')
    list_filter = ('language', 'grade_level', 'is_active', 'tutor')
    search_fields = ('name', 'head_teacher', 'room', 'tutor__full_name', 'tutor__username')
    list_editable = ('is_active', 'head_teacher', 'room', 'tutor')
    ordering = ('grade_level', 'language', 'name')

    def language_badge(self, obj):
        if obj.language == 'ru':
            return format_html('<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 3px 8px; border-radius: 6px; font-weight: 750;">🇷🇺 Rus tili</span>')
        return format_html('<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 3px 8px; border-radius: 6px; font-weight: 750;">🇺🇿 O\'zbek tili</span>')
    language_badge.short_description = "Ta'lim tili"


@admin.register(ClassCoinTransaction)
class ClassCoinTransactionAdmin(admin.ModelAdmin):
    list_display = ('school_class', 'tutor', 'amount_badge', 'reason', 'given_by', 'created_at')
    list_filter = ('created_at', 'school_class', 'tutor')
    search_fields = ('school_class__name', 'tutor__full_name', 'reason', 'given_by__full_name')
    ordering = ('-created_at',)

    def amount_badge(self, obj):
        color = '#10b981' if obj.amount >= 0 else '#ef4444'
        prefix = '+' if obj.amount > 0 else ''
        return format_html('<span style="color: {}; font-weight: 850;">🏫 {}{}</span>', color, prefix, obj.amount)
    amount_badge.short_description = "Miqdori"

