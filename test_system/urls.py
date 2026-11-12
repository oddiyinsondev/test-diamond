from django.contrib import admin
from django.urls import path, re_path
from core import views

from django.views.generic import RedirectView

urlpatterns = [
    # Favicon
    path('favicon.ico', RedirectView.as_view(url='/static/img/diamond_icon.png', permanent=True)),

    # Django default admin
    path('admin/', RedirectView.as_view(url='/django-admin/', permanent=False)),
    path('django-admin/', admin.site.urls),

    # 1. ALOHIDA PORTAL URL-LARI (REACT SPA)
    path('', views.home_view, name='home'),
    path('admin-panel/', views.admin_view, name='admin_panel'),
    path('admin-panel/<path:extra>', views.admin_view),
    path('teacher/', views.teacher_view, name='teacher_portal'),
    path('teacher/<path:extra>', views.teacher_view),
    path('tutor/', views.tutor_view, name='tutor_portal'),
    path('tutor/<path:extra>', views.tutor_view),
    path('student/', views.student_view, name='student_portal'),
    path('student/<path:extra>', views.student_view),
    path('teachers/', views.section_redirect_view, {'section': 'teachers-section'}),
    path('talented/', views.section_redirect_view, {'section': 'talented-section'}),
    path('iqtidorlilar/', views.section_redirect_view, {'section': 'talented-section'}),
    path('contact/', views.section_redirect_view, {'section': 'contact-section'}),

    # 2. AUTH & COMMON APIS
    path('api/auth/login/', views.api_login, name='api_login'),
    path('api/auth/logout/', views.api_logout, name='api_logout'),
    path('api/auth/me/', views.api_current_user, name='api_me'),
    path('api/meta/', views.api_meta, name='api_meta'),
    path('api/profile/update/', views.api_update_profile, name='api_update_profile'),

    # 3. ADMIN APIS (O'qituvchilar, Tyuterlar va O'quvchilar ALOHIDA)
    path('api/admin/teachers/', views.api_admin_teachers, name='api_admin_teachers'),
    path('api/admin/tutors/', views.api_admin_tutors, name='api_admin_tutors'),
    path('api/admin/students/', views.api_admin_students, name='api_admin_students'),
    path('api/admin/users/<int:user_id>/', views.api_admin_user_manage, name='api_admin_user_manage'),
    path('api/admin/stats/', views.api_admin_stats, name='api_admin_stats'),

    # 3.5 TUTOR APIS (Tyuter portali: biriktirilgan sinf o'quvchilari CRUD va Coin hamyoni)
    path('api/tutor/dashboard/', views.api_tutor_dashboard, name='api_tutor_dashboard'),
    path('api/tutor/students/', views.api_tutor_students, name='api_tutor_students'),
    path('api/tutor/students/<int:student_id>/', views.api_tutor_student_manage, name='api_tutor_student_manage'),

    # 4. TEACHER APIS
    path('api/teacher/tests/', views.api_teacher_tests, name='api_teacher_tests'),
    path('api/teacher/tests/<int:test_id>/', views.api_teacher_test_manage, name='api_teacher_test_manage'),
    path('api/admin/tests/permission-settings/', views.api_admin_student_tests_settings, name='api_admin_student_tests_settings'),
    path('api/admin/tests/<int:test_id>/permission/', views.api_admin_test_permission, name='api_admin_test_permission'),
    path('api/teacher/stats/', views.api_teacher_stats, name='api_teacher_stats'),
    path('api/teacher/upload-image/', views.api_upload_question_image, name='api_upload_question_image'),
    path('api/teacher/import-questions/', views.api_teacher_import_questions, name='api_teacher_import_questions'),
    path('api/teacher/download-template/', views.api_teacher_download_template, name='api_teacher_download_template'),

    # 5. STUDENT APIS
    path('api/student/tests/', views.api_student_tests, name='api_student_tests'),
    path('api/student/tests/<int:test_id>/', views.api_student_test_detail, name='api_student_test_detail'),
    path('api/student/tests/<int:test_id>/submit/', views.api_student_submit_test, name='api_student_submit_test'),
    path('api/student/leaderboard/', views.api_student_leaderboard, name='api_student_leaderboard'),
    path('api/student/results/', views.api_student_my_results, name='api_student_my_results'),
    path('api/student/analytics/', views.api_student_analytics, name='api_student_analytics'),

    # 6. DIAMOND SHOWCASE & SITE SETTINGS API
    path('api/diamond/showcase/', views.api_diamond_showcase, name='api_diamond_showcase'),
    path('api/admin/showcase/teachers/', views.api_admin_save_teacher_showcase, name='api_admin_save_teacher_showcase'),
    path('api/admin/showcase/talented-students/', views.api_admin_save_talented_student, name='api_admin_save_talented_student'),
    path('api/admin/showcase/delete/', views.api_admin_delete_showcase_item, name='api_admin_delete_showcase_item'),

    # 7. CONTACT / ARIZALAR & SAYT MA'LUMOTLARI APIS
    path('api/contact/submit/', views.api_contact_submit, name='api_contact_submit'),
    path('api/admin/contact-messages/', views.api_admin_contact_messages, name='api_admin_contact_messages'),
    path('api/admin/site-settings/', views.api_admin_site_settings, name='api_admin_site_settings'),

    # 8. CLASSES MANAGEMENT & ANALYTICS APIS
    path('api/admin/classes/', views.api_admin_classes, name='api_admin_classes'),
    path('api/admin/classes/<int:class_id>/', views.api_admin_class_manage, name='api_admin_class_manage'),

    # 9. DIAMOND COINS & GAMIFICATION APIS
    path('api/coins/award/', views.api_award_coins, name='api_award_coins'),
    path('api/coins/rankings/', views.api_coin_rankings, name='api_coin_rankings'),
    path('api/coins/history/', views.api_student_coin_history, name='api_student_coin_history'),
    path('api/teacher/tests/<int:test_id>/participants/', views.api_teacher_test_participants, name='api_teacher_test_participants'),
    path('api/teacher/tests/<int:test_id>/distribute-coins/', views.api_teacher_test_distribute_coins, name='api_teacher_test_distribute_coins'),
    path('api/teacher/results/<int:result_id>/', views.api_test_result_detail, name='api_test_result_detail'),
    path('api/teacher/class-students/', views.api_teacher_class_students, name='api_teacher_class_students'),
    path('api/teacher/coins/history/', views.api_teacher_coin_history, name='api_teacher_coin_history'),
    path('api/teacher/coins/<int:tx_id>/edit/', views.api_teacher_coin_edit, name='api_teacher_coin_edit'),
    path('api/teacher/coins/<int:tx_id>/delete/', views.api_teacher_coin_delete, name='api_teacher_coin_delete'),
]

from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    re_path(r'^(?!api/|static/|media/|django-admin/|admin/).*$', views.spa_fallback_view, name='spa_fallback'),
]

