import io
import json
from datetime import timedelta
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, Client
from django.utils import timezone
from core.models import (
    SchoolClass, CustomUser, Test, Question, Option, SiteSetting,
    TestResult, CoinTransaction, ClassCoinTransaction, ContactMessage,
    TalentedStudent, StudentAnswer,
)
from core.importer import (
    normalize_math_text, parse_questions_from_file,
    generate_sample_excel, generate_sample_word,
)
from core import views as core_views


class SchoolClassManagementTests(TestCase):
    def setUp(self):
        self.client = Client()
        # Create admin user
        self.admin_user = CustomUser.objects.create_user(username='admin', password='adminpassword', role='admin')
        self.client.login(username='admin', password='adminpassword')
        # Create initial test classes
        self.cls_uz = SchoolClass.objects.create(
            name='9-A',
            grade_level=9,
            language='uz',
            room='201-xona',
            head_teacher='Dilnoza Karimova'
        )
        self.cls_ru = SchoolClass.objects.create(
            name='9-RU',
            grade_level=9,
            language='ru',
            room='202-xona',
            head_teacher='Anna Smirnova'
        )

    def test_class_model_str_and_properties(self):
        self.assertEqual(str(self.cls_uz), "9-A (UZ)")
        self.assertEqual(str(self.cls_ru), "9-RU (RU)")
        self.assertEqual(self.cls_uz.language, 'uz')
        self.assertEqual(self.cls_ru.language, 'ru')

    def test_api_admin_classes_get(self):
        response = self.client.get('/api/admin/classes/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('classes', data)
        self.assertIn('summary', data)
        self.assertEqual(data['summary']['total'], 2)
        self.assertEqual(data['summary']['uzbekCount'], 1)
        self.assertEqual(data['summary']['russianCount'], 1)

    def test_api_admin_classes_post_create(self):
        payload = {
            'name': '10-RU',
            'grade_level': 10,
            'language': 'ru',
            'room': '305-xona',
            'head_teacher': 'Mariya Petrova',
            'description': 'Rus tili chuqurlashtirilgan'
        }
        response = self.client.post('/api/admin/classes/', payload, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        res_data = response.json()
        self.assertTrue(res_data.get('success'))
        self.assertTrue(SchoolClass.objects.filter(name='10-RU', language='ru').exists())

    def test_api_admin_class_delete(self):
        cls_to_delete = SchoolClass.objects.create(name='11-TEMP', grade_level=11, language='uz')
        response = self.client.delete(f'/api/admin/classes/{cls_to_delete.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(SchoolClass.objects.filter(id=cls_to_delete.id).exists())

    def test_api_meta_classes_and_subjects(self):
        response = self.client.get('/api/meta/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('classes', data)
        self.assertIn('subjects', data)
        self.assertIn('studentTestsPolicy', data)
        self.assertTrue(len(data['classes']) >= 2)

    def test_admin_api_security_unauthenticated(self):
        anon_client = Client()
        response = anon_client.get('/api/admin/teachers/')
        self.assertEqual(response.status_code, 401)
        response = anon_client.get('/api/admin/classes/')
        self.assertEqual(response.status_code, 401)

    def test_api_student_leaderboard_all(self):
        response = self.client.get('/api/student/leaderboard/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('leaderboard', data)


class StudentTestPermissionTests(TestCase):
    def setUp(self):
        SchoolClass.objects.create(name='9-A', grade_level=9, language='uz')
        self.admin_user = CustomUser.objects.create_user(username='admin_perm', password='123', role='admin')
        self.teacher_user = CustomUser.objects.create_user(username='teacher_perm', password='123', role='teacher', subject='Matematika')
        self.student_user = CustomUser.objects.create_user(username='student_9a', password='123', role='student', grade='9-A')

        self.test_obj = Test.objects.create(
            title='Permission Test',
            teacher=self.teacher_user,
            subject='Matematika',
            grade='9-A',
            duration_minutes=15,
            max_attempts=2,
        )
        self.question = Question.objects.create(test=self.test_obj, text='2 + 2 = ?', order=1)
        self.opt_wrong = Option.objects.create(question=self.question, text='3', is_correct=False)
        self.opt_correct = Option.objects.create(question=self.question, text='4', is_correct=True)

    def test_new_test_defaults_locked_and_blocked_for_student(self):
        self.assertFalse(self.test_obj.is_student_allowed)
        cli = Client()
        cli.login(username='student_9a', password='123')

        list_resp = cli.get('/api/student/tests/')
        self.assertEqual(list_resp.status_code, 200)
        items = list_resp.json()
        self.assertEqual(len(items), 1)
        self.assertFalse(items[0]['canStart'])
        self.assertFalse(items[0]['isStudentAllowed'])
        self.assertEqual(items[0]['lockReason'], 'admin_not_allowed')

        detail_resp = cli.get(f'/api/student/tests/{self.test_obj.id}/')
        self.assertEqual(detail_resp.status_code, 403)
        self.assertEqual(detail_resp.json().get('lockReason'), 'admin_not_allowed')

        submit_resp = cli.post(
            f'/api/student/tests/{self.test_obj.id}/submit/',
            {'answers': {str(self.question.id): self.opt_correct.id}, 'timeSpentSeconds': 5},
            content_type='application/json',
        )
        self.assertEqual(submit_resp.status_code, 403)
        self.assertEqual(TestResult.objects.filter(test=self.test_obj).count(), 0)

    def test_admin_permission_grant_and_revoke_flow(self):
        admin_cli = Client()
        admin_cli.login(username='admin_perm', password='123')
        student_cli = Client()
        student_cli.login(username='student_9a', password='123')

        # Grant per-test permission
        r_allow = admin_cli.post(
            f'/api/admin/tests/{self.test_obj.id}/permission/',
            {'isStudentAllowed': True},
            content_type='application/json',
        )
        self.assertEqual(r_allow.status_code, 200)
        self.assertTrue(r_allow.json()['isStudentAllowed'])
        self.assertTrue(r_allow.json()['isActive'])

        # Student can now open and submit
        self.assertEqual(student_cli.get(f'/api/student/tests/{self.test_obj.id}/').status_code, 200)
        r_sub = student_cli.post(
            f'/api/student/tests/{self.test_obj.id}/submit/',
            {'answers': {str(self.question.id): self.opt_correct.id}, 'timeSpentSeconds': 7},
            content_type='application/json',
        )
        self.assertEqual(r_sub.status_code, 200)
        self.assertEqual(r_sub.json()['percentage'], 100)

        # Global portal disable blocks even an allowed test
        r_close = admin_cli.post(
            '/api/admin/tests/permission-settings/',
            {'enabled': False},
            content_type='application/json',
        )
        self.assertEqual(r_close.status_code, 200)
        self.assertFalse(r_close.json()['policy']['portalOpen'])

        r_blocked = student_cli.get(f'/api/student/tests/{self.test_obj.id}/')
        self.assertEqual(r_blocked.status_code, 403)
        self.assertEqual(r_blocked.json().get('lockReason'), 'portal_disabled')

        # Re-open portal + lock test specifically
        admin_cli.post('/api/admin/tests/permission-settings/', {'enabled': True}, content_type='application/json')
        r_lock = admin_cli.post(
            f'/api/admin/tests/{self.test_obj.id}/permission/',
            {'isStudentAllowed': False},
            content_type='application/json',
        )
        self.assertEqual(r_lock.status_code, 200)
        self.assertFalse(r_lock.json()['isStudentAllowed'])
        self.assertEqual(student_cli.get(f'/api/student/tests/{self.test_obj.id}/').status_code, 403)

    def test_scheduled_time_windows_and_validation(self):
        admin_cli = Client()
        admin_cli.login(username='admin_perm', password='123')
        student_cli = Client()
        student_cli.login(username='student_9a', password='123')

        now = timezone.localtime(timezone.now())
        future_start = (now + timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M')
        future_end = (now + timedelta(hours=4)).strftime('%Y-%m-%dT%H:%M')

        # Invalid start >= end returns 400
        bad_resp = admin_cli.post(
            f'/api/admin/tests/{self.test_obj.id}/permission/',
            {'isStudentAllowed': True, 'startTime': future_end, 'endTime': future_start},
            content_type='application/json',
        )
        self.assertEqual(bad_resp.status_code, 400)

        # Future schedule blocks student even though isStudentAllowed=True
        fut_resp = admin_cli.post(
            f'/api/admin/tests/{self.test_obj.id}/permission/',
            {'isStudentAllowed': True, 'startTime': future_start, 'endTime': future_end},
            content_type='application/json',
        )
        self.assertEqual(fut_resp.status_code, 200)
        self.assertTrue(fut_resp.json()['isUpcoming'])
        self.assertFalse(fut_resp.json()['isActive'])
        det = student_cli.get(f'/api/student/tests/{self.test_obj.id}/')
        self.assertEqual(det.status_code, 403)
        self.assertEqual(det.json().get('lockReason'), 'test_upcoming')

        # Active schedule opens access
        past_start = (now - timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M')
        act_resp = admin_cli.post(
            f'/api/admin/tests/{self.test_obj.id}/permission/',
            {'isStudentAllowed': True, 'startTime': past_start, 'endTime': future_end},
            content_type='application/json',
        )
        self.assertEqual(act_resp.status_code, 200)
        self.assertTrue(act_resp.json()['isActive'])
        self.assertEqual(student_cli.get(f'/api/student/tests/{self.test_obj.id}/').status_code, 200)

    def test_teacher_and_student_cannot_modify_permissions(self):
        for uname in ('teacher_perm', 'student_9a'):
            cli = Client()
            cli.login(username=uname, password='123')
            r1 = cli.post('/api/admin/tests/permission-settings/', {'enabled': False}, content_type='application/json')
            self.assertEqual(r1.status_code, 403)
            r2 = cli.post(f'/api/admin/tests/{self.test_obj.id}/permission/', {'isStudentAllowed': True}, content_type='application/json')
            self.assertEqual(r2.status_code, 403)

    def test_bulk_allow_all_and_lock_all(self):
        admin_cli = Client()
        admin_cli.login(username='admin_perm', password='123')
        t2 = Test.objects.create(title='Second Test', teacher=self.teacher_user, subject='Fizika', grade='9-A')

        r_all = admin_cli.post('/api/admin/tests/permission-settings/', {'action': 'allow_all'}, content_type='application/json')
        self.assertEqual(r_all.status_code, 200)
        self.assertEqual(r_all.json()['updatedCount'], 2)
        self.test_obj.refresh_from_db()
        t2.refresh_from_db()
        self.assertTrue(self.test_obj.is_student_allowed and t2.is_student_allowed)

        r_lock = admin_cli.post('/api/admin/tests/permission-settings/', {'action': 'lock_all'}, content_type='application/json')
        self.assertEqual(r_lock.status_code, 200)
        self.test_obj.refresh_from_db()
        t2.refresh_from_db()
        self.assertFalse(self.test_obj.is_student_allowed or t2.is_student_allowed)

        # Clean SiteSetting singleton state
        s = SiteSetting.get_settings()
        s.student_tests_enabled = True
        s.student_tests_start_time = None
        s.student_tests_end_time = None
        s.save()


class BilingualApiLocalizationTests(TestCase):
    def setUp(self):
        self.cls_uz = SchoolClass.objects.create(name='9-A', grade_level=9, language='uz')
        self.cls_ru = SchoolClass.objects.create(name='9-RU', grade_level=9, language='ru')
        self.admin_user = CustomUser.objects.create_user(username='adm_i18n', password='123', role='admin', full_name='Admin User')
        self.teacher_user = CustomUser.objects.create_user(username='tch_i18n', password='123', role='teacher', full_name='Teacher User', subject='Matematika')
        self.student_user = CustomUser.objects.create_user(username='std_i18n', password='123', role='student', full_name='Student User', grade='9-A', coins=25)
        self.test_locked = Test.objects.create(
            title='Bilingual Lock Test',
            teacher=self.teacher_user,
            subject='Matematika',
            grade='9-A',
            duration_minutes=15,
            is_student_allowed=False,
        )
        Question.objects.create(test=self.test_locked, text='1+1=?', order=1)

    def test_api_meta_policy_bilingual(self):
        cli = Client()
        uz_resp = cli.get('/api/meta/')
        ru_resp = cli.get('/api/meta/', HTTP_X_LANGUAGE='ru')
        self.assertEqual(uz_resp.status_code, 200)
        self.assertEqual(ru_resp.status_code, 200)
        self.assertIn("O'quvchilar", uz_resp.json()['studentTestsPolicy']['message'])
        self.assertIn('Раздел учеников', ru_resp.json()['studentTestsPolicy']['message'])

    def test_api_login_errors_bilingual(self):
        cli = Client()
        uz_err = cli.post('/api/auth/login/', {'username': 'bad', 'password': 'bad'}, content_type='application/json')
        ru_err = cli.post('/api/auth/login/', {'username': 'bad', 'password': 'bad'}, content_type='application/json', HTTP_X_LANGUAGE='ru')
        self.assertEqual(uz_err.status_code, 401)
        self.assertEqual(ru_err.status_code, 401)
        self.assertIn("Login yoki parol", uz_err.json()['error'])
        self.assertIn('Неверный логин', ru_err.json()['error'])

    def test_student_test_lock_and_detail_bilingual(self):
        cli = Client()
        cli.login(username='std_i18n', password='123')

        ru_list = cli.get('/api/student/tests/', HTTP_X_LANGUAGE='ru')
        self.assertEqual(ru_list.status_code, 200)
        item = ru_list.json()[0]
        self.assertEqual(item['lockReason'], 'admin_not_allowed')
        self.assertIn('Администратор', item['lockMessage'])

        ru_det = cli.get(f'/api/student/tests/{self.test_locked.id}/', HTTP_X_LANGUAGE='ru')
        self.assertEqual(ru_det.status_code, 403)
        self.assertIn('Администратор', ru_det.json()['error'])

    def test_admin_permission_classes_and_coins_bilingual(self):
        cli = Client()
        cli.login(username='adm_i18n', password='123')

        perm_ru = cli.post(
            f'/api/admin/tests/{self.test_locked.id}/permission/',
            {'isStudentAllowed': True},
            content_type='application/json',
            HTTP_X_LANGUAGE='ru',
        )
        self.assertEqual(perm_ru.status_code, 200)
        self.assertIn('открыт', perm_ru.json()['message'])

        cls_ru = cli.get('/api/admin/classes/', HTTP_X_LANGUAGE='ru')
        self.assertEqual(cls_ru.status_code, 200)
        self.assertEqual(cls_ru.json()['summary']['parallelStats'][0]['label'], '9-класс')
        cls_by_name = {c['name']: c for c in cls_ru.json()['classes']}
        self.assertEqual(cls_by_name['9-A']['languageLabel'], 'Узбекский язык')
        self.assertEqual(cls_by_name['9-RU']['languageLabel'], 'Русский язык')

        ranks_ru = cli.get('/api/coins/rankings/', HTTP_X_LANGUAGE='ru')
        self.assertEqual(ranks_ru.status_code, 200)
        labels = [s['label'] for s in ranks_ru.json()['coinSources']]
        self.assertTrue(any('Авто за тест' in l for l in labels))

        award_ru = cli.post(
            '/api/coins/award/',
            {'studentId': self.student_user.id, 'amount': 5, 'reason': 'Активность'},
            content_type='application/json',
            HTTP_X_LANGUAGE='ru',
        )
        self.assertEqual(award_ru.status_code, 200)
        self.assertIn('успешно начислено', award_ru.json()['message'])


class ImporterUnitTests(TestCase):
    def test_normalize_math_text(self):
        self.assertEqual(normalize_math_text(''), '')
        self.assertEqual(normalize_math_text(None), '')
        self.assertEqual(normalize_math_text('sqrt(16)'), r'\sqrt{16}')
        self.assertEqual(normalize_math_text(r'\sqrt(x+1)'), r'\sqrt{x+1}')
        self.assertEqual(normalize_math_text('√25 + √(a+b)'), r'\sqrt{25} + \sqrt{a+b}')

    def test_excel_sample_round_trip(self):
        sample_bytes = generate_sample_excel()
        parsed = parse_questions_from_file(io.BytesIO(sample_bytes), 'namuna.xlsx')
        self.assertEqual(len(parsed), 10)
        self.assertEqual(parsed[0]['correctIndex'], 2)
        self.assertEqual(parsed[0]['options'][2], 'Toshkent')
        self.assertEqual(len(parsed[0]['options']), 4)

    def test_word_sample_round_trip(self):
        sample_bytes = generate_sample_word()
        parsed = parse_questions_from_file(io.BytesIO(sample_bytes), 'namuna.docx')
        self.assertEqual(len(parsed), 13)
        for item in parsed:
            self.assertTrue(item['question'])
            self.assertEqual(len(item['options']), 4)
            self.assertIn(item['correctIndex'], (0, 1, 2, 3))

    def test_unsupported_file_raises_value_error(self):
        with self.assertRaises(ValueError):
            parse_questions_from_file(io.BytesIO(b'not an office doc'), 'bad.txt')


class ViewsHelperUnitTests(TestCase):
    def setUp(self):
        SchoolClass.objects.create(name='9-A', grade_level=9, language='uz')
        SchoolClass.objects.create(name='9-RU', grade_level=9, language='ru')

    def test_parse_bool_and_iso_datetime(self):
        self.assertTrue(core_views._parse_bool_flag(True))
        self.assertTrue(core_views._parse_bool_flag('ha'))
        self.assertTrue(core_views._parse_bool_flag('да'))
        self.assertFalse(core_views._parse_bool_flag('0', default=True))
        self.assertFalse(core_views._parse_bool_flag('нет', default=True))
        self.assertTrue(core_views._parse_bool_flag('unknown', default=True))

        dt = core_views.parse_iso_datetime('2026-11-11T14:30')
        self.assertIsNotNone(dt)
        self.assertTrue(timezone.is_aware(dt))
        self.assertIsNone(core_views.parse_iso_datetime('invalid-date'))

    def test_grade_parsing_matching_and_normalization(self):
        self.assertEqual(core_views.parse_test_grades('Barchasi'), (True, []))
        self.assertEqual(core_views.parse_test_grades('9-A, 9-RU, 9-a'), (False, ['9-A', '9-RU']))
        self.assertTrue(core_views.test_matches_grade('Barchasi', '9-A'))
        self.assertTrue(core_views.test_matches_grade('9-A, 10-A', '9-a'))
        self.assertFalse(core_views.test_matches_grade('9-A', '10-A'))

        self.assertEqual(core_views.normalize_test_grade_value('', ['9-A', '9-RU']), 'Barchasi')
        self.assertEqual(core_views.normalize_test_grade_value('', ['9-A']), '9-A')

    def test_validate_teacher_lesson_activity_reason(self):
        self.assertIsNone(core_views.validate_teacher_lesson_activity_reason('Doskada misolni yechdi', 'uz'))
        self.assertIsNotNone(core_views.validate_teacher_lesson_activity_reason('', 'ru'))
        self.assertIsNotNone(core_views.validate_teacher_lesson_activity_reason('Test natijasi uchun', 'uz'))
        self.assertIsNotNone(core_views.validate_teacher_lesson_activity_reason('За тест и экзамен', 'ru'))


class AuthProfileAndStudentTests(TestCase):
    def setUp(self):
        SchoolClass.objects.create(name='8-A', grade_level=8, language='uz')
        self.admin = CustomUser.objects.create_user(username='adm_auth', password='123', role='admin')
        self.teacher = CustomUser.objects.create_user(username='tch_auth', password='123', role='teacher', subject='Fizika')
        self.student = CustomUser.objects.create_user(username='std_auth', password='123', role='student', full_name='Ali Valiyev', grade='8-A')

    def test_login_role_validation_and_session(self):
        cli = Client()
        # Wrong role
        r_wrong_role = cli.post(
            '/api/auth/login/',
            {'username': 'std_auth', 'password': '123', 'role': 'teacher'},
            content_type='application/json',
        )
        self.assertEqual(r_wrong_role.status_code, 403)
        self.assertFalse(cli.get('/api/auth/me/').json()['authenticated'])

        # Valid login + /api/auth/me/ + logout
        r_ok = cli.post(
            '/api/auth/login/',
            {'username': 'std_auth', 'password': '123', 'role': 'student'},
            content_type='application/json',
        )
        self.assertEqual(r_ok.status_code, 200)
        self.assertEqual(r_ok.json()['user']['username'], 'std_auth')
        self.assertTrue(cli.get('/api/auth/me/').json()['authenticated'])

        cli.post('/api/auth/logout/')
        self.assertFalse(cli.get('/api/auth/me/').json()['authenticated'])

    def test_profile_update_password_and_permission_checks(self):
        cli = Client()
        cli.login(username='std_auth', password='123')

        # Updating another user's profile rejected for non-admin
        r_other = cli.post(
            '/api/profile/update/',
            {'userId': self.teacher.id, 'fullName': 'Hacker'},
            content_type='application/json',
        )
        self.assertEqual(r_other.status_code, 403)

        # Wrong old password rejected
        r_bad_pw = cli.post(
            '/api/profile/update/',
            {'oldPassword': 'wrong', 'newPassword': '456'},
            content_type='application/json',
        )
        self.assertEqual(r_bad_pw.status_code, 400)

        # Duplicate username rejected
        r_dup = cli.post(
            '/api/profile/update/',
            {'username': 'tch_auth'},
            content_type='application/json',
        )
        self.assertEqual(r_dup.status_code, 400)

        # Valid profile & password update works
        r_ok = cli.post(
            '/api/profile/update/',
            {'fullName': 'Ali Yangi', 'oldPassword': '123', 'newPassword': '456'},
            content_type='application/json',
        )
        self.assertEqual(r_ok.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.full_name, 'Ali Yangi')
        self.assertTrue(self.student.check_password('456'))

    def test_admin_create_student_via_formdata_and_json(self):
        cli = Client()
        cli.login(username='adm_auth', password='123')

        r_fd = cli.post('/api/admin/students/', {
            'username': 'new_fd_std',
            'password': '123',
            'fullName': 'FormData Student',
            'grade': '8-A',
            'phone': '+998901112233',
        })
        self.assertEqual(r_fd.status_code, 200)
        self.assertTrue(CustomUser.objects.filter(username='new_fd_std', full_name='FormData Student', role='student').exists())

        r_short_pw = cli.post(
            '/api/admin/students/',
            {'username': 'bad_pw', 'password': '12', 'fullName': 'Bad Pw', 'grade': '8-A'},
            content_type='application/json',
        )
        self.assertEqual(r_short_pw.status_code, 400)

    def test_student_analytics_preserves_zero_percent_average(self):
        test_obj = Test.objects.create(
            title='Zero Score Test',
            teacher=self.teacher,
            subject='Fizika',
            grade='8-A',
            is_student_allowed=True,
        )
        TestResult.objects.create(
            test=test_obj,
            student=self.student,
            total_questions=5,
            correct_answers=0,
            score_percentage=0,
        )
        cli = Client()
        cli.login(username='std_auth', password='123')
        resp = cli.get('/api/student/analytics/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['totalCompleted'], 1)
        self.assertEqual(data['avgScore'], 0)
        self.assertEqual(data['kpis']['avgScore'], 0)


class ContactShowcaseClassApiTests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_user(username='adm_c', password='123', role='admin')
        self.student = CustomUser.objects.create_user(username='std_c', password='123', role='student', grade='9-A')
        self.cls = SchoolClass.objects.create(name='9-A', grade_level=9, language='uz', room='101')

    def test_contact_submit_and_admin_put_delete_lifecycle(self):
        anon = Client()
        r_bad = anon.post('/api/contact/submit/', {'name': 'Ali', 'phone': '123'}, content_type='application/json')
        self.assertEqual(r_bad.status_code, 400)

        r_ok = anon.post(
            '/api/contact/submit/',
            {'fullName': 'Madina Karimova', 'phone': '+998901234567', 'gradeInterest': '9-sinf', 'message': 'Salom'},
            content_type='application/json',
        )
        self.assertEqual(r_ok.status_code, 200)
        msg_id = r_ok.json()['id']

        adm_cli = Client()
        adm_cli.login(username='adm_c', password='123')
        r_put = adm_cli.put(f'/api/admin/contact-messages/?id={msg_id}')
        self.assertEqual(r_put.status_code, 200)
        self.assertTrue(r_put.json()['isContacted'])

        r_list = adm_cli.get('/api/admin/contact-messages/')
        self.assertEqual(r_list.status_code, 200)
        self.assertEqual(r_list.json()['contactedCount'], 1)

        r_del = adm_cli.delete(f'/api/admin/contact-messages/?id={msg_id}')
        self.assertEqual(r_del.status_code, 200)
        self.assertFalse(ContactMessage.objects.filter(id=msg_id).exists())

    def test_showcase_includes_image_and_json_delete(self):
        tal = TalentedStudent.objects.create(
            name='Sarvar Olimov',
            grade='9-A',
            achievement='Oltin medal',
            photo_url='https://example.com/sarvar.png',
        )
        cli = Client()
        showcase = cli.get('/api/diamond/showcase/')
        self.assertEqual(showcase.status_code, 200)
        students = showcase.json()['talentedStudents']
        found = [s for s in students if s['id'] == tal.id]
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]['image'], 'https://example.com/sarvar.png')
        self.assertEqual(found[0]['photo'], 'https://example.com/sarvar.png')

        # Student cannot delete showcase
        cli.login(username='std_c', password='123')
        self.assertEqual(
            cli.post('/api/admin/showcase/delete/', {'type': 'student', 'id': tal.id}, content_type='application/json').status_code,
            403,
        )

        # Admin can delete showcase via JSON
        cli.login(username='adm_c', password='123')
        r_del = cli.post('/api/admin/showcase/delete/', {'type': 'student', 'id': tal.id}, content_type='application/json')
        self.assertEqual(r_del.status_code, 200)
        self.assertFalse(TalentedStudent.objects.filter(id=tal.id).exists())

    def test_class_put_update_and_site_settings(self):
        adm = Client()
        adm.login(username='adm_c', password='123')

        r_put = adm.put(
            f'/api/admin/classes/{self.cls.id}/',
            {'name': '9-A', 'grade_level': 9, 'language': 'uz', 'room': '305-kabinet', 'head_teacher': 'Aziza'},
            content_type='application/json',
        )
        self.assertEqual(r_put.status_code, 200)
        self.cls.refresh_from_db()
        self.assertEqual(self.cls.room, '305-kabinet')
        self.assertEqual(self.cls.head_teacher, 'Aziza')

        r_set = adm.post(
            '/api/admin/site-settings/',
            {'statStudents': '2,000+', 'addressRu': 'г. Ташкент, тест адрес'},
            content_type='application/json',
        )
        self.assertEqual(r_set.status_code, 200)
        self.assertEqual(adm.get('/api/admin/site-settings/').json()['statStudents'], '2,000+')


class TestBuilderAndRewardFlowTests(TestCase):
    def setUp(self):
        SchoolClass.objects.create(name='10-A', grade_level=10, language='uz')
        SchoolClass.objects.create(name='10-B', grade_level=10, language='uz')
        self.admin = CustomUser.objects.create_user(username='adm_tb', password='123', role='admin')
        self.teacher = CustomUser.objects.create_user(username='tch_tb', password='123', role='teacher', subject='Matematika')
        self.s1 = CustomUser.objects.create_user(username='s1_10a', password='123', role='student', grade='10-A', coins=0)
        self.s2 = CustomUser.objects.create_user(username='s2_10a', password='123', role='student', grade='10-A', coins=0)
        self.s3 = CustomUser.objects.create_user(username='s3_10a', password='123', role='student', grade='10-A', coins=0)
        self.s_other = CustomUser.objects.create_user(username='s_10b', password='123', role='student', grade='10-B', coins=0)

    def test_create_test_with_immediate_and_top_n_rewards(self):
        adm = Client()
        adm.login(username='adm_tb', password='123')

        create_resp = adm.post(
            '/api/teacher/tests/',
            {
                'title': 'Top-N Algebra',
                'subject': 'Matematika',
                'targetClasses': ['10-A'],
                'language': 'uz',
                'durationMinutes': 20,
                'maxAttempts': 2,
                'rewardTopCount': 2,
                'rewardCoinsAmount': 15,
                'rewardMinScore': 50,
                'immediateReward': {
                    'enabled': True,
                    'studentIds': [self.s1.id],
                    'amount': 20,
                    'reason': 'Faol tayyorgarlik',
                },
                'questions': [
                    {'question': '3 * 3 = ?', 'options': ['6', '9', '12', '3'], 'correctIndex': 1},
                ],
            },
            content_type='application/json',
        )
        self.assertEqual(create_resp.status_code, 200)
        cdata = create_resp.json()
        test_id = cdata['testId']
        self.assertFalse(cdata['isStudentAllowed'])
        self.assertEqual(cdata['immediateRewardedCount'], 1)
        self.s1.refresh_from_db()
        self.assertEqual(self.s1.coins, 20)
        self.assertTrue(CoinTransaction.objects.filter(student=self.s1, portal='test_create', amount=20).exists())

        # Admin opens permission for students
        adm.post(f'/api/admin/tests/{test_id}/permission/', {'isStudentAllowed': True}, content_type='application/json')

        test_obj = Test.objects.get(id=test_id)
        q = test_obj.questions.first()
        correct_opt = q.options.get(is_correct=True)

        # Grade isolation: 10-B cannot submit 10-A test
        cli_other = Client()
        cli_other.login(username='s_10b', password='123')
        r_wrong_grade = cli_other.post(
            f'/api/student/tests/{test_id}/submit/',
            {'answers': {str(q.id): correct_opt.id}, 'timeSpentSeconds': 10},
            content_type='application/json',
        )
        self.assertEqual(r_wrong_grade.status_code, 403)

        # s1 submits attempt 1 -> +50 base +15 bonus (rank 1)
        cli1 = Client()
        cli1.login(username='s1_10a', password='123')
        r1 = cli1.post(
            f'/api/student/tests/{test_id}/submit/',
            {'answers': {str(q.id): correct_opt.id}, 'timeSpentSeconds': 12},
            content_type='application/json',
        )
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.json()['bonusCoinsEarned'], 15)
        self.assertEqual(r1.json()['bonusSlotRank'], 1)
        self.assertEqual(StudentAnswer.objects.filter(result__student=self.s1).count(), 1)

        # s1 submits attempt 2 -> should NOT receive duplicate Top-N bonus
        r1_second = cli1.post(
            f'/api/student/tests/{test_id}/submit/',
            {'answers': {str(q.id): correct_opt.id}, 'timeSpentSeconds': 8},
            content_type='application/json',
        )
        self.assertEqual(r1_second.status_code, 200)
        self.assertEqual(r1_second.json()['bonusCoinsEarned'], 0)

        # s1 attempt 3 -> blocked by max_attempts=2
        r1_third = cli1.post(
            f'/api/student/tests/{test_id}/submit/',
            {'answers': {str(q.id): correct_opt.id}, 'timeSpentSeconds': 5},
            content_type='application/json',
        )
        self.assertEqual(r1_third.status_code, 403)

        # s2 gets rank 2 bonus (+15)
        cli2 = Client()
        cli2.login(username='s2_10a', password='123')
        r2 = cli2.post(
            f'/api/student/tests/{test_id}/submit/',
            {'answers': {str(q.id): correct_opt.id}, 'timeSpentSeconds': 15},
            content_type='application/json',
        )
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json()['bonusCoinsEarned'], 15)
        self.assertEqual(r2.json()['bonusSlotRank'], 2)

        # s3 submits -> slots full, no Top-N bonus
        cli3 = Client()
        cli3.login(username='s3_10a', password='123')
        r3 = cli3.post(
            f'/api/student/tests/{test_id}/submit/',
            {'answers': {str(q.id): correct_opt.id}, 'timeSpentSeconds': 9},
            content_type='application/json',
        )
        self.assertEqual(r3.status_code, 200)
        self.assertEqual(r3.json()['bonusCoinsEarned'], 0)


class TeacherRestrictionsTests(TestCase):
    def setUp(self):
        SchoolClass.objects.create(name='7-A', grade_level=7, language='uz')
        SchoolClass.objects.create(name='7-B', grade_level=7, language='uz')
        self.admin = CustomUser.objects.create_user(username='adm_tr', password='123', role='admin')
        self.teacher1 = CustomUser.objects.create_user(username='tch_1', password='123', role='teacher', subject='Kimyo')
        self.teacher2 = CustomUser.objects.create_user(username='tch_2', password='123', role='teacher', subject='Fizika')
        self.st_7a = CustomUser.objects.create_user(username='st_7a', password='123', role='student', grade='7-A', coins=0)
        self.st_7b = CustomUser.objects.create_user(username='st_7b', password='123', role='student', grade='7-B', coins=0)
        self.test_t2 = Test.objects.create(title='Teacher2 Only', teacher=self.teacher2, subject='Fizika', grade='7-A')

    def test_teacher_cannot_view_other_teacher_test_or_import_or_distribute(self):
        cli = Client()
        cli.login(username='tch_1', password='123')

        self.assertEqual(cli.get(f'/api/teacher/tests/{self.test_t2.id}/').status_code, 403)
        self.assertEqual(cli.get(f'/api/teacher/tests/{self.test_t2.id}/participants/').status_code, 403)
        self.assertEqual(cli.post(f'/api/teacher/tests/{self.test_t2.id}/distribute-coins/', {'mode': 'all'}, content_type='application/json').status_code, 403)
        self.assertEqual(
            cli.post('/api/teacher/tests/', {'title': 'Tch Create', 'questions': [{'question': 'q', 'options': ['a', 'b'], 'correctIndex': 0}]}, content_type='application/json').status_code,
            403,
        )
        fake_xlsx = SimpleUploadedFile('t.xlsx', generate_sample_excel(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        self.assertEqual(cli.post('/api/teacher/import-questions/', {'file': fake_xlsx}).status_code, 403)

    def test_teacher_coin_daily_limits_edit_and_delete_blocked(self):
        cli = Client()
        cli.login(username='tch_1', password='123')

        # Non-lesson reason rejected
        r_bad_reason = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7a.id, 'amount': 2, 'reason': 'Test natijasi uchun'},
            content_type='application/json',
        )
        self.assertEqual(r_bad_reason.status_code, 403)

        # Valid lesson activity +3 then +2 to 7-A (total 5)
        r_ok1 = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7a.id, 'amount': 3, 'reason': 'Doskada misol yechdi'},
            content_type='application/json',
        )
        self.assertEqual(r_ok1.status_code, 200)
        r_ok2 = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7a.id, 'amount': 2, 'reason': 'Savol-javobda faol'},
            content_type='application/json',
        )
        self.assertEqual(r_ok2.status_code, 200)

        # Exceeding 5 coins/day in 7-A blocked
        r_limit = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7a.id, 'amount': 1, 'reason': 'Darsda faol qatnashdi'},
            content_type='application/json',
        )
        self.assertEqual(r_limit.status_code, 403)

        # Different class 7-B has its own 5-coin daily allowance
        r_7b = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7b.id, 'amount': 4, 'reason': 'Darsdagi faollik'},
            content_type='application/json',
        )
        self.assertEqual(r_7b.status_code, 200)

        # Teacher can edit own tx downwards/within limit, not over limit or with forbidden reason
        tx = CoinTransaction.objects.filter(given_by=self.teacher1, student=self.st_7b).first()
        r_edit_bad = cli.post(
            f'/api/teacher/coins/{tx.id}/edit/',
            {'amount': 4, 'reason': 'Imtihon uchun'},
            content_type='application/json',
        )
        self.assertEqual(r_edit_bad.status_code, 403)

        r_edit_over = cli.post(
            f'/api/teacher/coins/{tx.id}/edit/',
            {'amount': 6, 'reason': 'Darsda faol'},
            content_type='application/json',
        )
        self.assertEqual(r_edit_over.status_code, 403)

        r_edit_ok = cli.post(
            f'/api/teacher/coins/{tx.id}/edit/',
            {'amount': 2, 'reason': 'Darsda faol qatnashdi'},
            content_type='application/json',
        )
        self.assertEqual(r_edit_ok.status_code, 200)
        self.st_7b.refresh_from_db()
        self.assertEqual(self.st_7b.coins, 2)

        # Teacher delete coin transaction is always 403
        r_del = cli.post(f'/api/teacher/coins/{tx.id}/delete/')
        self.assertEqual(r_del.status_code, 403)

    def test_teacher_coin_deduct_workflow_and_guardrails(self):
        cli = Client()
        cli.login(username='tch_1', password='123')

        # Give st_7a some starting coins and also consume teacher's +5 positive quota for 7-A
        self.st_7a.coins = 7
        self.st_7a.save(update_fields=['coins'])
        r_cap = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7a.id, 'amount': 5, 'reason': 'Darsda juda faol qatnashdi'},
            content_type='application/json',
        )
        self.assertEqual(r_cap.status_code, 200)
        self.st_7a.refresh_from_db()
        self.assertEqual(self.st_7a.coins, 12)

        # Forbidden reason still blocked on deduction
        r_bad_reason = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7a.id, 'amount': -2, 'reason': 'Test natijasi yomon'},
            content_type='application/json',
        )
        self.assertEqual(r_bad_reason.status_code, 403)

        # Exceeding -5 per deduction blocked
        r_over_deduct = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7a.id, 'amount': -6, 'reason': 'Dars intizomini buzdi'},
            content_type='application/json',
        )
        self.assertEqual(r_over_deduct.status_code, 403)

        # Whole-class deduction blocked for teachers
        r_batch_deduct = cli.post(
            '/api/coins/award/',
            {'className': '7-A', 'amount': -2, 'reason': 'Dars intizomini buzdi'},
            content_type='application/json',
        )
        self.assertEqual(r_batch_deduct.status_code, 403)

        # Valid single-student deduction works EVEN WHEN today's +5 positive quota is exhausted
        r_deduct = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7a.id, 'amount': -3, 'reason': 'Dars intizomini buzgani uchun'},
            content_type='application/json',
        )
        self.assertEqual(r_deduct.status_code, 200)
        self.assertEqual(r_deduct.json()['coins'], 9)
        self.assertEqual(r_deduct.json()['amountAwarded'], -3)
        # Positive daily quota remains 0/5 remaining (deduction does not refund positive cap!)
        self.assertEqual(r_deduct.json()['dailyCoinStatus']['coinsUsedToday'], 5)
        self.assertEqual(r_deduct.json()['dailyCoinStatus']['coinsRemainingToday'], 0)

        # Cannot deduct positive again today for 7-A after deduction
        r_after_pos = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7a.id, 'amount': 1, 'reason': 'Darsda faol'},
            content_type='application/json',
        )
        self.assertEqual(r_after_pos.status_code, 403)

        # Deduction works when balance goes low, and prevents going negative (balance=2, try -4 -> 400)
        self.st_7b.coins = 2
        self.st_7b.save(update_fields=['coins'])
        r_underflow = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7b.id, 'amount': -4, 'reason': 'Dars intizomini buzdi'},
            content_type='application/json',
        )
        self.assertEqual(r_underflow.status_code, 400)
        self.st_7b.refresh_from_db()
        self.assertEqual(self.st_7b.coins, 2)

        # History endpoint exposes deduction badge & canEdit=True
        r_hist = cli.get(f'/api/teacher/coins/history/?grade=7-A')
        self.assertEqual(r_hist.status_code, 200)
        deduct_txs = [item for item in r_hist.json()['history'] if item['amount'] == -3]
        self.assertEqual(len(deduct_txs), 1)
        self.assertTrue(deduct_txs[0]['canEdit'])
        self.assertIn('🔻', deduct_txs[0]['categoryBadge'])

        # Teacher can edit negative tx between -1 and -5, cannot turn positive or exceed -5
        tx_id = deduct_txs[0]['id']
        self.assertEqual(
            cli.post(f'/api/teacher/coins/{tx_id}/edit/', {'amount': 2, 'reason': 'Darsda faol'}, content_type='application/json').status_code,
            403,
        )
        self.assertEqual(
            cli.post(f'/api/teacher/coins/{tx_id}/edit/', {'amount': -6, 'reason': 'Dars intizomini buzdi'}, content_type='application/json').status_code,
            403,
        )
        r_edit_ok = cli.post(
            f'/api/teacher/coins/{tx_id}/edit/',
            {'amount': -2, 'reason': "Darsda telefonda chalg'igani uchun"},
            content_type='application/json',
        )
        self.assertEqual(r_edit_ok.status_code, 200)
        self.st_7a.refresh_from_db()
        self.assertEqual(self.st_7a.coins, 10)  # 12 - 3 -> edited to 12 - 2 = 10

    def test_teacher_coin_hourly_rolling_limit(self):
        cli = Client()
        cli.login(username='tch_1', password='123')

        # 1. Give 5 coins to 7-A
        r1 = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7a.id, 'amount': 5, 'reason': 'Darsda juda faol'},
            content_type='application/json',
        )
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.json()['dailyCoinStatus']['coinsRemainingToday'], 0)
        self.assertEqual(r1.json()['dailyCoinStatus']['coinsRemainingThisHour'], 0)
        self.assertGreater(r1.json()['dailyCoinStatus']['cooldownMinutesLeft'], 0)

        # 2. Blocked within the hour for 7-A
        r_blocked = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7a.id, 'amount': 1, 'reason': 'Yana doskaga chiqdi'},
            content_type='application/json',
        )
        self.assertEqual(r_blocked.status_code, 403)
        self.assertIn('Soatlik limit', r_blocked.json()['error'])

        # 3. Class 7-B is still available right now (independent class limit)
        r_7b = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7b.id, 'amount': 5, 'reason': 'Darsda faol'},
            content_type='application/json',
        )
        self.assertEqual(r_7b.status_code, 200)

        # 4. Simulate 1 hour and 5 minutes passing by updating tx.created_at to 65 mins ago
        past_time = timezone.now() - timedelta(minutes=65)
        CoinTransaction.objects.filter(student=self.st_7a, given_by=self.teacher1).update(created_at=past_time)

        # 5. Now 7-A has 5 coins available again!
        r_next_hour = cli.post(
            '/api/coins/award/',
            {'studentId': self.st_7a.id, 'amount': 5, 'reason': 'Keyingi darsda juda faol'},
            content_type='application/json',
        )
        self.assertEqual(r_next_hour.status_code, 200)
        self.assertEqual(r_next_hour.json()['dailyCoinStatus']['coinsRemainingThisHour'], 0)

    def test_admin_test_create_detail_edit_and_delete_workflow(self):
        adm = Client()
        adm.login(username='adm_tr', password='123')

        create_payload = {
            'title': 'Admin New Test Workflow',
            'subject': 'Matematika',
            'language': 'uz',
            'targetClasses': ['7-A'],
            'durationMinutes': 25,
            'maxAttempts': 2,
            'isStudentAllowed': True,
            'teacherId': self.teacher1.id,
            'questions': [
                {'question': '2 + 2 = ?', 'options': ['3', '4', '5', '6'], 'correctIndex': 1},
                {'question': '3 * 3 = ?', 'options': ['6', '9', '12', '15'], 'correctIndex': 1},
            ],
        }
        r_create = adm.post('/api/teacher/tests/', create_payload, content_type='application/json')
        self.assertEqual(r_create.status_code, 200)
        test_id = r_create.json()['testId']

        r_detail = adm.get(f'/api/teacher/tests/{test_id}/')
        self.assertEqual(r_detail.status_code, 200)
        detail = r_detail.json()
        self.assertEqual(detail['title'], 'Admin New Test Workflow')
        self.assertFalse(detail['isAllClasses'])
        self.assertEqual(detail['targetClasses'], ['7-A'])
        self.assertEqual(len(detail['questions']), 2)

        update_payload = {
            **create_payload,
            'title': 'Admin Updated Test Workflow',
            'grade': 'Barchasi',
            'targetClasses': ['7-A', '7-B'],
            'questions': [
                {'question': '5 + 5 = ?', 'options': ['8', '10', '11', '12'], 'correctIndex': 1},
            ],
        }
        r_upd = adm.put(f'/api/teacher/tests/{test_id}/', update_payload, content_type='application/json')
        self.assertEqual(r_upd.status_code, 200)

        r_detail2 = adm.get(f'/api/teacher/tests/{test_id}/')
        self.assertEqual(r_detail2.status_code, 200)
        detail2 = r_detail2.json()
        self.assertEqual(detail2['title'], 'Admin Updated Test Workflow')
        self.assertTrue(detail2['isAllClasses'])
        self.assertEqual(detail2['grade'], 'Barchasi')
        self.assertEqual(len(detail2['questions']), 1)

        r_del = adm.delete(f'/api/teacher/tests/{test_id}/')
        self.assertEqual(r_del.status_code, 200)
        self.assertFalse(Test.objects.filter(id=test_id).exists())


class AdminCoinAndRankingTests(TestCase):
    def setUp(self):
        self.cls = SchoolClass.objects.create(name='11-A', grade_level=11, language='uz')
        self.admin = CustomUser.objects.create_user(username='adm_rank', password='123', role='admin')
        self.teacher = CustomUser.objects.create_user(username='tch_rank', password='123', role='teacher')
        self.s_active = CustomUser.objects.create_user(username='st_act', password='123', role='student', grade='11-A', coins=0)
        self.s_idle = CustomUser.objects.create_user(username='st_idle', password='123', role='student', grade='11-A', coins=0)
        test_obj = Test.objects.create(title='Rank Test', teacher=self.teacher, subject='Tarix', grade='11-A')
        self.res = TestResult.objects.create(test=test_obj, student=self.s_active, total_questions=10, correct_answers=9, score_percentage=90)

    def test_admin_batch_class_only_and_class_and_active_awards(self):
        adm = Client()
        adm.login(username='adm_rank', password='123')

        # 1. Batch selected students
        r_batch = adm.post(
            '/api/coins/award/',
            {'studentIds': [self.s_active.id, self.s_idle.id], 'amount': 5, 'reason': 'Faol guruh'},
            content_type='application/json',
        )
        self.assertEqual(r_batch.status_code, 200)
        self.assertEqual(r_batch.json()['count'], 2)

        # 2. Class fund only
        r_cls = adm.post(
            '/api/coins/award/',
            {'className': '11-A', 'awardScope': 'class_only', 'classAmount': 25, 'reason': 'Faol sinf'},
            content_type='application/json',
        )
        self.assertEqual(r_cls.status_code, 200)
        self.cls.refresh_from_db()
        self.assertEqual(self.cls.bonus_coins, 25)

        # 3. Class + active students only (s_idle has no test result, so only s_active gets student coin)
        r_both = adm.post(
            '/api/coins/award/',
            {'className': '11-A', 'awardScope': 'class_and_active', 'classAmount': 10, 'amount': 7, 'reason': 'Oylik faollik'},
            content_type='application/json',
        )
        self.assertEqual(r_both.status_code, 200)
        self.assertEqual(r_both.json()['count'], 1)
        self.cls.refresh_from_db()
        self.s_active.refresh_from_db()
        self.s_idle.refresh_from_db()
        self.assertEqual(self.cls.bonus_coins, 35)
        self.assertEqual(self.s_active.coins, 12)
        self.assertEqual(self.s_idle.coins, 5)

    def test_coin_rankings_classifies_sources_and_admin_test_reward(self):
        CoinTransaction.objects.create(student=self.s_active, given_by=None, amount=20, reason='Auto', test_result=self.res, portal='test_score')
        CoinTransaction.objects.create(student=self.s_active, given_by=self.admin, amount=15, reason='Reward', test_result=self.res, portal='admin_test_reward')
        CoinTransaction.objects.create(student=self.s_active, given_by=self.admin, amount=10, reason='Create', portal='test_create')
        CoinTransaction.objects.create(student=self.s_active, given_by=self.teacher, amount=3, reason='Darsda faol', portal='teacher')
        CoinTransaction.objects.create(student=self.s_active, given_by=self.admin, amount=8, reason='Admin student', portal='admin')
        ClassCoinTransaction.objects.create(school_class=self.cls, given_by=self.admin, amount=30, reason='Class fund')

        adm = Client()
        adm.login(username='adm_rank', password='123')
        resp = adm.get('/api/coins/rankings/')
        self.assertEqual(resp.status_code, 200)
        buckets = {item['key']: item for item in resp.json()['coinSources']}
        self.assertEqual(buckets['test_auto']['coins'], 20)
        self.assertEqual(buckets['test_manual']['coins'], 25)  # 15 (admin_test_reward) + 10 (test_create)
        self.assertEqual(buckets['teacher_lesson']['coins'], 3)
        self.assertEqual(buckets['admin_students']['coins'], 8)
        self.assertEqual(buckets['admin_class']['coins'], 30)


class SubdomainRoutingTests(TestCase):
    def test_root_routes_render_expected_portal_mode_by_host(self):
        import json as py_json
        import re as py_re

        cli = Client()
        cases = [
            ('app.diamondschool.uz', 'main'),
            ('admin.diamondschool.uz', 'admin'),
            ('teacher.diamondschool.uz', 'teacher'),
            ('tutor.diamondschool.uz', 'tutor'),
            ('student.diamondschool.uz', 'student'),
            ('127.0.0.1', 'main'),
        ]
        for host, expected_mode in cases:
            resp = cli.get('/', HTTP_HOST=host)
            self.assertEqual(resp.status_code, 200, f'Unexpected status for {host}')
            vary_tokens = [v.strip().lower() for v in (resp.headers.get('Vary') or '').split(',') if v.strip()]
            self.assertIn('host', vary_tokens)
            match = py_re.search(
                r'<script id="diamond-spa-config" type="application/json">(.*?)</script>',
                resp.content.decode('utf-8'),
                py_re.DOTALL,
            )
            self.assertIsNotNone(match, f'Missing diamond-spa-config script on {host}')
            cfg = py_json.loads(match.group(1))
            self.assertEqual(cfg['portalMode'], expected_mode)
            self.assertEqual(cfg['portalUrls']['admin'], 'http://admin.diamondschool.uz')

    def test_portal_subpaths_normalize_to_root_and_preserve_query(self):
        cli = Client()

        r_admin = cli.get('/admin-panel/?tab=tests', HTTP_HOST='admin.diamondschool.uz')
        self.assertEqual(r_admin.status_code, 302)
        self.assertEqual(r_admin.headers['Location'], '/?tab=tests')

        r_cross = cli.get('/student/', HTTP_HOST='admin.diamondschool.uz')
        self.assertEqual(r_cross.status_code, 302)
        self.assertEqual(r_cross.headers['Location'], '/')

        r_teacher = cli.get('/teacher/?tab=coins', HTTP_HOST='teacher.diamondschool.uz')
        self.assertEqual(r_teacher.status_code, 302)
        self.assertEqual(r_teacher.headers['Location'], '/?tab=coins')

        r_student = cli.get('/student/extra/path/', HTTP_HOST='student.diamondschool.uz')
        self.assertEqual(r_student.status_code, 302)
        self.assertEqual(r_student.headers['Location'], '/')

    def test_section_redirects_and_spa_fallback_behavior(self):
        cli = Client()

        r_sec_sub = cli.get('/teachers/', HTTP_HOST='student.diamondschool.uz', HTTP_X_FORWARDED_PROTO='https')
        self.assertEqual(r_sec_sub.status_code, 302)
        self.assertEqual(r_sec_sub.headers['Location'], 'https://app.diamondschool.uz/#teachers-section')

        r_sec_main = cli.get('/contact/', HTTP_HOST='app.diamondschool.uz')
        self.assertEqual(r_sec_main.status_code, 302)
        self.assertEqual(r_sec_main.headers['Location'], '/#contact-section')

        r_sub_fallback = cli.get('/some-client-route', HTTP_HOST='teacher.diamondschool.uz')
        self.assertEqual(r_sub_fallback.status_code, 200)
        self.assertIn(b'"portalMode": "teacher"', r_sub_fallback.content)

        r_main_unknown = cli.get('/some-unknown-route', HTTP_HOST='app.diamondschool.uz')
        self.assertEqual(r_main_unknown.status_code, 404)

    def test_api_meta_works_across_all_portal_subdomains(self):
        cli = Client()
        for host in ('app.diamondschool.uz', 'admin.diamondschool.uz', 'teacher.diamondschool.uz', 'student.diamondschool.uz'):
            resp = cli.get('/api/meta/', HTTP_HOST=host)
            self.assertEqual(resp.status_code, 200, f'/api/meta/ failed for {host}')
            self.assertIn('classes', resp.json())
            self.assertIn('subjects', resp.json())

    def test_optional_main_domain_redirect_flag(self):
        cli = Client()
        # Default False keeps app.diamondschool.uz/admin-panel/ working until DNS is ready
        r_disabled = cli.get('/admin-panel/', HTTP_HOST='app.diamondschool.uz')
        self.assertEqual(r_disabled.status_code, 200)

        with self.settings(REDIRECT_MAIN_PORTAL_PATHS_TO_SUBDOMAINS=True):
            r_enabled = cli.get('/admin-panel/?tab=tests', HTTP_HOST='app.diamondschool.uz', HTTP_X_FORWARDED_PROTO='https')
            self.assertEqual(r_enabled.status_code, 302)
            self.assertEqual(r_enabled.headers['Location'], 'https://admin.diamondschool.uz/?tab=tests')


class TutorPortalAndClassCoinsTests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_user(
            username='admin_tut',
            password='123',
            role='admin',
            full_name='Bosh Administrator',
        )
        self.teacher = CustomUser.objects.create_user(
            username='teacher_tut',
            password='123',
            role='teacher',
            full_name='Ustoz Vali',
            subject='Matematika',
        )
        self.class_a = SchoolClass.objects.create(name='7-A', grade_level=7, language='uz')
        self.class_b = SchoolClass.objects.create(name='7-B', grade_level=7, language='uz')
        self.outside_student = CustomUser.objects.create_user(
            username='out_stud',
            password='123',
            role='student',
            full_name='Tashqi Oquvchi',
            grade='7-B',
        )

    def _login(self, client, username, password, role):
        return client.post(
            '/api/auth/login/',
            data=json.dumps({'username': username, 'password': password, 'role': role}),
            content_type='application/json',
        )

    def test_admin_creates_tutor_assigns_class_and_class_coins_credit_tutor(self):
        cli = Client()
        self.assertEqual(self._login(cli, 'admin_tut', '123', 'admin').status_code, 200)

        # Admin creates tutor assigned to 7-A
        res = cli.post(
            '/api/admin/tutors/',
            data=json.dumps({
                'username': 'madina_tyuter',
                'password': '123',
                'fullName': 'Madina Tyuter',
                'phone': '+998901234567',
                'assignedClasses': ['7-A'],
            }),
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 200)
        tutor_id = res.json()['tutorId']
        self.class_a.refresh_from_db()
        self.assertEqual(self.class_a.tutor_id, tutor_id)

        # Tutor can log in with role='tutor', rejected with role='teacher'
        t_cli = Client()
        self.assertEqual(self._login(t_cli, 'madina_tyuter', '123', 'teacher').status_code, 403)
        self.assertEqual(self._login(t_cli, 'madina_tyuter', '123', 'tutor').status_code, 200)

        # Student in 7-A created by tutor
        s_res = t_cli.post(
            '/api/tutor/students/',
            data=json.dumps({
                'fullName': 'Jasur 7A',
                'username': 'jasur_7a',
                'password': '123',
                'grade': '7-A',
            }),
            content_type='application/json',
        )
        self.assertEqual(s_res.status_code, 200)
        stud_id = s_res.json()['studentId']

        # Admin awards +30 coins to class 7-A (class_only) -> credits class bonus AND tutor wallet
        aw1 = cli.post(
            '/api/coins/award/',
            data=json.dumps({
                'className': '7-A',
                'awardScope': 'class_only',
                'amount': 30,
                'reason': 'Hafta sinfi',
            }),
            content_type='application/json',
        )
        self.assertEqual(aw1.status_code, 200)
        self.assertEqual(aw1.json()['tutorCoins'], 30)

        # Admin awards +20 coins with class_and_active (no active submissions yet, still credits class + tutor)
        aw2 = cli.post(
            '/api/coins/award/',
            data=json.dumps({
                'className': '7-A',
                'awardScope': 'class_and_active',
                'amount': 20,
                'reason': 'Faol sinf',
            }),
            content_type='application/json',
        )
        self.assertEqual(aw2.status_code, 200)

        tutor_obj = CustomUser.objects.get(id=tutor_id)
        self.class_a.refresh_from_db()
        self.assertEqual(self.class_a.bonus_coins, 50)
        self.assertEqual(tutor_obj.coins, 50)
        self.assertEqual(ClassCoinTransaction.objects.filter(tutor=tutor_obj).count(), 2)

        # Tutor dashboard reflects 50 coins & student list & coinHistory
        dash = t_cli.get('/api/tutor/dashboard/')
        self.assertEqual(dash.status_code, 200)
        dj = dash.json()
        self.assertEqual(dj['summary']['tutorCoins'], 50)
        self.assertEqual(len(dj['coinHistory']), 2)
        self.assertTrue(any(s['id'] == stud_id for s in dj['students']))

        # Admin coin rankings include tutorRankings & tutor name on class stats
        rankings = cli.get('/api/coins/rankings/')
        self.assertEqual(rankings.status_code, 200)
        rj = rankings.json()
        self.assertTrue(any(t['id'] == tutor_id and t['coins'] == 50 for t in rj['tutorRankings']))

    def test_tutor_student_crud_scoping_and_teacher_read_only_enforcement(self):
        tutor = CustomUser.objects.create_user(
            username='tut_scope',
            password='123',
            role='tutor',
            full_name='Tyuter Scope',
        )
        self.class_a.tutor = tutor
        self.class_a.save(update_fields=['tutor'])

        t_cli = Client()
        self.assertEqual(self._login(t_cli, 'tut_scope', '123', 'tutor').status_code, 200)

        # Tutor creates student in assigned class 7-A -> OK
        create_ok = t_cli.post(
            '/api/tutor/students/',
            data=json.dumps({
                'fullName': 'Ali 7A',
                'username': 'ali_7a',
                'password': '123',
                'grade': '7-A',
                'phone': '+998901111111',
            }),
            content_type='application/json',
        )
        self.assertEqual(create_ok.status_code, 200)
        ali_id = create_ok.json()['studentId']

        # Tutor cannot create student in unassigned class 7-B -> 403
        create_bad = t_cli.post(
            '/api/tutor/students/',
            data=json.dumps({
                'fullName': 'Vali 7B',
                'username': 'vali_7b',
                'password': '123',
                'grade': '7-B',
            }),
            content_type='application/json',
        )
        self.assertEqual(create_bad.status_code, 403)

        # Tutor updates student in 7-A -> OK, but cannot move student to 7-B -> 403
        upd_ok = t_cli.put(
            f'/api/tutor/students/{ali_id}/',
            data=json.dumps({'fullName': 'Ali Karimov', 'phone': '+998902222222'}),
            content_type='application/json',
        )
        self.assertEqual(upd_ok.status_code, 200)
        self.assertEqual(CustomUser.objects.get(id=ali_id).full_name, 'Ali Karimov')

        upd_bad_grade = t_cli.put(
            f'/api/tutor/students/{ali_id}/',
            data=json.dumps({'grade': '7-B'}),
            content_type='application/json',
        )
        self.assertEqual(upd_bad_grade.status_code, 403)

        # Tutor cannot edit or delete student in 7-B -> 403
        self.assertEqual(
            t_cli.put(
                f'/api/tutor/students/{self.outside_student.id}/',
                data=json.dumps({'fullName': 'Hacked'}),
                content_type='application/json',
            ).status_code,
            403,
        )
        self.assertEqual(t_cli.delete(f'/api/tutor/students/{self.outside_student.id}/').status_code, 403)

        # Teacher can READ students (read-only) but gets 403 on all add/edit/delete endpoints
        tch_cli = Client()
        self.assertEqual(self._login(tch_cli, 'teacher_tut', '123', 'teacher').status_code, 200)

        read_students = tch_cli.get('/api/teacher/class-students/?grade=all&portal=teacher')
        self.assertEqual(read_students.status_code, 200)
        names = [s['username'] for s in read_students.json()['students']]
        self.assertIn('ali_7a', names)
        self.assertIn('out_stud', names)

        # Teacher blocked from tutor and admin student write/manage routes
        self.assertEqual(tch_cli.get('/api/tutor/students/').status_code, 403)
        self.assertEqual(
            tch_cli.post(
                '/api/tutor/students/',
                data=json.dumps({'fullName': 'X', 'username': 'x1', 'password': '123', 'grade': '7-A'}),
                content_type='application/json',
            ).status_code,
            403,
        )
        self.assertEqual(
            tch_cli.put(
                f'/api/tutor/students/{ali_id}/',
                data=json.dumps({'fullName': 'No'}),
                content_type='application/json',
            ).status_code,
            403,
        )
        self.assertEqual(tch_cli.delete(f'/api/tutor/students/{ali_id}/').status_code, 403)
        self.assertEqual(
            tch_cli.post(
                '/api/admin/students/',
                data=json.dumps({'fullName': 'X', 'username': 'x2', 'password': '123', 'grade': '7-A'}),
                content_type='application/json',
            ).status_code,
            403,
        )
        self.assertEqual(tch_cli.delete(f'/api/admin/users/{ali_id}/').status_code, 403)

        # Tutor deletes student in 7-A -> OK
        del_ok = t_cli.delete(f'/api/tutor/students/{ali_id}/')
        self.assertEqual(del_ok.status_code, 200)
        self.assertFalse(CustomUser.objects.filter(id=ali_id).exists())

    def test_admin_controls_tutor_credentials_and_active_status(self):
        adm = Client()
        self.assertEqual(self._login(adm, 'admin_tut', '123', 'admin').status_code, 200)

        # Admin creates tutor with specific credentials
        res = adm.post(
            '/api/admin/tutors/',
            data=json.dumps({
                'username': 'ctrl_tutor',
                'password': 'init_pw_99',
                'fullName': 'Nazorat Tyuter',
                'assignedClasses': ['7-A'],
            }),
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 200)
        tutor_id = res.json()['tutorId']
        self.assertTrue(res.json()['user']['isActive'])

        t_cli = Client()
        self.assertEqual(self._login(t_cli, 'ctrl_tutor', 'init_pw_99', 'tutor').status_code, 200)

        # Tutor CANNOT change own username or password via /api/profile/update/ -> 403
        r_chg_user = t_cli.post(
            '/api/profile/update/',
            data=json.dumps({'username': 'hacked_tutor'}),
            content_type='application/json',
        )
        self.assertEqual(r_chg_user.status_code, 403)

        r_chg_pw = t_cli.post(
            '/api/profile/update/',
            data=json.dumps({'oldPassword': 'init_pw_99', 'newPassword': 'new_self_pw'}),
            content_type='application/json',
        )
        self.assertEqual(r_chg_pw.status_code, 403)

        # Tutor CAN still update phone/bio (keeping username same) -> 200
        r_upd_info = t_cli.post(
            '/api/profile/update/',
            data=json.dumps({
                'username': 'ctrl_tutor',
                'fullName': 'Nazorat Tyuter Updated',
                'phone': '+998907776655',
                'bio': 'Sinf rahbari',
            }),
            content_type='application/json',
        )
        self.assertEqual(r_upd_info.status_code, 200)
        tutor_obj = CustomUser.objects.get(id=tutor_id)
        self.assertEqual(tutor_obj.username, 'ctrl_tutor')
        self.assertEqual(tutor_obj.phone, '+998907776655')
        self.assertTrue(tutor_obj.check_password('init_pw_99'))

        # Admin suspends (blocks) the tutor account
        r_block = adm.put(
            f'/api/admin/users/{tutor_id}/',
            data=json.dumps({'isActive': False}),
            content_type='application/json',
        )
        self.assertEqual(r_block.status_code, 200)
        self.assertFalse(r_block.json()['user']['isActive'])

        # Existing tutor session is immediately blocked on /api/tutor/dashboard/ and /api/auth/me/
        self.assertIn(t_cli.get('/api/tutor/dashboard/').status_code, (401, 403))
        me_after = t_cli.get('/api/auth/me/')
        self.assertFalse(me_after.json()['authenticated'])

        # Blocked tutor gets clear 403 on login with valid password
        fresh_t_cli = Client()
        r_blocked_login = self._login(fresh_t_cli, 'ctrl_tutor', 'init_pw_99', 'tutor')
        self.assertEqual(r_blocked_login.status_code, 403)

        # Admin updates tutor's login, resets password, and re-activates account
        r_adm_reset = adm.put(
            f'/api/admin/users/{tutor_id}/',
            data=json.dumps({
                'username': 'ctrl_tutor_v2',
                'password': 'AdminReset77',
                'isActive': True,
            }),
            content_type='application/json',
        )
        self.assertEqual(r_adm_reset.status_code, 200)
        self.assertTrue(r_adm_reset.json()['user']['isActive'])

        # Old credentials rejected, new admin-issued credentials work
        self.assertEqual(self._login(fresh_t_cli, 'ctrl_tutor', 'init_pw_99', 'tutor').status_code, 401)
        self.assertEqual(self._login(fresh_t_cli, 'ctrl_tutor_v2', 'AdminReset77', 'tutor').status_code, 200)
        self.assertEqual(fresh_t_cli.get('/api/tutor/dashboard/').status_code, 200)

    def test_tutor_dashboard_shows_all_class_coins_and_admin_tutor_statistics(self):
        # Prior award on 7-A tied to a previous tutor before reassignment
        prev_tutor = CustomUser.objects.create_user(
            username='prev_tut',
            password='123',
            role='tutor',
            full_name='Oldingi Tyuter',
            coins=15,
        )
        self.class_a.bonus_coins = 15
        self.class_a.save(update_fields=['bonus_coins'])
        ClassCoinTransaction.objects.create(
            school_class=self.class_a,
            tutor=prev_tutor,
            given_by=self.admin,
            amount=15,
            reason='Boshlangich sinf mukofoti',
        )

        # Two students in 7-A; 1 active test taker with 80% score
        st1 = CustomUser.objects.create_user(
            username='stat_st1',
            password='123',
            role='student',
            full_name='Faol Oquvchi',
            grade='7-A',
            coins=12,
        )
        CustomUser.objects.create_user(
            username='stat_st2',
            password='123',
            role='student',
            full_name='Ikkinchi Oquvchi',
            grade='7-A',
            coins=5,
        )
        t_obj = Test.objects.create(
            title='Tutor Stat Matematika',
            teacher=self.teacher,
            subject='Matematika',
            grade='7-A',
        )
        TestResult.objects.create(
            test=t_obj,
            student=st1,
            total_questions=10,
            correct_answers=8,
            score_percentage=80,
        )

        adm = Client()
        self.assertEqual(self._login(adm, 'admin_tut', '123', 'admin').status_code, 200)

        # Admin assigns 7-A to new tutor stat_tut
        res = adm.post(
            '/api/admin/tutors/',
            data=json.dumps({
                'username': 'stat_tut',
                'password': '123',
                'fullName': 'Statistika Tyuter',
                'assignedClasses': ['7-A'],
            }),
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 200)
        stat_tut_id = res.json()['tutorId']

        # Admin awards +40 coins to 7-A -> credits class bonus AND new tutor wallet
        aw = adm.post(
            '/api/coins/award/',
            data=json.dumps({
                'className': '7-A',
                'awardScope': 'class_only',
                'amount': 40,
                'reason': 'Chorak yakuni bonusi',
            }),
            content_type='application/json',
        )
        self.assertEqual(aw.status_code, 200)

        # Tutor dashboard shows full classBonusTotal (15 + 40 = 55), tutorCoins (40), and both transactions
        t_cli = Client()
        self.assertEqual(self._login(t_cli, 'stat_tut', '123', 'tutor').status_code, 200)
        dash = t_cli.get('/api/tutor/dashboard/')
        self.assertEqual(dash.status_code, 200)
        dj = dash.json()
        self.assertEqual(dj['summary']['classBonusTotal'], 55)
        self.assertEqual(dj['summary']['tutorCoins'], 40)
        self.assertEqual(len(dj['coinHistory']), 2)
        cls_item = dj['assignedClasses'][0]
        self.assertEqual(cls_item['name'], '7-A')
        self.assertEqual(cls_item['bonusCoins'], 55)
        self.assertEqual(cls_item['coinAwardsCount'], 2)
        self.assertIsNotNone(cls_item['lastAward'])
        self.assertEqual(cls_item['lastAward']['amount'], 40)

        # Admin /api/admin/tutors/ returns detailed per-tutor statistics
        adm_tuts = adm.get('/api/admin/tutors/')
        self.assertEqual(adm_tuts.status_code, 200)
        tut_map = {t['id']: t for t in adm_tuts.json()}
        st_row = tut_map[stat_tut_id]
        self.assertEqual(st_row['classesCount'], 1)
        self.assertEqual(st_row['studentsCount'], 2)
        self.assertEqual(st_row['activeStudentsCount'], 1)
        self.assertEqual(st_row['testsPassedCount'], 1)
        self.assertEqual(st_row['avgScore'], 80)
        self.assertEqual(st_row['passRate'], 100)
        self.assertEqual(st_row['studentCoinsTotal'], 17)
        self.assertEqual(st_row['classBonusTotal'], 55)
        self.assertEqual(st_row['coins'], 40)
        self.assertEqual(st_row['coinAwardsCount'], 2)
        self.assertEqual(st_row['recentAward']['className'], '7-A')
        self.assertEqual(st_row['recentAward']['amount'], 40)
        self.assertEqual(st_row['assignedClassesDetails'][0]['bonusCoins'], 55)

        # Admin /api/admin/stats/ also includes tutors and tutorSummary
        adm_stats = adm.get('/api/admin/stats/')
        self.assertEqual(adm_stats.status_code, 200)
        sj = adm_stats.json()
        self.assertGreaterEqual(sj['tutorsCount'], 2)
        self.assertIn('tutorSummary', sj)
        self.assertGreaterEqual(sj['tutorSummary']['totalClassBonusCoins'], 55)
        self.assertGreaterEqual(sj['tutorSummary']['totalTutorCoins'], 55)  # 15 + 40
        self.assertGreaterEqual(sj['tutorSummary']['totalCoinAwardsCount'], 2)
        self.assertTrue(any(t['id'] == stat_tut_id and t['classBonusTotal'] == 55 for t in sj['tutors']))


