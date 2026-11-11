from datetime import timedelta
from django.test import TestCase, Client
from django.utils import timezone
from core.models import SchoolClass, CustomUser, Test, Question, Option, SiteSetting, TestResult


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
