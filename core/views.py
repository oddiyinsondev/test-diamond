import json
import os
import re
import uuid
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.db import transaction
from django.db.models import Avg, Count, Sum, Max, Min, Q
from django.utils import timezone
from django.utils.cache import patch_vary_headers
from django.utils.dateparse import parse_datetime
from datetime import datetime, time, timedelta

def parse_iso_datetime(dt_str):
    if not dt_str:
        return None
    try:
        dt = parse_datetime(dt_str)
        if dt:
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            return dt
    except Exception:
        pass
    try:
        dt = datetime.strptime(str(dt_str)[:16], "%Y-%m-%dT%H:%M")
        return timezone.make_aware(dt)
    except Exception:
        return None


def _fmt_local_dt(dt):
    if not dt:
        return None
    local_dt = timezone.localtime(dt) if timezone.is_aware(dt) else dt
    return local_dt.strftime('%d.%m.%Y %H:%M')


def _fmt_local_iso(dt):
    if not dt:
        return ''
    local_dt = timezone.localtime(dt) if timezone.is_aware(dt) else dt
    return local_dt.strftime('%Y-%m-%dT%H:%M')


def _req_lang(request):
    """So'rov sarlavhasidan interfeys tilini ('ru' yoki 'uz') aniqlash. Sukut bo'yicha 'uz'."""
    if not request:
        return 'uz'
    raw = ''
    try:
        raw = request.headers.get('X-Language') or request.META.get('HTTP_X_LANGUAGE') or request.GET.get('lang_ui') or ''
    except Exception:
        raw = ''
    val = str(raw).strip().lower()
    if val.startswith('ru'):
        return 'ru'
    return 'uz'


def _msg(lang, uz, ru):
    return ru if lang == 'ru' else uz


def _parse_bool_flag(val, default=False):
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val != 0
    s = str(val).strip().lower()
    if s in ('true', '1', 'yes', 'on', 'ha', 'да'):
        return True
    if s in ('false', '0', 'no', 'off', "yo'q", 'нет'):
        return False
    return default


def serialize_student_tests_policy(site_settings=None, now=None, lang='uz'):
    s = site_settings or SiteSetting.get_settings()
    now = now or timezone.now()
    enabled = bool(getattr(s, 'student_tests_enabled', True))
    st = getattr(s, 'student_tests_start_time', None)
    et = getattr(s, 'student_tests_end_time', None)
    is_upcoming = bool(st and now < st)
    is_expired = bool(et and now > et)
    portal_open = enabled and (not is_upcoming) and (not is_expired)
    if not enabled:
        status_reason = 'portal_disabled'
        status_message = _msg(
            lang,
            "Hozirda administrator tomonidan o'quvchilar bo'limidagi testlarga ruxsat vaqtincha yopilgan!",
            "В настоящее время доступ к тестам в разделе учеников временно закрыт администратором!",
        )
    elif is_upcoming:
        status_reason = 'portal_upcoming'
        status_message = _msg(
            lang,
            f"O'quvchilar testlar oynasi hali ochilmagan! Boshlanish vaqti: {_fmt_local_dt(st)}",
            f"Окно тестирования учеников ещё не открылось! Время начала: {_fmt_local_dt(st)}",
        )
    elif is_expired:
        status_reason = 'portal_expired'
        status_message = _msg(
            lang,
            f"O'quvchilar testlar oynasi belgilangan vaqti yakunlangan! Tugash vaqti: {_fmt_local_dt(et)}",
            f"Время окна тестирования учеников истекло! Время окончания: {_fmt_local_dt(et)}",
        )
    else:
        status_reason = None
        status_message = _msg(
            lang,
            "O'quvchilar bo'limi ochiq — faqat administrator ruxsat bergan testlar ishlaydi.",
            "Раздел учеников открыт — работают только тесты с разрешением администратора.",
        )
    return {
        'enabled': enabled,
        'portalOpen': portal_open,
        'isUpcoming': is_upcoming,
        'isExpired': is_expired,
        'startTime': _fmt_local_dt(st),
        'endTime': _fmt_local_dt(et),
        'startTimeIso': _fmt_local_iso(st),
        'endTimeIso': _fmt_local_iso(et),
        'reason': status_reason,
        'message': status_message,
    }


def _evaluate_test_student_access(test, now=None, site_settings=None, lang='uz'):
    """Testning o'quvchilar uchun ochiq yoki yopiqligini global portal + admin ruxsati + vaqt bo'yicha tekshiradi."""
    now = now or timezone.now()
    policy = serialize_student_tests_policy(site_settings=site_settings, now=now, lang=lang)
    is_student_allowed = bool(getattr(test, 'is_student_allowed', False))
    test_upcoming = bool(test.start_time and now < test.start_time)
    test_expired = bool(test.end_time and now > test.end_time)

    if not policy['enabled']:
        return False, 'portal_disabled', policy['message'], {
            'policy': policy,
            'isStudentAllowed': is_student_allowed,
            'isUpcoming': test_upcoming,
            'isExpired': test_expired,
        }
    if policy['isUpcoming']:
        return False, 'portal_upcoming', policy['message'], {
            'policy': policy,
            'isStudentAllowed': is_student_allowed,
            'isUpcoming': True,
            'isExpired': test_expired,
        }
    if policy['isExpired']:
        return False, 'portal_expired', policy['message'], {
            'policy': policy,
            'isStudentAllowed': is_student_allowed,
            'isUpcoming': test_upcoming,
            'isExpired': True,
        }
    if not is_student_allowed:
        return False, 'admin_not_allowed', _msg(
            lang,
            "Ushbu testga hali administrator tomonidan ishlash ruxsati berilmagan! Admin ruxsati kutilmoqda.",
            "Администратор ещё не открыл доступ к этому тесту для учеников! Ожидается разрешение.",
        ), {
            'policy': policy,
            'isStudentAllowed': False,
            'isUpcoming': test_upcoming,
            'isExpired': test_expired,
        }
    if test_upcoming:
        return False, 'test_upcoming', _msg(
            lang,
            f"Ushbu test hali boshlanmagan! Belgilangan boshlanish vaqti: {_fmt_local_dt(test.start_time)}",
            f"Этот тест ещё не начался! Назначенное время начала: {_fmt_local_dt(test.start_time)}",
        ), {
            'policy': policy,
            'isStudentAllowed': True,
            'isUpcoming': True,
            'isExpired': False,
        }
    if test_expired:
        return False, 'test_expired', _msg(
            lang,
            f"Ushbu testni topshirish muddati yakunlangan! Tugash vaqti: {_fmt_local_dt(test.end_time)}",
            f"Срок прохождения этого теста истёк! Время окончания: {_fmt_local_dt(test.end_time)}",
        ), {
            'policy': policy,
            'isStudentAllowed': True,
            'isUpcoming': False,
            'isExpired': True,
        }

    return True, None, '', {
        'policy': policy,
        'isStudentAllowed': True,
        'isUpcoming': False,
        'isExpired': False,
    }

from core.models import (
    CustomUser, Test, Question, Option, TestResult, StudentAnswer,
    TeacherShowcase, TalentedStudent, ContactMessage, SiteSetting, SchoolClass,
    CoinTransaction, ClassCoinTransaction
)
from core.importer import (
    parse_questions_from_file, generate_sample_word, generate_sample_excel
)

SUBJECTS_LIST = ['Matematika', 'Fizika', 'Informatika', 'Ingliz tili', 'Biologiya', 'Kimyo', 'Tarix', 'Ona tili va Adabiyot']

DAILY_TEACHER_MAX_CLASSES = None  # Cheklovsiz: har bir sinf uchun alohida kunlik limit ishlaydi
DAILY_TEACHER_MAX_COINS = 5  # Har bir sinf uchun kuniga ko'pi bilan 5 Coin

NON_LESSON_COIN_REASON_RE = re.compile(
    r'(?:\btest\w*|\bimti[hx]on\w*|\bolimpiad\w*|\bnazorat\s+ish\w*|\buy(?:ga|dagi)?\s*vazifa\w*|\byakuniy\b|\bchorak\w*\b|\bsinfdoshiga\s+yordam\b|\bтест\w*|\bэкзамен\w*|\bолимпиад\w*|\bдомашн\w*\s+задан\w*|\bконтрольн\w*\s+работ\w*)',
    re.IGNORECASE,
)

def validate_teacher_lesson_activity_reason(reason, lang='uz'):
    """O'qituvchi faqat darsdagi faollik uchun coin berishini tekshirish."""
    text = (reason or '').strip()
    if not text:
        return _msg(lang, "Darsdagi faollik sababi kiritilishi shart!", "Необходимо указать причину активности на уроке!")
    if NON_LESSON_COIN_REASON_RE.search(text):
        return _msg(
            lang,
            "Cheklov: O'qituvchi faqat darsdagi faollik (darsda faol qatnashish, doskaga chiqish, savol-javob) "
            "uchun coin berishi mumkin! Test, uy vazifasi yoki boshqa holatlar uchun coin berish taqiqlangan.",
            "Ограничение: учитель может начислять койны только за активность на уроке "
            "(активное участие, выход к доске, ответы на вопросы)! Начисление койнов за тесты, домашние задания или другие случаи запрещено.",
        )
    return None

def is_admin_user(user):
    return bool(
        user and getattr(user, 'is_authenticated', False) and
        (getattr(user, 'role', '') == 'admin' or getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False))
    )

def get_teacher_daily_coin_status(teacher, enforce_for_portal=False, grade=''):
    """O'qituvchining bugungi (har bir sinf uchun kuniga max 5 coin) kunlik limitini hisoblash"""
    selected_grade = (grade or '').strip()
    if selected_grade.lower() in ('all', 'barchasi'):
        selected_grade = ''

    is_admin = is_admin_user(teacher)
    if not teacher or (is_admin and not enforce_for_portal):
        return {
            'isLimited': False,
            'isPerClassLimit': False,
            'maxClassesPerDay': None,
            'maxCoinsPerDay': None,
            'selectedClass': selected_grade or None,
            'awardedClassToday': None,
            'awardedClassesToday': [],
            'perClassStatus': {},
            'totalCoinsUsedAllClassesToday': 0,
            'coinsUsedToday': 0,
            'coinsRemainingToday': 999999,
            'canAwardToday': True,
        }

    today = timezone.localdate()
    tz = timezone.get_current_timezone()
    start_dt = timezone.make_aware(datetime.combine(today, time.min), tz)
    end_dt = start_dt + timedelta(days=1)

    qs = CoinTransaction.objects.filter(
        given_by=teacher,
        created_at__gte=start_dt,
        created_at__lt=end_dt,
        amount__gt=0,
        test_result__isnull=True,
    )
    if is_admin and enforce_for_portal:
        qs = qs.filter(portal='teacher')

    txs = list(qs.select_related('student').order_by('created_at', 'id'))

    awarded_classes = []
    per_class_batches = {}  # {cls_name: [group_dict, ...]}
    per_class_individual = {}  # {cls_name: int}

    for tx in txs:
        cls_name = (tx.student.grade or '').strip() if tx.student else ''
        if cls_name and cls_name not in awarded_classes:
            awarded_classes.append(cls_name)

        reason_str = tx.reason or ''
        if (
            '(Sinf jamoasi uchun)' in reason_str
            or '(Ommaviy sinf mukofoti)' in reason_str
            or '(Для команды класса)' in reason_str
        ):
            cls_batches = per_class_batches.setdefault(cls_name, [])
            matched = None
            for grp in cls_batches:
                if grp['reason'] == reason_str and abs((tx.created_at - grp['dt']).total_seconds()) < 5:
                    matched = grp
                    break
            if matched:
                if tx.amount > matched['amount']:
                    matched['amount'] = int(tx.amount or 0)
            else:
                cls_batches.append({
                    'cls': cls_name,
                    'reason': reason_str,
                    'dt': tx.created_at,
                    'amount': int(tx.amount or 0)
                })
        else:
            per_class_individual[cls_name] = per_class_individual.get(cls_name, 0) + int(tx.amount or 0)

    per_class_status = {}
    all_seen_classes = list(dict.fromkeys(list(per_class_batches.keys()) + list(per_class_individual.keys())))
    for cls_name in all_seen_classes:
        b_used = sum(g['amount'] for g in per_class_batches.get(cls_name, []))
        i_used = per_class_individual.get(cls_name, 0)
        c_used = b_used + i_used
        c_rem = max(0, DAILY_TEACHER_MAX_COINS - c_used)
        per_class_status[cls_name] = {
            'className': cls_name,
            'coinsUsedToday': c_used,
            'coinsRemainingToday': c_rem,
            'maxCoinsPerDay': DAILY_TEACHER_MAX_COINS,
            'batchAwardedToday': b_used > 0,
            'canAwardToday': c_rem > 0,
        }

    total_used_all = sum(item['coinsUsedToday'] for item in per_class_status.values())
    if selected_grade:
        sel_info = per_class_status.get(selected_grade, {
            'coinsUsedToday': 0,
            'coinsRemainingToday': DAILY_TEACHER_MAX_COINS,
            'batchAwardedToday': False,
            'canAwardToday': True,
        })
        coins_used = sel_info['coinsUsedToday']
        coins_remaining = sel_info['coinsRemainingToday']
        batch_awarded_today = sel_info['batchAwardedToday']
        can_award_today = sel_info['canAwardToday']
    else:
        coins_used = total_used_all
        coins_remaining = DAILY_TEACHER_MAX_COINS
        batch_awarded_today = any(item['batchAwardedToday'] for item in per_class_status.values())
        can_award_today = True

    awarded_class = awarded_classes[0] if awarded_classes else None

    return {
        'isLimited': True,
        'isPerClassLimit': True,
        'maxClassesPerDay': None,
        'maxCoinsPerDay': DAILY_TEACHER_MAX_COINS,
        'date': today.strftime('%d.%m.%Y'),
        'dateIso': today.isoformat(),
        'selectedClass': selected_grade or None,
        'awardedClassToday': awarded_class,
        'awardedClassesToday': awarded_classes,
        'perClassStatus': per_class_status,
        'totalCoinsUsedAllClassesToday': total_used_all,
        'coinsUsedToday': coins_used,
        'coinsRemainingToday': coins_remaining,
        'batchAwardedToday': batch_awarded_today,
        'canAwardToday': can_award_today,
    }


def get_teacher_students_today_coin_totals(teacher, student_ids, is_admin_preview=False, exclude_tx_id=None):
    """Har bir o'quvchi bugun mazkur o'qituvchidan olgan dars faolligi coinlari yig'indisini qaytaradi"""
    if not teacher or not student_ids:
        return {}
    today = timezone.localdate()
    tz = timezone.get_current_timezone()
    start_dt = timezone.make_aware(datetime.combine(today, time.min), tz)
    end_dt = start_dt + timedelta(days=1)

    qs = CoinTransaction.objects.filter(
        given_by=teacher,
        student_id__in=student_ids,
        created_at__gte=start_dt,
        created_at__lt=end_dt,
        amount__gt=0,
        test_result__isnull=True,
    )
    if is_admin_preview:
        qs = qs.filter(portal='teacher')
    if exclude_tx_id is not None:
        qs = qs.exclude(id=exclude_tx_id)

    rows = qs.values('student_id').annotate(total=Sum('amount'))
    return {row['student_id']: int(row['total'] or 0) for row in rows}

def check_admin_permission(request):
    """Foydalanuvchi administrator ekanligini tekshirish"""
    lang = _req_lang(request)
    if not request.user.is_authenticated:
        return JsonResponse({'error': _msg(lang, 'Tizimga kirish talab etiladi!', 'Требуется вход в систему!')}, status=401)
    if not getattr(request.user, 'is_active', True):
        logout(request)
        return JsonResponse({'error': _msg(lang, 'Ushbu hisob administrator tomonidan bloklangan!', 'Этот аккаунт заблокирован администратором!')}, status=403)
    if request.user.role != 'admin' and not request.user.is_superuser and not request.user.is_staff:
        return JsonResponse({'error': _msg(lang, 'Ushbu amal uchun faqat administrator huquqi ruxsat etilgan!', 'Для этого действия требуются права администратора!')}, status=403)
    return None

def get_request_teacher_or_admin(request):
    """Foydalanuvchini session, teacherId yoki default o'qituvchi orqali aniqlash"""
    if request.user.is_authenticated and (request.user.role in ['teacher', 'admin'] or request.user.is_superuser or request.user.is_staff):
        return request.user

    # Agar sessiya uzilib qolgan bo'lsa, URL/POST dan teacherId orqali tekshirish
    teacher_id = request.GET.get('teacherId')
    if not teacher_id and request.method == 'POST':
        try:
            body_data = json.loads(request.body.decode('utf-8'))
            teacher_id = body_data.get('teacherId')
        except Exception:
            teacher_id = request.POST.get('teacherId')

    if teacher_id:
        t = CustomUser.objects.filter(id=teacher_id, role__in=['teacher', 'admin']).first()
        if t:
            return t

    # Agar tizimda test/o'qituvchi mavjud bo'lsa fallback
    return CustomUser.objects.filter(role='teacher').first() or CustomUser.objects.filter(role='admin').first()

def check_teacher_permission(request):
    """Foydalanuvchi o'qituvchi yoki administrator ekanligini tekshirish"""
    lang = _req_lang(request)
    if not request.user.is_authenticated:
        return JsonResponse({'error': _msg(lang, 'Tizimga kirish talab etiladi!', 'Требуется вход в систему!')}, status=401)
    if not getattr(request.user, 'is_active', True):
        logout(request)
        return JsonResponse({'error': _msg(lang, 'Ushbu hisob administrator tomonidan bloklangan!', 'Этот аккаунт заблокирован администратором!')}, status=403)
    if request.user.role in ['teacher', 'admin'] or request.user.is_superuser or request.user.is_staff:
        return None
    return JsonResponse({'error': _msg(lang, "Ushbu amal uchun o'qituvchi yoki administrator huquqi talab etiladi!", "Для этого действия требуются права учителя или администратора!")}, status=403)


def check_tutor_permission(request):
    """Foydalanuvchi tyuter yoki administrator ekanligini tekshirish (o'qituvchi va o'quvchi rad etiladi)"""
    lang = _req_lang(request)
    if not request.user.is_authenticated:
        return JsonResponse({'error': _msg(lang, 'Tizimga kirish talab etiladi!', 'Требуется вход в систему!')}, status=401)
    if not getattr(request.user, 'is_active', True):
        logout(request)
        return JsonResponse({'error': _msg(lang, 'Ushbu tyuter hisobi administrator tomonidan vaqtincha bloklangan!', 'Этот аккаунт тьютора временно заблокирован администратором!')}, status=403)
    if request.user.role == 'tutor' or is_admin_user(request.user):
        return None
    return JsonResponse({'error': _msg(lang, "Cheklov: Ushbu amal uchun faqat tyuter yoki administrator huquqi talab etiladi!", "Ограничение: для этого действия требуются права тьютора или администратора!")}, status=403)


def _parse_assigned_class_names(data):
    """JSON yoki FormData dan biriktirilgan sinf nomlari ro'yxatini xavfsiz o'qish"""
    raw = None
    has_key = False
    for key in ('assignedClasses', 'assigned_classes', 'classNames', 'class_names', 'classes'):
        if key in data:
            has_key = True
            if hasattr(data, 'getlist'):
                vals = data.getlist(key)
                if len(vals) == 1 and isinstance(vals[0], str) and vals[0].strip().startswith('['):
                    try:
                        raw = json.loads(vals[0])
                    except Exception:
                        raw = vals
                elif len(vals) == 1 and ',' in str(vals[0]):
                    raw = [x.strip() for x in str(vals[0]).split(',') if x.strip()]
                else:
                    raw = [str(x).strip() for x in vals if str(x).strip()]
            else:
                raw = data.get(key)
            break
    if not has_key:
        return False, []
    if raw is None or raw == '':
        return True, []
    if isinstance(raw, str):
        s = raw.strip()
        if s.startswith('['):
            try:
                raw = json.loads(s)
            except Exception:
                raw = [x.strip() for x in s.split(',') if x.strip()]
        else:
            raw = [x.strip() for x in s.split(',') if x.strip()]
    if not isinstance(raw, list):
        return True, []
    seen = set()
    cleaned = []
    for item in raw:
        val = str(item).strip()
        if val and val.lower() not in seen:
            seen.add(val.lower())
            cleaned.append(val)
    return True, cleaned


def _sync_tutor_classes(tutor, class_names, replace=True, prev_tutor_name=None):
    """Tyuterga biriktirilgan SchoolClass yozuvlarini yangilash"""
    if not tutor or tutor.role != 'tutor':
        return []
    old_name = (prev_tutor_name if prev_tutor_name is not None else tutor.full_name) or ''
    normalized_lookup = {}
    for sc in SchoolClass.objects.filter(is_active=True):
        normalized_lookup[sc.name.strip().lower()] = sc

    target_classes = []
    for raw_name in class_names:
        sc = normalized_lookup.get(str(raw_name).strip().lower())
        if sc and sc not in target_classes:
            target_classes.append(sc)
    target_ids = {sc.id for sc in target_classes}

    if replace:
        for old_sc in SchoolClass.objects.filter(tutor=tutor).exclude(id__in=target_ids):
            old_sc.tutor = None
            if old_sc.head_teacher and old_name and old_sc.head_teacher.strip() == old_name.strip():
                old_sc.head_teacher = ''
                old_sc.save(update_fields=['tutor', 'head_teacher'])
            else:
                old_sc.save(update_fields=['tutor'])

    for sc in target_classes:
        update_fields = []
        if sc.tutor_id != tutor.id:
            sc.tutor = tutor
            update_fields.append('tutor')
        if not (sc.head_teacher or '').strip() or (old_name and sc.head_teacher.strip() == old_name.strip()):
            if sc.head_teacher != tutor.full_name:
                sc.head_teacher = tutor.full_name
                update_fields.append('head_teacher')
        if update_fields:
            sc.save(update_fields=update_fields)

    return [sc.name for sc in target_classes]


def _resolve_authenticated_teacher_actor(request):
    """Login qilgan o'qituvchi (yoki admin tomonidan tanlangan o'qituvchi) ni xavfsiz aniqlash."""
    perm_err = check_teacher_permission(request)
    if perm_err:
        return None, perm_err

    lang = _req_lang(request)
    user = request.user
    teacher_id_param = (request.GET.get('teacherId') or '').strip()
    if is_admin_user(user):
        if teacher_id_param and teacher_id_param.lower() not in ('all', 'none'):
            if teacher_id_param == '__admin_only__':
                return '__admin_only__', None
            target = CustomUser.objects.filter(id=teacher_id_param, role__in=['teacher', 'admin']).first()
            if not target:
                return None, JsonResponse({'error': _msg(lang, "Tanlangan o'qituvchi topilmadi!", "Выбранный учитель не найден!")}, status=404)
            return target, None
        return user, None

    if teacher_id_param and teacher_id_param != str(user.id):
        return None, JsonResponse({'error': _msg(lang, "Boshqa o'qituvchining test va statistikalarini ko'rish taqiqlangan!", "Просмотр тестов и статистики другого учителя запрещён!")}, status=403)
    return user, None

def get_active_classes_list():
    """Barcha faol sinflarni olish (DB dan). Agar bo'sh bo'lsa defaultlarni qaytaradi."""
    try:
        classes = list(SchoolClass.objects.filter(is_active=True).order_by('grade_level', 'language', 'name').values_list('name', flat=True))
        if classes:
            return classes
    except Exception:
        pass
    return ['5-A', '6-A', '7-A', '8-A', '9-A', '9-B', '10-A', '10-B', '11-A', '11-B', '5-RU', '6-RU', '7-RU', '8-RU', '9-RU', '10-RU', '11-RU']


def get_active_classes_meta():
    """Har bir faol sinf bo'yicha o'quvchilar soni va jami coinlar statistikasini olish"""
    names = get_active_classes_list()
    student_stats = {}
    for row in (
        CustomUser.objects.filter(role='student')
        .values('grade')
        .annotate(students_count=Count('id'), total_coins=Sum('coins'))
    ):
        g = (row['grade'] or '').strip()
        if g:
            student_stats[g] = {
                'studentsCount': int(row['students_count'] or 0),
                'totalCoins': int(row['total_coins'] or 0),
            }

    sc_map = {sc.name: sc for sc in SchoolClass.objects.select_related('tutor').filter(is_active=True)}
    meta = []
    for name in names:
        st = student_stats.get(name, {'studentsCount': 0, 'totalCoins': 0})
        sc = sc_map.get(name)
        bonus_coins = int(sc.bonus_coins or 0) if sc else 0
        student_coins = st['totalCoins']
        tutor_obj = sc.tutor if (sc and sc.tutor and sc.tutor.role == 'tutor') else None
        meta.append({
            'name': name,
            'language': sc.language if sc else ('ru' if 'RU' in name.upper() else 'uz'),
            'studentsCount': st['studentsCount'],
            'studentCoins': student_coins,
            'bonusCoins': bonus_coins,
            'totalCoins': student_coins + bonus_coins,
            'tutorId': tutor_obj.id if tutor_obj else None,
            'tutorName': tutor_obj.full_name if tutor_obj else '',
            'tutorUsername': tutor_obj.username if tutor_obj else '',
            'tutorCoins': int(tutor_obj.coins or 0) if tutor_obj else 0,
        })
    return meta


def parse_test_grades(grade_str):
    """Testning grade maydonini ('Barchasi' yoki '9-A, 9-RU') ajratib beradi"""
    raw = (grade_str or '').strip()
    if not raw or raw.lower() in ('barchasi', 'all'):
        return True, []
    seen = set()
    items = []
    for part in raw.split(','):
        p = part.strip()
        if not p:
            continue
        if p.lower() in ('barchasi', 'all'):
            return True, []
        key = p.lower()
        if key not in seen:
            seen.add(key)
            items.append(p)
    if not items:
        return True, []
    return False, items


def test_matches_grade(test_grade, target_grade):
    """Berilgan sinf testga tegishlimi yoki yo'qligini tekshiradi"""
    tg = (target_grade or '').strip().lower()
    if not tg or tg in ('all', 'barchasi'):
        return True
    is_all, targets = parse_test_grades(test_grade)
    if is_all:
        return True
    return any(t.strip().lower() == tg for t in targets)


def normalize_test_grade_value(grade_raw, target_classes_raw):
    """Test yaratish/tahrirlashda targetClasses va grade maydonlarini xatosiz normallashtirish"""
    active_classes = get_active_classes_list()
    cleaned = []
    seen = set()

    if isinstance(target_classes_raw, list):
        raw_list = [str(x).strip() for x in target_classes_raw if str(x).strip()]
    elif isinstance(target_classes_raw, str) and target_classes_raw.strip():
        raw_list = [x.strip() for x in target_classes_raw.split(',') if x.strip()]
    else:
        raw_list = []

    for item in raw_list:
        if item.lower() in ('barchasi', 'all'):
            return 'Barchasi'
        key = item.lower()
        if key not in seen:
            seen.add(key)
            cleaned.append(item)

    grade_str = (grade_raw or '').strip()
    if grade_str.lower() in ('barchasi', 'all'):
        if not cleaned or (len(active_classes) > 1 and len(cleaned) >= len(active_classes)):
            return 'Barchasi'
        return ', '.join(cleaned)

    if cleaned:
        if len(active_classes) > 1 and len(cleaned) >= len(active_classes):
            active_set = {c.lower() for c in active_classes}
            if active_set.issubset(seen):
                return 'Barchasi'
        return ', '.join(cleaned)

    if grade_str:
        is_all, parsed_items = parse_test_grades(grade_str)
        if is_all:
            return 'Barchasi'
        return ', '.join(parsed_items)

    return 'Barchasi'


def get_teacher_scoped_tests(teacher):
    """O'qituvchi (yoki admin) ko'rishi mumkin bo'lgan testlar queryset'i.
    Oddiy o'qituvchi FAQAT o'ziga biriktirilgan (berilgan) testlarni ko'radi."""
    if not teacher:
        return Test.objects.none()
    if teacher == '__admin_only__':
        return Test.objects.filter(teacher__role='admin')
    if is_admin_user(teacher):
        return Test.objects.all()
    return Test.objects.filter(teacher=teacher)

def save_validated_user_avatar(user, img_file, lang='uz'):
    """Foydalanuvchi rasmini tekshirish va noyob nom bilan saqlash"""
    ext = os.path.splitext(img_file.name or '')[1].lower() or '.png'
    if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
        raise ValueError(_msg(
            lang,
            "Faqat rasm fayllari (.jpg, .png, .webp, .gif) qabul qilinadi!",
            "Принимаются только файлы изображений (.jpg, .png, .webp, .gif)!",
        ))
    if img_file.size > 5 * 1024 * 1024:
        raise ValueError(_msg(
            lang,
            "Rasm hajmi 5MB dan oshmasligi kerak!",
            "Размер изображения не должен превышать 5 МБ!",
        ))
    img_file.name = f"user_{user.id or 'new'}_{uuid.uuid4().hex[:8]}{ext}"
    user.avatar = img_file

def serialize_user_payload(user):
    assigned_classes = []
    if user.role == 'tutor':
        assigned_classes = list(
            user.tutor_classes.filter(is_active=True)
            .order_by('grade_level', 'language', 'name')
            .values_list('name', flat=True)
        )
    return {
        'id': user.id,
        'username': user.username,
        'fullName': user.full_name or user.username,
        'role': user.role,
        'grade': user.grade,
        'subject': user.subject,
        'phone': user.phone or '',
        'bio': user.bio or '',
        'coins': getattr(user, 'coins', 0),
        'isActive': bool(getattr(user, 'is_active', True)),
        'assignedClasses': assigned_classes,
        'avatarUrl': user.get_avatar_url(),
        'hasCustomAvatar': bool(user.avatar),
    }

# ----------------- PAGE VIEWS (ALOHIDA URL-LAR VA SUBDOMENLAR) -----------------

def _extract_request_host(request):
    try:
        raw_host = request.get_host() or ''
    except Exception:
        raw_host = request.META.get('HTTP_HOST', '') or ''
    return raw_host.split(':')[0].strip().lower()


def _resolve_portal_mode(request):
    host = _extract_request_host(request)
    portal_domains = getattr(settings, 'PORTAL_DOMAINS', {
        'admin': 'admin.diamondschool.uz',
        'teacher': 'teacher.diamondschool.uz',
        'tutor': 'tutor.diamondschool.uz',
        'student': 'student.diamondschool.uz',
    })
    for mode, domain in portal_domains.items():
        if host == domain.lower() or host == f'{mode}.localhost':
            return mode
    return 'main'


def _build_root_redirect_with_query(request):
    qs = request.META.get('QUERY_STRING', '')
    return redirect(f'/?{qs}' if qs else '/')


def _render_spa_for_request(request):
    portal_mode = _resolve_portal_mode(request)
    scheme = 'https' if request.is_secure() else 'http'
    main_domain = getattr(settings, 'MAIN_DOMAIN', 'app.diamondschool.uz')
    portal_domains = getattr(settings, 'PORTAL_DOMAINS', {
        'admin': 'admin.diamondschool.uz',
        'teacher': 'teacher.diamondschool.uz',
        'tutor': 'tutor.diamondschool.uz',
        'student': 'student.diamondschool.uz',
    })
    spa_config = {
        'portalMode': portal_mode,
        'mainSiteUrl': f'{scheme}://{main_domain}',
        'portalUrls': {k: f'{scheme}://{v}' for k, v in portal_domains.items()},
    }
    response = render(request, 'react_app.html', {'spa_config': spa_config})
    patch_vary_headers(response, ('Host',))
    return response


def _handle_portal_entry(request, target_portal):
    portal_mode = _resolve_portal_mode(request)

    # Subdomenda (admin./teacher./student.) tegishli portal URL'i kelsa, toza / ga yo'naltiramiz
    if portal_mode != 'main':
        if portal_mode == target_portal:
            return _build_root_redirect_with_query(request)
        return redirect('/')

    # Asosiy domenda (app.diamondschool.uz) redirect yoqilgan bo'lsa tegishli subdomenga yo'naltirish
    if getattr(settings, 'REDIRECT_MAIN_PORTAL_PATHS_TO_SUBDOMAINS', False):
        host = _extract_request_host(request)
        if host == getattr(settings, 'MAIN_DOMAIN', 'app.diamondschool.uz').lower():
            target_domain = getattr(settings, 'PORTAL_DOMAINS', {}).get(target_portal)
            if target_domain:
                scheme = 'https' if request.is_secure() else 'http'
                qs = request.META.get('QUERY_STRING', '')
                suffix = f'/?{qs}' if qs else '/'
                return redirect(f'{scheme}://{target_domain}{suffix}')

    return _render_spa_for_request(request)


def home_view(request, extra=''):
    """React SPA view - Host ga qarab Bosh sahifa yoki tegishli Portal"""
    return _render_spa_for_request(request)


def admin_view(request, extra=''):
    """React SPA view - Admin Panel"""
    return _handle_portal_entry(request, 'admin')


def teacher_view(request, extra=''):
    """React SPA view - O'qituvchi Portali"""
    return _handle_portal_entry(request, 'teacher')


def tutor_view(request, extra=''):
    """React SPA view - Tyuter Portali"""
    return _handle_portal_entry(request, 'tutor')


def student_view(request, extra=''):
    """React SPA view - O'quvchi Portali"""
    return _handle_portal_entry(request, 'student')


def section_redirect_view(request, section=''):
    """Asosiy sayt bo'limlariga (#teachers-section va h.k.) yo'naltirish"""
    portal_mode = _resolve_portal_mode(request)
    anchor = f'#{section}' if section else ''
    if portal_mode == 'main':
        return redirect(f'/{anchor}')
    scheme = 'https' if request.is_secure() else 'http'
    main_domain = getattr(settings, 'MAIN_DOMAIN', 'app.diamondschool.uz')
    return redirect(f'{scheme}://{main_domain}/{anchor}')


def spa_fallback_view(request, extra=''):
    """Subdomenlarda sahifani yangilaganda (refresh) 404 bermasligi uchun SPA fallback"""
    if _resolve_portal_mode(request) == 'main':
        raise Http404('Page not found')
    return _render_spa_for_request(request)


# ----------------- AUTH & META APIS -----------------

@csrf_exempt
def api_login(request):
    lang = _req_lang(request)
    if request.method != 'POST':
        return JsonResponse({'error': _msg(lang, "Faqat POST so'rov qabul qilinadi", "Принимаются только POST-запросы")}, status=405)
    
    try:
        data = json.loads(request.body.decode('utf-8'))
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
    except Exception:
        return JsonResponse({'error': _msg(lang, "Noto'g'ri formatdagi ma'lumot", "Неверный формат данных")}, status=400)

    user = authenticate(request, username=username, password=password)
    if not user:
        existing_user = CustomUser.objects.filter(username=username).first()
        if existing_user and not existing_user.is_active and existing_user.check_password(password):
            return JsonResponse({
                'error': _msg(
                    lang,
                    "Ushbu hisob administrator tomonidan vaqtincha bloklangan! Kirish uchun administratorga murojaat qiling.",
                    "Этот аккаунт временно заблокирован администратором! Обратитесь к администратору.",
                )
            }, status=403)
        return JsonResponse({'error': _msg(lang, "Login yoki parol noto'g'ri!", "Неверный логин или пароль!")}, status=401)

    requested_role = data.get('role')
    if requested_role and user.role != requested_role:
        role_names = {
            'admin': _msg(lang, 'administrator', 'администратора'),
            'teacher': _msg(lang, "o'qituvchi", 'учителя'),
            'tutor': _msg(lang, 'tyuter', 'тьютора'),
            'student': _msg(lang, "o'quvchi", 'ученика'),
        }
        rname = role_names.get(requested_role, requested_role)
        return JsonResponse({
            'error': _msg(
                lang,
                f"Ushbu hisob {rname} profiliga tegishli emas!",
                f"Этот аккаунт не принадлежит профилю {rname}!",
            )
        }, status=403)

    login(request, user)
    return JsonResponse({
        'success': True,
        'user': serialize_user_payload(user),
    })

@csrf_exempt
def api_logout(request):
    logout(request)
    return JsonResponse({'success': True})

def api_meta(request):
    lang = _req_lang(request)
    return JsonResponse({
        'classes': get_active_classes_list(),
        'classesMeta': get_active_classes_meta(),
        'subjects': SUBJECTS_LIST,
        'studentTestsPolicy': serialize_student_tests_policy(lang=lang),
    })

def api_current_user(request):
    if request.user.is_authenticated:
        if not getattr(request.user, 'is_active', True):
            logout(request)
            return JsonResponse({'authenticated': False, 'blocked': True})
        return JsonResponse({
            'authenticated': True,
            'user': serialize_user_payload(request.user),
        })
    return JsonResponse({'authenticated': False})



# ================= 👑 ADMIN APIS =================

# 1. Teachers list & create (ALOHIDA)
@csrf_exempt
def api_admin_teachers(request):
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)

    if request.method == 'GET':
        teachers = CustomUser.objects.filter(role='teacher').order_by('-id')
        data = []
        for t in teachers:
            tests_count = t.created_tests.count()
            # Calculate teacher's students average score
            results = TestResult.objects.filter(test__teacher=t)
            sub_count = results.count()
            avg_score = round(results.aggregate(avg=Avg('score_percentage'))['avg'] or 0)
            data.append({
                'id': t.id,
                'username': t.username,
                'fullName': t.full_name,
                'subject': t.subject or _msg(lang, 'Fan belgilanmagan', 'Предмет не указан'),
                'phone': t.phone or '-',
                'rawPhone': t.phone or '',
                'bio': t.bio or '',
                'avatarUrl': t.get_avatar_url(),
                'hasCustomAvatar': bool(t.avatar),
                'testsCount': tests_count,
                'submissionsCount': sub_count,
                'avgScore': avg_score,
                'dateJoined': t.date_joined.strftime('%d.%m.%Y')
            })
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        # Yangi O'qituvchi qo'shish (JSON yoki FormData rasm bilan)
        try:
            is_json = (request.content_type or '').startswith('application/json')
            data = json.loads(request.body.decode('utf-8')) if is_json and request.body else request.POST

            username = (data.get('username') or '').strip()
            password = (data.get('password') or '').strip()
            full_name = (data.get('fullName') or data.get('full_name') or '').strip()
            subject = (data.get('subject') or '').strip()
            phone = (data.get('phone') or '').strip()
            bio = (data.get('bio') or '').strip()

            if not username or not password or not full_name or not subject:
                return JsonResponse({'error': _msg(lang, "Barcha majburiy maydonlarni to'ldiring!", "Заполните все обязательные поля!")}, status=400)

            if len(password) < 3:
                return JsonResponse({'error': _msg(lang, "Parol kamida 3 ta belgidan iborat bo'lishi kerak!", "Пароль должен содержать минимум 3 символа!")}, status=400)

            if CustomUser.objects.filter(username=username).exists():
                return JsonResponse({'error': _msg(lang, "Ushbu login bilan foydalanuvchi allaqachon mavjud!", "Пользователь с таким логином уже существует!")}, status=400)

            user = CustomUser.objects.create_user(
                username=username,
                password=password,
                role='teacher',
                full_name=full_name,
                subject=subject,
                phone=phone,
                bio=bio
            )
            if 'avatar' in request.FILES:
                save_validated_user_avatar(user, request.FILES['avatar'], lang=lang)
                user.save(update_fields=['avatar'])

            return JsonResponse({
                'success': True,
                'teacherId': user.id,
                'user': serialize_user_payload(user),
                'avatarUrl': user.get_avatar_url(),
            })
        except ValueError as ve:
            if 'user' in locals() and user.id:
                user.delete()
            return JsonResponse({'error': str(ve)}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': _msg(lang, "Metod qo'llab-quvvatlanmaydi", "Метод не поддерживается")}, status=405)


def _compute_tutors_analytics_list(tutors_qs=None):
    """Tyuterlar ro'yxati va ularning sinflari, o'quvchilari, test hamda coin statistikalarini hisoblash"""
    if tutors_qs is None:
        tutors_qs = CustomUser.objects.filter(role='tutor')
    tutors = list(tutors_qs.prefetch_related('tutor_classes').order_by('-id'))
    all_assigned_names = set()
    for t in tutors:
        for c in t.tutor_classes.all():
            if c.is_active:
                all_assigned_names.add(c.name)

    students_by_grade = {}
    if all_assigned_names:
        for s in CustomUser.objects.filter(role='student', grade__in=list(all_assigned_names)).only('id', 'grade', 'coins'):
            students_by_grade.setdefault((s.grade or '').strip(), []).append(s)

    results_by_grade = {}
    tested_student_ids_by_grade = {}
    if all_assigned_names:
        for st_id, g_name, sc_pct in (
            TestResult.objects.filter(student__grade__in=list(all_assigned_names))
            .values_list('student_id', 'student__grade', 'score_percentage')
        ):
            g_clean = (g_name or '').strip()
            results_by_grade.setdefault(g_clean, []).append(int(sc_pct or 0))
            tested_student_ids_by_grade.setdefault(g_clean, set()).add(st_id)

    data = []
    for t in tutors:
        cls_objs = [c for c in t.tutor_classes.all() if c.is_active]
        cls_objs.sort(key=lambda c: (int(c.grade_level or 0), c.language, c.name))
        cls_names = [c.name for c in cls_objs]

        students_cnt = 0
        active_students_cnt = 0
        student_coins_tot = 0
        class_bonus_tot = 0
        tutor_scores = []
        cls_details = []

        for c in cls_objs:
            c_stds = students_by_grade.get(c.name, [])
            c_scores = results_by_grade.get(c.name, [])
            c_tested_ids = tested_student_ids_by_grade.get(c.name, set())
            c_std_cnt = len(c_stds)
            c_act_cnt = len(c_tested_ids)
            c_std_coins = sum(int(s.coins or 0) for s in c_stds)
            c_bonus = int(c.bonus_coins or 0)
            c_subs = len(c_scores)
            c_avg = round(sum(c_scores) / c_subs) if c_subs > 0 else 0

            students_cnt += c_std_cnt
            active_students_cnt += c_act_cnt
            student_coins_tot += c_std_coins
            class_bonus_tot += c_bonus
            tutor_scores.extend(c_scores)

            cls_details.append({
                'id': c.id,
                'name': c.name,
                'language': c.language,
                'bonusCoins': c_bonus,
                'studentCoins': c_std_coins,
                'studentsCount': c_std_cnt,
                'activeStudentsCount': c_act_cnt,
                'submissionsCount': c_subs,
                'avgScore': c_avg,
            })

        tests_passed_cnt = len(tutor_scores)
        avg_score = round(sum(tutor_scores) / tests_passed_cnt) if tests_passed_cnt > 0 else 0
        passed_cnt = sum(1 for sc in tutor_scores if sc >= 60)
        pass_rate = round((passed_cnt / tests_passed_cnt) * 100) if tests_passed_cnt > 0 else 0

        ctx_qs = ClassCoinTransaction.objects.filter(
            Q(tutor=t) | Q(school_class__in=cls_objs)
        ).select_related('school_class').order_by('-created_at')
        awards_cnt = ctx_qs.count()
        class_awarded_sum = int(ctx_qs.filter(amount__gt=0).aggregate(sum=Sum('amount'))['sum'] or 0)
        last_ctx = ctx_qs.first()

        data.append({
            'id': t.id,
            'username': t.username,
            'fullName': t.full_name,
            'phone': t.phone or '-',
            'rawPhone': t.phone or '',
            'bio': t.bio or '',
            'coins': int(t.coins or 0),
            'isActive': bool(getattr(t, 'is_active', True)),
            'avatarUrl': t.get_avatar_url(),
            'hasCustomAvatar': bool(t.avatar),
            'classesCount': len(cls_names),
            'assignedClasses': cls_names,
            'assignedClassesDetails': cls_details,
            'studentsCount': students_cnt,
            'activeStudentsCount': active_students_cnt,
            'testsPassedCount': tests_passed_cnt,
            'avgScore': avg_score,
            'passRate': pass_rate,
            'studentCoinsTotal': student_coins_tot,
            'classBonusTotal': class_bonus_tot,
            'totalEcosystemCoins': student_coins_tot + class_bonus_tot,
            'coinAwardsCount': awards_cnt,
            'classAwardedHistorySum': class_awarded_sum,
            'recentAward': {
                'className': last_ctx.school_class.name if last_ctx.school_class else '-',
                'amount': int(last_ctx.amount or 0),
                'reason': last_ctx.reason,
                'date': _fmt_local_dt(last_ctx.created_at) or '',
            } if last_ctx else None,
            'dateJoined': t.date_joined.strftime('%d.%m.%Y'),
        })
    return data


# 1.5 Tutors list & create (Tyuterlar boshqaruvi - faqat Admin)
@csrf_exempt
def api_admin_tutors(request):
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)

    if request.method == 'GET':
        data = _compute_tutors_analytics_list()
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        user = None
        try:
            is_json = (request.content_type or '').startswith('application/json')
            data = json.loads(request.body.decode('utf-8')) if is_json and request.body else request.POST

            username = (data.get('username') or '').strip()
            password = (data.get('password') or '').strip()
            full_name = (data.get('fullName') or data.get('full_name') or '').strip()
            phone = (data.get('phone') or '').strip()
            bio = (data.get('bio') or '').strip()
            is_active = _parse_bool_flag(
                data.get('isActive') if 'isActive' in data else data.get('is_active'),
                default=True,
            )
            has_cls_key, assigned_names = _parse_assigned_class_names(data)

            if not username or not password or not full_name:
                return JsonResponse({'error': _msg(lang, "Barcha majburiy maydonlarni to'ldiring!", "Заполните все обязательные поля!")}, status=400)
            if len(password) < 3:
                return JsonResponse({'error': _msg(lang, "Parol kamida 3 ta belgidan iborat bo'lishi kerak!", "Пароль должен содержать минимум 3 символа!")}, status=400)
            if CustomUser.objects.filter(username=username).exists():
                return JsonResponse({'error': _msg(lang, "Ushbu login bilan foydalanuvchi allaqachon mavjud!", "Пользователь с таким логином уже существует!")}, status=400)

            with transaction.atomic():
                user = CustomUser.objects.create_user(
                    username=username,
                    password=password,
                    role='tutor',
                    full_name=full_name,
                    phone=phone,
                    bio=bio,
                    is_active=is_active,
                )
                if 'avatar' in request.FILES:
                    save_validated_user_avatar(user, request.FILES['avatar'], lang=lang)
                    user.save(update_fields=['avatar'])
                if has_cls_key:
                    _sync_tutor_classes(user, assigned_names, replace=True)

            return JsonResponse({
                'success': True,
                'tutorId': user.id,
                'user': serialize_user_payload(user),
                'avatarUrl': user.get_avatar_url(),
            })
        except ValueError as ve:
            if user and user.id:
                user.delete()
            return JsonResponse({'error': str(ve)}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': _msg(lang, "Metod qo'llab-quvvatlanmaydi", "Метод не поддерживается")}, status=405)


# 2. Students list & create (ALOHIDA)
@csrf_exempt
def api_admin_students(request):
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)

    if request.method == 'GET':
        grade_filter = request.GET.get('grade')
        students = CustomUser.objects.filter(role='student')
        if grade_filter and grade_filter != 'all':
            students = students.filter(grade=grade_filter)
        students = students.order_by('grade', 'full_name')

        data = []
        for s in students:
            res_count = s.results.count()
            avg_score = round(s.results.aggregate(avg=Avg('score_percentage'))['avg'] or 0)
            data.append({
                'id': s.id,
                'username': s.username,
                'fullName': s.full_name,
                'grade': s.grade or '-',
                'phone': s.phone or '-',
                'bio': s.bio or '',
                'avatarUrl': s.get_avatar_url(),
                'testsPassed': res_count,
                'avgScore': avg_score,
                'coins': s.coins,
                'dateJoined': s.date_joined.strftime('%d.%m.%Y')
            })
        return JsonResponse(data, safe=False)


    elif request.method == 'POST':
        # Yangi O'quvchi qo'shish (JSON yoki FormData)
        user = None
        try:
            is_json = (request.content_type or '').startswith('application/json')
            data = json.loads(request.body.decode('utf-8')) if is_json and request.body else request.POST
            username = (data.get('username') or '').strip()
            password = (data.get('password') or '').strip()
            full_name = (data.get('fullName') or data.get('full_name') or '').strip()
            grade = (data.get('grade') or '').strip()
            phone = (data.get('phone') or '').strip()

            if not username or not password or not full_name or not grade:
                return JsonResponse({'error': _msg(lang, "Barcha majburiy maydonlarni to'ldiring!", "Заполните все обязательные поля!")}, status=400)

            if len(password) < 3:
                return JsonResponse({'error': _msg(lang, "Parol kamida 3 ta belgidan iborat bo'lishi kerak!", "Пароль должен содержать минимум 3 символа!")}, status=400)

            if CustomUser.objects.filter(username=username).exists():
                return JsonResponse({'error': _msg(lang, "Ushbu login bilan foydalanuvchi allaqachon mavjud!", "Пользователь с таким логином уже существует!")}, status=400)

            user = CustomUser.objects.create_user(
                username=username,
                password=password,
                role='student',
                full_name=full_name,
                grade=grade,
                phone=phone
            )
            if 'avatar' in request.FILES:
                save_validated_user_avatar(user, request.FILES['avatar'], lang=lang)
                user.save(update_fields=['avatar'])

            return JsonResponse({
                'success': True,
                'studentId': user.id,
                'user': serialize_user_payload(user),
                'avatarUrl': user.get_avatar_url(),
            })
        except ValueError as ve:
            if user and user.id:
                user.delete()
            return JsonResponse({'error': str(ve)}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': _msg(lang, "Metod qo'llab-quvvatlanmaydi", "Метод не поддерживается")}, status=405)


# 3. Get, Update & Delete User (Admin tahrirlash va parol yangilash)
@csrf_exempt
def api_admin_user_manage(request, user_id):
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)
    try:
        user = CustomUser.objects.get(id=user_id)
    except CustomUser.DoesNotExist:
        return JsonResponse({'error': _msg(lang, 'Foydalanuvchi topilmadi!', 'Пользователь не найден!')}, status=404)

    if request.method == 'GET':
        assigned_classes = (
            list(
                user.tutor_classes.filter(is_active=True)
                .order_by('grade_level', 'language', 'name')
                .values_list('name', flat=True)
            )
            if user.role == 'tutor'
            else []
        )
        return JsonResponse({
            'id': user.id,
            'username': user.username,
            'fullName': user.full_name,
            'role': user.role,
            'subject': user.subject,
            'grade': user.grade,
            'coins': int(user.coins or 0),
            'isActive': bool(getattr(user, 'is_active', True)),
            'assignedClasses': assigned_classes,
            'phone': user.phone or '',
            'bio': user.bio or '',
            'avatarUrl': user.get_avatar_url(),
            'hasCustomAvatar': bool(user.avatar),
        })

    elif request.method in ['PUT', 'POST', 'PATCH']:
        try:
            is_json = (request.content_type or '').startswith('application/json')
            data = json.loads(request.body.decode('utf-8')) if is_json and request.body else request.POST

            new_username = (data.get('username') or '').strip()
            new_password = (data.get('password') or data.get('newPassword') or '').strip()
            new_full_name = (data.get('fullName') or data.get('full_name') or '').strip()
            new_phone = data.get('phone') if 'phone' in data else None
            new_bio = data.get('bio') if 'bio' in data else None
            new_subject = (data.get('subject') or '').strip()
            new_grade = (data.get('grade') or '').strip()
            clear_avatar = str(data.get('clearAvatar', '')).lower() in ['true', '1', 'yes', 'да']
            has_cls_key, parsed_assigned_classes = _parse_assigned_class_names(data)
            prev_full_name = user.full_name

            if new_username and new_username != user.username:
                if CustomUser.objects.filter(username=new_username).exclude(id=user.id).exists():
                    return JsonResponse({'error': _msg(lang, "Ushbu login bilan boshqa foydalanuvchi mavjud!", "Пользователь с таким логином уже существует!")}, status=400)
                user.username = new_username

            if new_full_name:
                user.full_name = new_full_name
            if new_phone is not None:
                user.phone = str(new_phone).strip()
            if new_bio is not None:
                user.bio = str(new_bio).strip()
            if user.role == 'teacher' and new_subject:
                user.subject = new_subject
            if user.role == 'student' and new_grade:
                user.grade = new_grade

            if 'isActive' in data or 'is_active' in data:
                raw_active = data.get('isActive') if 'isActive' in data else data.get('is_active')
                parsed_active = _parse_bool_flag(raw_active, default=user.is_active)
                if not parsed_active and (user.is_superuser or user.username == 'admin' or user.id == request.user.id):
                    return JsonResponse({
                        'error': _msg(
                            lang,
                            "Bosh administrator yoki o'zingizning hisobingizni bloklab bo'lmaydi!",
                            "Невозможно заблокировать главного администратора или собственный аккаунт!",
                        )
                    }, status=400)
                user.is_active = parsed_active

            if clear_avatar and user.avatar:
                user.avatar.delete(save=False)
                user.avatar = None

            if 'avatar' in request.FILES:
                save_validated_user_avatar(user, request.FILES['avatar'], lang=lang)

            # Yangi parol o'rnatish (agar admin parol kiritgan bo'lsa)
            if new_password:
                if len(new_password) < 3:
                    return JsonResponse({'error': _msg(lang, "Yangi parol kamida 3 ta belgidan iborat bo'lishi kerak!", "Новый пароль должен содержать минимум 3 символа!")}, status=400)
                user.set_password(new_password)
                if request.user.is_authenticated and request.user.id == user.id:
                    update_session_auth_hash(request, user)

            with transaction.atomic():
                user.save()
                if user.role == 'tutor':
                    if has_cls_key:
                        _sync_tutor_classes(
                            user,
                            parsed_assigned_classes,
                            replace=True,
                            prev_tutor_name=prev_full_name,
                        )
                    elif new_full_name and new_full_name != prev_full_name:
                        current_cls_names = list(
                            user.tutor_classes.filter(is_active=True).values_list('name', flat=True)
                        )
                        _sync_tutor_classes(
                            user,
                            current_cls_names,
                            replace=False,
                            prev_tutor_name=prev_full_name,
                        )

            return JsonResponse({
                'success': True,
                'message': _msg(lang, "Ma'lumotlar muvaffaqiyatli yangilandi!", "Данные успешно обновлены!"),
                'user': serialize_user_payload(user),
            })
        except ValueError as ve:
            return JsonResponse({'error': str(ve)}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    elif request.method == 'DELETE':
        if user.is_superuser or user.username == 'admin':
            return JsonResponse({'error': _msg(lang, "Bosh administratorni o'chirib bo'lmaydi!", "Невозможно удалить главного администратора!")}, status=400)
        user.delete()
        return JsonResponse({'success': True})

    return JsonResponse({'error': _msg(lang, "Metod qo'llab-quvvatlanmaydi", "Метод не поддерживается")}, status=405)


# ================= 🎓 TUTOR (TYUTER) PORTAL APIS =================

def _resolve_tutor_scope(request):
    """Tyuter (yoki admin tanlagan tyuter) hamda uning biriktirilgan sinflarini aniqlash"""
    auth_err = check_tutor_permission(request)
    if auth_err:
        return None, False, None, auth_err
    lang = _req_lang(request)
    user = request.user
    tutor_id_param = (request.GET.get('tutorId') or '').strip()

    if is_admin_user(user):
        if tutor_id_param:
            target = CustomUser.objects.filter(id=tutor_id_param, role='tutor').first()
            if not target:
                return None, False, None, JsonResponse({'error': _msg(lang, "Tyuter topilmadi!", "Тьютор не найден!")}, status=404)
            cls_qs = SchoolClass.objects.filter(is_active=True, tutor=target).order_by('grade_level', 'language', 'name')
            return target, False, cls_qs, None
        cls_qs = SchoolClass.objects.filter(is_active=True).order_by('grade_level', 'language', 'name')
        return user, True, cls_qs, None

    cls_qs = SchoolClass.objects.filter(is_active=True, tutor=user).order_by('grade_level', 'language', 'name')
    return user, False, cls_qs, None


def _assert_tutor_grade_allowed(assigned_classes_qs, is_admin_all, grade_val, lang='uz'):
    """Tyuterga faqat o'z sinflaridagi o'quvchilarni boshqarishga ruxsat berish"""
    if is_admin_all:
        return (grade_val or '').strip(), None
    assigned_list = list(assigned_classes_qs)
    if not assigned_list:
        return None, JsonResponse({
            'error': _msg(
                lang,
                "Sizga hali birorta sinf biriktirilmagan! Administrator sizga sinf biriktirgandan so'ng o'quvchi qo'sha olasiz.",
                "Вам ещё не назначен ни один класс! Вы сможете добавлять учеников после того, как администратор назначит вам класс.",
            )
        }, status=403)
    lookup = {sc.name.strip().lower(): sc.name for sc in assigned_list}
    key = (grade_val or '').strip().lower()
    if not key or key not in lookup:
        return None, JsonResponse({
            'error': _msg(
                lang,
                "Cheklov: Siz faqat o'zingizga biriktirilgan sinf o'quvchilarini qo'shish, tahrirlash va o'chirishingiz mumkin!",
                "Ограничение: вы можете добавлять, редактировать и удалять учеников только в назначенных вам классах!",
            )
        }, status=403)
    return lookup[key], None


def api_tutor_dashboard(request):
    """Tyuter portali uchun biriktirilgan sinflar, o'quvchilar va sinf coinlari hamyoni ma'lumotlari"""
    tutor_actor, is_admin_all, cls_qs, auth_err = _resolve_tutor_scope(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)

    assigned_classes = list(cls_qs.select_related('tutor'))
    assigned_names = [c.name for c in assigned_classes]

    students_qs = CustomUser.objects.filter(role='student')
    if not is_admin_all:
        students_qs = students_qs.filter(grade__in=assigned_names) if assigned_names else students_qs.none()
    students_qs = students_qs.order_by('grade', 'full_name')

    students_data = []
    class_student_counts = {}
    class_student_coins = {}
    for s in students_qs:
        res_qs = s.results.all()
        res_cnt = res_qs.count()
        avg_sc = round(res_qs.aggregate(avg=Avg('score_percentage'))['avg'] or 0) if res_cnt > 0 else 0
        g = (s.grade or '').strip()
        if g:
            class_student_counts[g] = class_student_counts.get(g, 0) + 1
            class_student_coins[g] = class_student_coins.get(g, 0) + int(s.coins or 0)
        students_data.append({
            'id': s.id,
            'username': s.username,
            'fullName': s.full_name,
            'grade': g or '-',
            'phone': s.phone or '-',
            'rawPhone': s.phone or '',
            'bio': s.bio or '',
            'coins': int(s.coins or 0),
            'avatarUrl': s.get_avatar_url(),
            'hasCustomAvatar': bool(s.avatar),
            'testsPassed': res_cnt,
            'avgScore': avg_sc,
            'dateJoined': s.date_joined.strftime('%d.%m.%Y'),
        })

    classes_data = []
    for c in assigned_classes:
        c_res_qs = TestResult.objects.filter(student__grade=c.name)
        c_subs = c_res_qs.count()
        c_avg = round(c_res_qs.aggregate(avg=Avg('score_percentage'))['avg'] or 0) if c_subs > 0 else 0
        classes_data.append({
            'id': c.id,
            'name': c.name,
            'gradeLevel': c.grade_level,
            'language': c.language,
            'room': c.room or '-',
            'studentsCount': class_student_counts.get(c.name, 0),
            'studentCoins': class_student_coins.get(c.name, 0),
            'bonusCoins': int(c.bonus_coins or 0),
            'totalCoins': class_student_coins.get(c.name, 0) + int(c.bonus_coins or 0),
            'avgScore': c_avg,
            'submissionsCount': c_subs,
        })

    if is_admin_all:
        tx_qs = ClassCoinTransaction.objects.select_related('school_class', 'given_by', 'tutor').order_by('-created_at')[:60]
    else:
        tx_qs = (
            ClassCoinTransaction.objects.filter(Q(tutor=tutor_actor) | Q(school_class__in=assigned_classes))
            .select_related('school_class', 'given_by', 'tutor')
            .order_by('-created_at')[:60]
        )

    coin_history = []
    per_class_awards = {}
    for ctx in tx_qs:
        c_name = ctx.school_class.name if ctx.school_class else '-'
        dt_str = _fmt_local_dt(ctx.created_at) or ctx.created_at.strftime('%d.%m.%Y %H:%M')
        entry = {
            'id': ctx.id,
            'className': c_name,
            'amount': int(ctx.amount or 0),
            'reason': ctx.reason,
            'givenBy': ctx.given_by.full_name if ctx.given_by else _msg(lang, 'Administrator', 'Администратор'),
            'tutorName': ctx.tutor.full_name if ctx.tutor else (ctx.school_class.tutor.full_name if ctx.school_class and ctx.school_class.tutor else ''),
            'date': dt_str,
        }
        coin_history.append(entry)
        if c_name not in per_class_awards:
            per_class_awards[c_name] = {'count': 0, 'latest': entry}
        per_class_awards[c_name]['count'] += 1

    for c_row in classes_data:
        aw_meta = per_class_awards.get(c_row['name'])
        c_row['coinAwardsCount'] = aw_meta['count'] if aw_meta else 0
        c_row['lastAward'] = aw_meta['latest'] if aw_meta else None

    tutor_coins = (
        CustomUser.objects.filter(role='tutor').aggregate(sum=Sum('coins'))['sum'] or 0
        if is_admin_all
        else int(tutor_actor.coins or 0)
    )
    all_scores = [st['avgScore'] for st in students_data if st['testsPassed'] > 0]
    overall_avg = round(sum(all_scores) / len(all_scores)) if all_scores else 0

    return JsonResponse({
        'success': True,
        'tutor': serialize_user_payload(tutor_actor),
        'assignedClasses': classes_data,
        'students': students_data,
        'coinHistory': coin_history,
        'summary': {
            'assignedClassesCount': len(classes_data),
            'studentsCount': len(students_data),
            'tutorCoins': int(tutor_coins),
            'classBonusTotal': sum(c['bonusCoins'] for c in classes_data),
            'studentCoinsTotal': sum(st['coins'] for st in students_data),
            'avgScore': overall_avg,
        },
    })


@csrf_exempt
def api_tutor_students(request):
    """Tyuter portali: biriktirilgan sinf o'quvchilarini ko'rish va yangi o'quvchi qo'shish (O'qituvchi rad etiladi)"""
    tutor_actor, is_admin_all, cls_qs, auth_err = _resolve_tutor_scope(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)
    assigned_names = list(cls_qs.values_list('name', flat=True))

    if request.method == 'GET':
        grade_filter = (request.GET.get('grade') or '').strip()
        students = CustomUser.objects.filter(role='student')
        if not is_admin_all:
            students = students.filter(grade__in=assigned_names) if assigned_names else students.none()
        if grade_filter and grade_filter != 'all':
            students = students.filter(grade__iexact=grade_filter)
        students = students.order_by('grade', 'full_name')
        data = []
        for s in students:
            res_count = s.results.count()
            avg_score = round(s.results.aggregate(avg=Avg('score_percentage'))['avg'] or 0) if res_count > 0 else 0
            data.append({
                'id': s.id,
                'username': s.username,
                'fullName': s.full_name,
                'grade': s.grade or '-',
                'phone': s.phone or '-',
                'rawPhone': s.phone or '',
                'bio': s.bio or '',
                'avatarUrl': s.get_avatar_url(),
                'hasCustomAvatar': bool(s.avatar),
                'testsPassed': res_count,
                'avgScore': avg_score,
                'coins': int(s.coins or 0),
                'dateJoined': s.date_joined.strftime('%d.%m.%Y'),
            })
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        user = None
        try:
            is_json = (request.content_type or '').startswith('application/json')
            data = json.loads(request.body.decode('utf-8')) if is_json and request.body else request.POST

            username = (data.get('username') or '').strip()
            password = (data.get('password') or '').strip()
            full_name = (data.get('fullName') or data.get('full_name') or '').strip()
            raw_grade = (data.get('grade') or '').strip()
            phone = (data.get('phone') or '').strip()
            bio = (data.get('bio') or '').strip()

            resolved_grade, scope_err = _assert_tutor_grade_allowed(cls_qs, is_admin_all, raw_grade, lang=lang)
            if scope_err:
                return scope_err

            if not username or not password or not full_name or not resolved_grade:
                return JsonResponse({'error': _msg(lang, "Barcha majburiy maydonlarni to'ldiring!", "Заполните все обязательные поля!")}, status=400)
            if len(password) < 3:
                return JsonResponse({'error': _msg(lang, "Parol kamida 3 ta belgidan iborat bo'lishi kerak!", "Пароль должен содержать минимум 3 символа!")}, status=400)
            if CustomUser.objects.filter(username=username).exists():
                return JsonResponse({'error': _msg(lang, "Ushbu login bilan foydalanuvchi allaqachon mavjud!", "Пользователь с таким логином уже существует!")}, status=400)

            user = CustomUser.objects.create_user(
                username=username,
                password=password,
                role='student',
                full_name=full_name,
                grade=resolved_grade,
                phone=phone,
                bio=bio,
            )
            if 'avatar' in request.FILES:
                save_validated_user_avatar(user, request.FILES['avatar'], lang=lang)
                user.save(update_fields=['avatar'])

            return JsonResponse({
                'success': True,
                'studentId': user.id,
                'user': serialize_user_payload(user),
                'avatarUrl': user.get_avatar_url(),
            })
        except ValueError as ve:
            if user and user.id:
                user.delete()
            return JsonResponse({'error': str(ve)}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': _msg(lang, "Metod qo'llab-quvvatlanmaydi", "Метод не поддерживается")}, status=405)


@csrf_exempt
def api_tutor_student_manage(request, student_id):
    """Tyuter portali: biriktirilgan sinf o'quvchisini ko'rish, tahrirlash va o'chirish"""
    _, is_admin_all, cls_qs, auth_err = _resolve_tutor_scope(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)

    student = CustomUser.objects.filter(id=student_id, role='student').first()
    if not student:
        return JsonResponse({'error': _msg(lang, "O'quvchi topilmadi!", "Ученик не найден!")}, status=404)

    _, cur_err = _assert_tutor_grade_allowed(cls_qs, is_admin_all, student.grade, lang=lang)
    if cur_err:
        return cur_err

    if request.method == 'GET':
        return JsonResponse({
            'id': student.id,
            'username': student.username,
            'fullName': student.full_name,
            'role': student.role,
            'grade': student.grade,
            'phone': student.phone or '',
            'bio': student.bio or '',
            'coins': int(student.coins or 0),
            'avatarUrl': student.get_avatar_url(),
            'hasCustomAvatar': bool(student.avatar),
        })

    elif request.method in ['PUT', 'POST', 'PATCH']:
        try:
            is_json = (request.content_type or '').startswith('application/json')
            data = json.loads(request.body.decode('utf-8')) if is_json and request.body else request.POST

            new_username = (data.get('username') or '').strip()
            new_password = (data.get('password') or data.get('newPassword') or '').strip()
            new_full_name = (data.get('fullName') or data.get('full_name') or '').strip()
            new_phone = data.get('phone') if 'phone' in data else None
            new_bio = data.get('bio') if 'bio' in data else None
            new_grade = (data.get('grade') or '').strip()
            clear_avatar = str(data.get('clearAvatar', '')).lower() in ['true', '1', 'yes', 'да']

            if new_username and new_username != student.username:
                if CustomUser.objects.filter(username=new_username).exclude(id=student.id).exists():
                    return JsonResponse({'error': _msg(lang, "Ushbu login bilan boshqa foydalanuvchi mavjud!", "Пользователь с таким логином уже существует!")}, status=400)
                student.username = new_username

            if new_full_name:
                student.full_name = new_full_name
            if new_phone is not None:
                student.phone = str(new_phone).strip()
            if new_bio is not None:
                student.bio = str(new_bio).strip()
            if new_grade:
                resolved_grade, new_err = _assert_tutor_grade_allowed(cls_qs, is_admin_all, new_grade, lang=lang)
                if new_err:
                    return new_err
                student.grade = resolved_grade

            if clear_avatar and student.avatar:
                student.avatar.delete(save=False)
                student.avatar = None
            if 'avatar' in request.FILES:
                save_validated_user_avatar(student, request.FILES['avatar'], lang=lang)

            if new_password:
                if len(new_password) < 3:
                    return JsonResponse({'error': _msg(lang, "Yangi parol kamida 3 ta belgidan iborat bo'lishi kerak!", "Новый пароль должен содержать минимум 3 символа!")}, status=400)
                student.set_password(new_password)

            student.save()
            return JsonResponse({
                'success': True,
                'message': _msg(lang, "O'quvchi ma'lumotlari muvaffaqiyatli yangilandi!", "Данные ученика успешно обновлены!"),
                'user': serialize_user_payload(student),
            })
        except ValueError as ve:
            return JsonResponse({'error': str(ve)}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    elif request.method == 'DELETE':
        student.delete()
        return JsonResponse({
            'success': True,
            'message': _msg(lang, "O'quvchi ro'yxatdan o'chirildi!", "Ученик удалён из списка!"),
        })

    return JsonResponse({'error': _msg(lang, "Metod qo'llab-quvvatlanmaydi", "Метод не поддерживается")}, status=405)


# Foydalanuvchi profilini yangilash (JSON yoki FormData)
@csrf_exempt
def api_update_profile(request):
    lang = _req_lang(request)
    if request.method != 'POST':
        return JsonResponse({'error': _msg(lang, "Faqat POST so'rovi qabul qilinadi", "Принимаются только POST-запросы")}, status=405)

    try:
        data = {}
        if (request.content_type or '').startswith('application/json') or (request.body and request.body.startswith(b'{')):
            try:
                data = json.loads(request.body.decode('utf-8'))
            except Exception:
                data = {}

        user_id = data.get('userId') or request.POST.get('userId') or request.GET.get('userId')
        if not request.user.is_authenticated:
            return JsonResponse({'error': _msg(lang, "Tizimga kirmagansiz! Profilni o'zgartirish uchun avval tizimga kiring.", "Вы не вошли в систему! Сначала войдите для изменения профиля.")}, status=401)
        if not getattr(request.user, 'is_active', True):
            logout(request)
            return JsonResponse({'error': _msg(lang, "Ushbu hisob administrator tomonidan bloklangan!", "Этот аккаунт заблокирован администратором!")}, status=403)

        user = request.user
        if user_id:
            try:
                target_id = int(user_id)
                if target_id != request.user.id:
                    if request.user.role != 'admin' and not request.user.is_superuser:
                        return JsonResponse({'error': _msg(lang, "Boshqa foydalanuvchi profilini o'zgartirish huquqiga ega emassiz!", "У вас нет прав на изменение чужого профиля!")}, status=403)
                    user = CustomUser.objects.filter(id=target_id).first()
                    if not user:
                        return JsonResponse({'error': _msg(lang, 'Foydalanuvchi topilmadi', 'Пользователь не найден')}, status=404)
            except (ValueError, TypeError):
                pass

        clear_avatar = str(data.get('clearAvatar') or request.POST.get('clearAvatar') or '').lower() in ['true', '1', 'yes', 'да']
        if clear_avatar and user.avatar:
            user.avatar.delete(save=False)
            user.avatar = None

        if 'avatar' in request.FILES:
            save_validated_user_avatar(user, request.FILES['avatar'], lang=lang)

        new_username = (data.get('username') or request.POST.get('username') or '').strip()
        if new_username and new_username != user.username:
            if user.role == 'tutor' and not is_admin_user(request.user):
                return JsonResponse({
                    'error': _msg(
                        lang,
                        "Cheklov: Tyuter logini faqat administrator tomonidan beriladi va o'zgartiriladi!",
                        "Ограничение: логин тьютора выдаётся и изменяется только администратором!",
                    )
                }, status=403)
            if CustomUser.objects.filter(username=new_username).exclude(id=user.id).exists():
                return JsonResponse({'error': _msg(lang, "Ushbu login boshqa foydalanuvchi tomonidan band qilingan!", "Этот логин уже занят другим пользователем!")}, status=400)
            user.username = new_username

        full_name = data.get('fullName') or request.POST.get('fullName') or request.POST.get('full_name')
        if full_name:
            user.full_name = full_name.strip()

        phone = data.get('phone') if 'phone' in data else request.POST.get('phone')
        if phone is not None:
            user.phone = phone.strip()

        bio = data.get('bio') if 'bio' in data else request.POST.get('bio')
        if bio is not None:
            user.bio = bio.strip()

        if user.role == 'teacher':
            subject = data.get('subject') or request.POST.get('subject')
            if subject:
                user.subject = subject.strip()

        if user.role == 'student':
            grade = data.get('grade') or request.POST.get('grade')
            if grade:
                user.grade = grade.strip()

        old_password = (data.get('oldPassword') or request.POST.get('oldPassword') or '').strip()
        new_password = (
            data.get('newPassword')
            or data.get('password')
            or request.POST.get('newPassword')
            or request.POST.get('password')
            or ''
        ).strip()

        if (old_password or new_password) and user.role == 'tutor' and not is_admin_user(request.user):
            return JsonResponse({
                'error': _msg(
                    lang,
                    "Cheklov: Tyuter paroli faqat administrator tomonidan beriladi va nazorat qilinadi!",
                    "Ограничение: пароль тьютора выдаётся и контролируется только администратором!",
                )
            }, status=403)

        if old_password and not new_password:
            return JsonResponse({'error': _msg(lang, 'Yangi parolni ham kiriting!', 'Введите также новый пароль!')}, status=400)

        if new_password:
            if len(new_password) < 3:
                return JsonResponse({'error': _msg(lang, "Yangi parol kamida 3 ta belgidan iborat bo'lishi kerak!", "Новый пароль должен содержать минимум 3 символа!")}, status=400)
            if request.user.id == user.id and not is_admin_user(request.user):
                if not old_password:
                    return JsonResponse({'error': _msg(lang, "Parolni o'zgartirish uchun avvalgi parolni kiriting!", "Для смены пароля введите текущий пароль!")}, status=400)
                if not user.check_password(old_password):
                    return JsonResponse({'error': _msg(lang, "Hozirgi (eski) parol noto'g'ri!", "Текущий пароль указан неверно!")}, status=400)
            user.set_password(new_password)
            if request.user.is_authenticated and request.user.id == user.id:
                update_session_auth_hash(request, user)

        user.save()

        return JsonResponse({
            'success': True,
            'message': _msg(lang, 'Profil muvaffaqiyatli yangilandi!', 'Профиль успешно обновлён!'),
            'user': serialize_user_payload(user),
        })
    except ValueError as ve:
        return JsonResponse({'error': str(ve)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


# O'quvchining diagrammali statistikasi
def api_student_analytics(request):
    lang = _req_lang(request)
    student_id = request.GET.get('studentId')
    student = None
    if student_id:
        student = CustomUser.objects.filter(id=student_id).first()
    elif request.user.is_authenticated:
        student = request.user

    if not student:
        return JsonResponse({'error': _msg(lang, "O'quvchi topilmadi", "Ученик не найден")}, status=400)

    results = TestResult.objects.filter(student=student).order_by('submitted_at')
    
    # Timeline data for Line / Diagonal chart
    timeline_labels = []
    timeline_scores = []
    for r in results:
        title = r.test.title
        timeline_labels.append(title[:16] + ('...' if len(title) > 16 else ''))
        timeline_scores.append(r.score_percentage)

    # Subject breakdown for Bar chart
    subject_map = {}
    for r in results:
        sub = r.test.subject or 'Umumiy'
        if sub not in subject_map:
            subject_map[sub] = {'total_score': 0, 'count': 0}
        subject_map[sub]['total_score'] += r.score_percentage
        subject_map[sub]['count'] += 1

    subject_labels = list(subject_map.keys())
    subject_scores = [round(subject_map[s]['total_score'] / subject_map[s]['count']) for s in subject_labels]

    total_completed = results.count()
    avg_score = round(results.aggregate(avg=Avg('score_percentage'))['avg'] or 0)
    total_score_sum = results.aggregate(s=Sum('score_percentage'))['s'] or 0
    xp_points = total_score_sum * 10

    # Calculate rank in class
    grade = student.grade or '9-A'
    classmates = CustomUser.objects.filter(role='student', grade=grade)
    scores_list = []
    for c in classmates:
        tot_score = TestResult.objects.filter(student=c).aggregate(s=Sum('score_percentage'))['s'] or 0
        scores_list.append((c.id, tot_score))
    scores_list.sort(key=lambda x: x[1], reverse=True)
    my_rank = 1
    for idx, (cid, s) in enumerate(scores_list, 1):
        if cid == student.id:
            my_rank = idx
            break

    if not timeline_labels:
        timeline_labels = (
            ['Тест 1 (Вводный)', 'Тест 2 (Промежуточный)', 'Тест 3 (Итоговый)']
            if lang == 'ru'
            else ['1-test (Kirish)', '2-test (Oraliq)', '3-test (Yakuniy)']
        )
        timeline_scores = [75, 85, 92]

    if not subject_labels:
        subject_labels = ['Matematika', 'Fizika', 'Informatika', 'Ingliz tili']
        subject_scores = [88, 80, 95, 86]

    effective_avg = avg_score if total_completed > 0 else 85

    return JsonResponse({
        'timeline': {
            'labels': timeline_labels,
            'scores': timeline_scores
        },
        'subjects': {
            'labels': subject_labels,
            'scores': subject_scores
        },
        'kpis': {
            'rank': my_rank,
            'totalTests': total_completed,
            'avgScore': effective_avg,
            'xp': xp_points,
            'xpPoints': xp_points
        },
        'totalCompleted': total_completed,
        'avgScore': effective_avg
    })



# 4. Admin General Stats
def api_admin_stats(request):
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)

    total_teachers = CustomUser.objects.filter(role='teacher').count()
    total_tutors = CustomUser.objects.filter(role='tutor').count()
    total_students = CustomUser.objects.filter(role='student').count()
    total_tests = Test.objects.count()
    total_results = TestResult.objects.count()
    avg_score = round(TestResult.objects.aggregate(avg=Avg('score_percentage'))['avg'] or 0)

    # Teachers stats breakdown
    teachers = CustomUser.objects.filter(role='teacher')
    teachers_data = []
    for t in teachers:
        tests_count = t.created_tests.count()
        t_results = TestResult.objects.filter(test__teacher=t)
        sub_count = t_results.count()
        t_avg = round(t_results.aggregate(avg=Avg('score_percentage'))['avg'] or 0)
        teachers_data.append({
            'id': t.id,
            'name': t.full_name,
            'subject': t.subject,
            'tests': tests_count,
            'submissions': sub_count,
            'avgScore': t_avg
        })

    # Distribution of scores
    results_qs = TestResult.objects.select_related('test').all()
    total_res = results_qs.count()
    if total_res > 0:
        excellent = results_qs.filter(score_percentage__gte=85).count()
        good = results_qs.filter(score_percentage__gte=70, score_percentage__lt=85).count()
        fair = results_qs.filter(score_percentage__gte=50, score_percentage__lt=70).count()
        poor = results_qs.filter(score_percentage__lt=50).count()
    else:
        excellent, good, fair, poor = 14, 9, 3, 1

    distribution = {
        'excellent': excellent,
        'good': good,
        'fair': fair,
        'poor': poor
    }

    # Subject performance
    subjects_dict = {}
    for r in results_qs:
        sub = r.test.subject or 'Umumiy'
        if sub not in subjects_dict:
            subjects_dict[sub] = []
        subjects_dict[sub].append(r.score_percentage)

    subject_performance = []
    if subjects_dict:
        for sub, scores in subjects_dict.items():
            subject_performance.append({
                'subject': sub,
                'avgScore': round(sum(scores) / len(scores)),
                'submissions': len(scores)
            })
    else:
        for s in SUBJECTS_LIST[:5]:
            subject_performance.append({
                'subject': s,
                'avgScore': 0,
                'submissions': 0
            })

    # Grades performance breakdown (Bilingual: Uzbek & Russian classes from DB)
    grades_data = []
    classes_qs = SchoolClass.objects.filter(is_active=True).order_by('grade_level', 'language', 'name')

    for c in classes_qs:
        g_students = CustomUser.objects.filter(role='student', grade=c.name)
        g_std_count = g_students.count()
        g_results = TestResult.objects.filter(student__grade=c.name)
        g_subs = g_results.count()
        g_avg = round(g_results.aggregate(avg=Avg('score_percentage'))['avg'] or 0) if g_subs > 0 else 0

        grades_data.append({
            'id': c.id,
            'grade': c.name,
            'gradeLevel': c.grade_level,
            'language': c.language,
            'languageLabel': (
                _msg(lang, "O'zbek tili", "Узбекский язык")
                if c.language == 'uz'
                else _msg(lang, "Rus tili (Русский)", "Русский язык")
            ),
            'room': c.room or '-',
            'headTeacher': c.head_teacher or _msg(lang, 'Belgilanmagan', 'Не указан'),
            'students': g_std_count,
            'submissions': g_subs,
            'avgScore': g_avg
        })

    uz_list = [g for g in grades_data if g['language'] == 'uz']
    ru_list = [g for g in grades_data if g['language'] == 'ru']
    language_analysis = {
        'uzbek': {
            'classesCount': len(uz_list),
            'studentsCount': sum(g['students'] for g in uz_list),
            'avgScore': round(sum(g['avgScore'] for g in uz_list) / len(uz_list)) if uz_list else 0
        },
        'russian': {
            'classesCount': len(ru_list),
            'studentsCount': sum(g['students'] for g in ru_list),
            'avgScore': round(sum(g['avgScore'] for g in ru_list) / len(ru_list)) if ru_list else 0
        }
    }

    tutors_stats = _compute_tutors_analytics_list()
    tutor_summary = {
        'totalTutors': len(tutors_stats),
        'activeTutors': sum(1 for item in tutors_stats if item['isActive']),
        'blockedTutors': sum(1 for item in tutors_stats if not item['isActive']),
        'assignedClassesCount': sum(item['classesCount'] for item in tutors_stats),
        'totalStudents': sum(item['studentsCount'] for item in tutors_stats),
        'activeStudents': sum(item['activeStudentsCount'] for item in tutors_stats),
        'totalTutorCoins': sum(item['coins'] for item in tutors_stats),
        'totalClassBonusCoins': sum(item['classBonusTotal'] for item in tutors_stats),
        'totalTestsPassed': sum(item['testsPassedCount'] for item in tutors_stats),
        'totalCoinAwardsCount': sum(item['coinAwardsCount'] for item in tutors_stats),
        'avgScore': (
            round(
                sum(item['avgScore'] * item['testsPassedCount'] for item in tutors_stats)
                / max(1, sum(item['testsPassedCount'] for item in tutors_stats))
            )
            if any(item['testsPassedCount'] > 0 for item in tutors_stats)
            else 0
        ),
    }

    return JsonResponse({
        'totalTeachers': total_teachers,
        'teachersCount': total_teachers,
        'totalTutors': total_tutors,
        'tutorsCount': total_tutors,
        'totalStudents': total_students,
        'studentsCount': total_students,
        'totalTests': total_tests,
        'testsCount': total_tests,
        'totalResults': total_results,
        'avgScore': avg_score,
        'teachers': teachers_data,
        'tutors': tutors_stats,
        'tutorSummary': tutor_summary,
        'grades': grades_data,
        'languageAnalysis': language_analysis,
        'distribution': distribution,
        'subjectPerformance': subject_performance
    })


# ================= 👨‍🏫 TEACHER APIS =================

@csrf_exempt
def api_upload_question_image(request):
    """Savol uchun rasm yuklash APIsi (Faqat Admin)"""
    lang = _req_lang(request)
    if request.method != 'POST':
        return JsonResponse({'error': _msg(lang, "Faqat POST so'rovi qabul qilinadi", "Принимаются только POST-запросы")}, status=405)
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    if 'image' not in request.FILES:
        return JsonResponse({'error': _msg(lang, 'Rasm fayli tanlanmadi!', 'Файл изображения не выбран!')}, status=400)

    try:
        img_file = request.FILES['image']
        ext = os.path.splitext(img_file.name)[1].lower() or '.jpg'
        if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']:
            return JsonResponse({'error': _msg(lang, 'Faqat rasm fayllari (.jpg, .png, .webp, .svg) qabul qilinadi!', 'Принимаются только файлы изображений (.jpg, .png, .webp, .svg)!')}, status=400)
        if img_file.size > 10 * 1024 * 1024:
            return JsonResponse({'error': _msg(lang, 'Rasm hajmi 10MB dan oshmasligi kerak!', 'Размер изображения не должен превышать 10 МБ!')}, status=400)
        file_name = f"question_images/{uuid.uuid4().hex}{ext}"
        saved_path = default_storage.save(file_name, ContentFile(img_file.read()))
        url = f"{settings.MEDIA_URL}{saved_path}"
        return JsonResponse({'success': True, 'url': url, 'imageUrl': url})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_teacher_import_questions(request):
    """Excel (.xlsx, .xls) yoki Word (.docx) faylidan savollarni import qilish (Faqat Admin)"""
    lang = _req_lang(request)
    if request.method != 'POST':
        return JsonResponse({'error': _msg(lang, "Faqat POST so'rovi qabul qilinadi", "Принимаются только POST-запросы")}, status=405)
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err

    if 'file' not in request.FILES:
        return JsonResponse({'error': _msg(lang, 'Fayl tanlanmadi!', 'Файл не выбран!')}, status=400)

    uploaded_file = request.FILES['file']
    filename = uploaded_file.name

    try:
        questions = parse_questions_from_file(uploaded_file, filename)
        if not questions:
            return JsonResponse({'error': _msg(lang, 'Fayldan savollar topilmadi! Formatni tekshiring yoki namunani yuklab oling.', 'В файле не найдены вопросы! Проверьте формат или скачайте шаблон.')}, status=400)
        return JsonResponse({
            'success': True,
            'count': len(questions),
            'questions': questions
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


def api_teacher_download_template(request):
    """O'qituvchi uchun namuna Excel yoki Word faylini yuklab berish"""
    fmt = request.GET.get('format', 'excel').lower()
    if fmt in ['word', 'docx']:
        static_p = os.path.join(settings.BASE_DIR, 'static', 'samples', 'diamond_test_namunasi.docx')
        if os.path.exists(static_p):
            with open(static_p, 'rb') as f:
                content = f.read()
        else:
            content = generate_sample_word()
        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        response['Content-Disposition'] = 'attachment; filename="diamond_test_namunasi.docx"'
        response['Content-Length'] = len(content)
        return response
    else:
        static_p = os.path.join(settings.BASE_DIR, 'static', 'samples', 'diamond_test_namunasi.xlsx')
        if os.path.exists(static_p):
            with open(static_p, 'rb') as f:
                content = f.read()
        else:
            content = generate_sample_excel()
        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="diamond_test_namunasi.xlsx"'
        response['Content-Length'] = len(content)
        return response


@csrf_exempt
def api_teacher_tests(request):
    lang = _req_lang(request)
    if request.method == 'GET':
        teacher, auth_err = _resolve_authenticated_teacher_actor(request)
        if auth_err:
            return auth_err
        tests = get_teacher_scoped_tests(teacher)

        sub_filter = request.GET.get('subject')
        lang_filter = request.GET.get('lang')
        grade_filter = request.GET.get('grade', '').strip()
        if sub_filter and sub_filter != 'all':
            tests = tests.filter(subject=sub_filter)
        if lang_filter and lang_filter != 'all':
            tests = tests.filter(language=lang_filter)

        now = timezone.now()
        site_settings = SiteSetting.get_settings()
        policy = serialize_student_tests_policy(site_settings=site_settings, now=now, lang=lang)
        data = []
        for t in tests.select_related('teacher').order_by('-created_at'):
            if grade_filter and grade_filter.lower() not in ('all', 'barchasi'):
                if not test_matches_grade(t.grade, grade_filter):
                    continue

            allowed_now, lock_reason, lock_message, access_meta = _evaluate_test_student_access(
                t, now=now, site_settings=site_settings, lang=lang
            )
            is_upcoming = access_meta['isUpcoming']
            is_expired = access_meta['isExpired']
            is_active = bool(allowed_now)
            q_count = t.questions.count()
            s_count = t.results.count()
            t_name = t.teacher.full_name if t.teacher else _msg(lang, 'Administrator', 'Администратор')
            is_all_classes, target_classes_list = parse_test_grades(t.grade)
            slots_used = (
                CoinTransaction.objects.filter(test_result__test=t, portal='test_bonus')
                .values('student_id')
                .distinct()
                .count()
            ) if (t.reward_top_count or 0) > 0 else 0

            data.append({
                'id': t.id,
                'title': t.title,
                'description': t.description,
                'subject': t.subject,
                'grade': t.grade,
                'targetClasses': target_classes_list,
                'isAllClasses': is_all_classes,
                'language': t.language or 'uz',
                'teacherId': t.teacher_id,
                'teacherName': t_name,
                'teacher_name': t_name,
                'durationMinutes': t.duration_minutes,
                'duration_minutes': t.duration_minutes,
                'startTime': _fmt_local_dt(t.start_time),
                'endTime': _fmt_local_dt(t.end_time),
                'startTimeIso': _fmt_local_iso(t.start_time),
                'endTimeIso': _fmt_local_iso(t.end_time),
                'maxAttempts': t.max_attempts,
                'isStudentAllowed': bool(t.is_student_allowed),
                'is_student_allowed': bool(t.is_student_allowed),
                'portalTestsEnabled': policy['enabled'],
                'portalOpen': policy['portalOpen'],
                'lockReason': lock_reason,
                'lockMessage': lock_message,
                'rewardTopCount': int(t.reward_top_count or 0),
                'rewardCoinsAmount': int(t.reward_coins_amount or 0),
                'rewardMinScore': int(t.reward_min_score or 0),
                'rewardSlotsUsed': slots_used,
                'isUpcoming': is_upcoming,
                'isExpired': is_expired,
                'isActive': is_active,
                'is_active': is_active,
                'questionsCount': q_count,
                'questions_count': q_count,
                'submissionsCount': s_count,
                'submissions_count': s_count,
                'createdAt': _fmt_local_dt(t.created_at) or ''
            })
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        auth_err = check_admin_permission(request)
        if auth_err:
            return auth_err
        try:
            data = json.loads(request.body.decode('utf-8'))
            title = data.get('title', '').strip()
            grade = normalize_test_grade_value(data.get('grade'), data.get('targetClasses'))[:500]

            subject = data.get('subject', '').strip() or 'Matematika'
            language = data.get('language', 'uz').strip()
            duration_minutes = int(data.get('durationMinutes', 15))
            description = data.get('description', '').strip()
            questions_data = data.get('questions', [])

            start_time_raw = data.get('startTime') or data.get('start_time')
            end_time_raw = data.get('endTime') or data.get('end_time')
            max_attempts = int(data.get('maxAttempts', data.get('max_attempts', 1)))
            is_student_allowed = _parse_bool_flag(
                data.get('isStudentAllowed') if 'isStudentAllowed' in data else data.get('is_student_allowed'),
                default=False,
            )
            reward_top_count = max(0, int(data.get('rewardTopCount', data.get('reward_top_count', 0)) or 0))
            reward_coins_amount = max(0, int(data.get('rewardCoinsAmount', data.get('reward_coins_amount', 0)) or 0))
            reward_min_score = min(100, max(0, int(data.get('rewardMinScore', data.get('reward_min_score', 0)) or 0)))

            imm_raw = data.get('immediateReward') if isinstance(data.get('immediateReward'), dict) else {}
            imm_enabled = imm_raw.get('enabled', True)
            imm_student_ids = data.get('rewardStudentIds') or imm_raw.get('studentIds') or []
            imm_amount = max(0, int(imm_raw.get('amount') or data.get('immediateRewardAmount') or 0))
            imm_top_count = max(0, int(imm_raw.get('topCount') or data.get('immediateRewardTopCount') or 0))
            imm_reason_raw = (imm_raw.get('reason') or data.get('immediateRewardReason') or '').strip()

            start_time = parse_iso_datetime(start_time_raw)
            end_time = parse_iso_datetime(end_time_raw)
            if start_time and end_time and start_time >= end_time:
                return JsonResponse({'error': _msg(lang, "Testning boshlanish vaqti tugash vaqtidan oldin bo'lishi shart!", "Время начала теста должно быть раньше времени окончания!")}, status=400)

            t_id = data.get('teacherId')
            assigned_teacher = None
            if t_id:
                assigned_teacher = CustomUser.objects.filter(id=t_id, role__in=['teacher', 'admin']).first()
            if not assigned_teacher:
                assigned_teacher = request.user

            if not title or not questions_data:
                return JsonResponse({'error': _msg(lang, 'Test nomi va savollar kiritilishi shart!', 'Необходимо указать название теста и вопросы!')}, status=400)

            imm_rewarded_students = []
            with transaction.atomic():
                test = Test.objects.create(
                    title=title,
                    teacher=assigned_teacher,
                    subject=subject,
                    grade=grade,
                    language=language,
                    duration_minutes=duration_minutes,
                    start_time=start_time,
                    end_time=end_time,
                    max_attempts=max_attempts,
                    is_student_allowed=is_student_allowed,
                    reward_top_count=reward_top_count,
                    reward_coins_amount=reward_coins_amount,
                    reward_min_score=reward_min_score,
                    description=description
                )

                for idx, q_item in enumerate(questions_data, 1):
                    q_text = (q_item.get('text') or q_item.get('question') or '').strip()
                    q_img = q_item.get('imageUrl') or q_item.get('image', '')
                    opts = q_item.get('options', [])
                    correct_idx = int(q_item.get('correctIndex', 0))

                    question_obj = Question.objects.create(
                        test=test,
                        text=q_text,
                        image_url=q_img,
                        order=idx
                    )
                    for opt_idx, opt_raw in enumerate(opts):
                        if isinstance(opt_raw, dict):
                            opt_text = (opt_raw.get('text') or '').strip()
                            is_corr = bool(opt_raw.get('isCorrect') or opt_raw.get('is_correct'))
                        else:
                            opt_text = str(opt_raw).strip()
                            is_corr = (opt_idx == correct_idx)

                        Option.objects.create(
                            question=question_obj,
                            text=opt_text,
                            is_correct=is_corr
                        )

                if imm_enabled and imm_amount > 0 and (imm_student_ids or imm_top_count > 0):
                    imm_reason = imm_reason_raw or _msg(
                        lang,
                        f"\"{test.title}\" testi qo'shilishi munosabati bilan faol ishtirok uchun 🌟",
                        f"За активное участие в связи с добавлением теста «{test.title}» 🌟",
                    )
                    target_students = []
                    if isinstance(imm_student_ids, list) and len(imm_student_ids) > 0:
                        clean_ids = []
                        for sid in imm_student_ids:
                            try:
                                iv = int(sid)
                                if iv not in clean_ids:
                                    clean_ids.append(iv)
                            except (ValueError, TypeError):
                                continue
                        st_map = {
                            st.id: st
                            for st in CustomUser.objects.select_for_update().filter(id__in=clean_ids, role='student')
                        }
                        target_students = [st_map[sid] for sid in clean_ids if sid in st_map]
                    elif imm_top_count > 0:
                        active_qs = (
                            CustomUser.objects.filter(role='student')
                            .annotate(tests_cnt=Count('results'))
                            .filter(tests_cnt__gt=0)
                            .order_by('-tests_cnt', '-coins', 'id')
                        )
                        is_all_c, _ = parse_test_grades(test.grade)
                        candidates = list(active_qs)
                        if not is_all_c:
                            grade_matched = [st for st in candidates if test_matches_grade(test.grade, st.grade)]
                            if grade_matched:
                                candidates = grade_matched
                        chosen_ids = [st.id for st in candidates[:imm_top_count]]
                        if chosen_ids:
                            st_map = {
                                st.id: st
                                for st in CustomUser.objects.select_for_update().filter(id__in=chosen_ids, role='student')
                            }
                            target_students = [st_map[sid] for sid in chosen_ids if sid in st_map]

                    for st in target_students:
                        st.coins = max(0, int(st.coins or 0) + imm_amount)
                        st.save(update_fields=['coins'])
                        CoinTransaction.objects.create(
                            student=st,
                            given_by=request.user,
                            amount=imm_amount,
                            reason=imm_reason,
                            test_result=None,
                            portal='test_create',
                        )
                        imm_rewarded_students.append({
                            'id': st.id,
                            'fullName': st.full_name,
                            'grade': st.grade or '-',
                            'amount': imm_amount,
                            'totalCoins': st.coins,
                        })

            imm_cnt = len(imm_rewarded_students)
            msg = _msg(lang, 'Test muvaffaqiyatli saqlandi!', 'Тест успешно сохранён!')
            if imm_cnt > 0:
                msg = _msg(
                    lang,
                    f"Test muvaffaqiyatli saqlandi va {imm_cnt} nafar faol o'quvchiga +{imm_amount} Diamond Coin berildi!",
                    f"Тест успешно сохранён, и {imm_cnt} активным ученикам начислено +{imm_amount} Diamond Coin!",
                )

            return JsonResponse({
                'success': True,
                'testId': test.id,
                'grade': test.grade,
                'isStudentAllowed': bool(test.is_student_allowed),
                'rewardTopCount': test.reward_top_count,
                'rewardCoinsAmount': test.reward_coins_amount,
                'rewardMinScore': test.reward_min_score,
                'immediateRewardedCount': imm_cnt,
                'immediateRewardTotalCoins': imm_cnt * imm_amount,
                'immediateRewardedStudents': imm_rewarded_students,
                'message': msg,
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': _msg(lang, "Metod qo'llab-quvvatlanmaydi", "Метод не поддерживается")}, status=405)


@csrf_exempt
def api_teacher_test_manage(request, test_id):
    lang = _req_lang(request)
    if request.method in ['PUT', 'POST', 'PATCH', 'DELETE']:
        auth_err = check_admin_permission(request)
        if auth_err:
            return auth_err
    elif request.method == 'GET':
        perm_err = check_teacher_permission(request)
        if perm_err:
            return perm_err

    try:
        test = Test.objects.get(id=test_id)
    except Test.DoesNotExist:
        return JsonResponse({'error': _msg(lang, 'Test topilmadi!', 'Тест не найден!')}, status=404)

    if request.method == 'GET':
        if not is_admin_user(request.user) and test.teacher_id != request.user.id:
            return JsonResponse({'error': _msg(lang, "Sizga faqat o'zingizga biriktirilgan testlarni ko'rishga ruxsat berilgan!", "Вам разрешено просматривать только назначенные вам тесты!")}, status=403)
        questions_list = []
        for q in test.questions.order_by('order'):
            opts = list(q.options.all())
            correct_idx = 0
            for i, opt in enumerate(opts):
                if opt.is_correct:
                    correct_idx = i
                    break
            questions_list.append({
                'id': q.id,
                'question': q.text,
                'text': q.text,
                'imageUrl': q.get_image_url(),
                'options': [o.text for o in opts],
                'correctIndex': correct_idx
            })

        is_all_classes, target_classes_list = parse_test_grades(test.grade)
        slots_used = (
            CoinTransaction.objects.filter(test_result__test=test, portal='test_bonus')
            .values('student_id')
            .distinct()
            .count()
        ) if (test.reward_top_count or 0) > 0 else 0
        allowed_now, lock_reason, lock_message, _ = _evaluate_test_student_access(test, lang=lang)
        return JsonResponse({
            'id': test.id,
            'title': test.title,
            'description': test.description,
            'subject': test.subject,
            'grade': test.grade,
            'targetClasses': target_classes_list,
            'isAllClasses': is_all_classes,
            'language': test.language or 'uz',
            'teacherId': test.teacher_id,
            'teacherName': test.teacher.full_name if test.teacher else _msg(lang, 'Administrator', 'Администратор'),
            'durationMinutes': test.duration_minutes,
            'startTimeIso': _fmt_local_iso(test.start_time),
            'endTimeIso': _fmt_local_iso(test.end_time),
            'startTime': _fmt_local_dt(test.start_time),
            'endTime': _fmt_local_dt(test.end_time),
            'maxAttempts': test.max_attempts,
            'isStudentAllowed': bool(test.is_student_allowed),
            'is_student_allowed': bool(test.is_student_allowed),
            'isActive': bool(allowed_now),
            'lockReason': lock_reason,
            'lockMessage': lock_message,
            'rewardTopCount': int(test.reward_top_count or 0),
            'rewardCoinsAmount': int(test.reward_coins_amount or 0),
            'rewardMinScore': int(test.reward_min_score or 0),
            'rewardSlotsUsed': slots_used,
            'questions': questions_list
        })

    elif request.method in ['PUT', 'POST', 'PATCH']:
        try:
            data = json.loads(request.body.decode('utf-8'))
            title = data.get('title', '').strip()
            has_grade_payload = ('grade' in data) or ('targetClasses' in data)
            grade = normalize_test_grade_value(data.get('grade'), data.get('targetClasses'))[:500] if has_grade_payload else ''

            subject = data.get('subject', '').strip()
            language = data.get('language', '').strip()
            duration_minutes = int(data.get('durationMinutes', 15))
            description = data.get('description', '').strip()
            questions_data = data.get('questions', [])

            if not title:
                return JsonResponse({'error': _msg(lang, 'Test nomi kiritilishi shart!', 'Необходимо указать название теста!')}, status=400)

            test.title = title
            if has_grade_payload and grade:
                test.grade = grade
            if subject:
                test.subject = subject
            if language:
                test.language = language
            t_id = data.get('teacherId')
            if t_id:
                new_teacher = CustomUser.objects.filter(id=t_id, role__in=['teacher', 'admin']).first()
                if new_teacher:
                    test.teacher = new_teacher
            test.duration_minutes = duration_minutes
            test.description = description

            if 'startTime' in data or 'start_time' in data:
                start_raw = data.get('startTime') if 'startTime' in data else data.get('start_time')
                test.start_time = parse_iso_datetime(start_raw)
            if 'endTime' in data or 'end_time' in data:
                end_raw = data.get('endTime') if 'endTime' in data else data.get('end_time')
                test.end_time = parse_iso_datetime(end_raw)
            if test.start_time and test.end_time and test.start_time >= test.end_time:
                return JsonResponse({'error': _msg(lang, "Testning boshlanish vaqti tugash vaqtidan oldin bo'lishi shart!", "Время начала теста должно быть раньше времени окончания!")}, status=400)
            if 'maxAttempts' in data or 'max_attempts' in data:
                test.max_attempts = int(data.get('maxAttempts', data.get('max_attempts', 1)))
            if 'isStudentAllowed' in data or 'is_student_allowed' in data:
                raw_allowed = data.get('isStudentAllowed') if 'isStudentAllowed' in data else data.get('is_student_allowed')
                test.is_student_allowed = _parse_bool_flag(raw_allowed, default=bool(test.is_student_allowed))
            if 'rewardTopCount' in data or 'reward_top_count' in data:
                test.reward_top_count = max(0, int(data.get('rewardTopCount', data.get('reward_top_count', 0)) or 0))
            if 'rewardCoinsAmount' in data or 'reward_coins_amount' in data:
                test.reward_coins_amount = max(0, int(data.get('rewardCoinsAmount', data.get('reward_coins_amount', 0)) or 0))
            if 'rewardMinScore' in data or 'reward_min_score' in data:
                test.reward_min_score = min(100, max(0, int(data.get('rewardMinScore', data.get('reward_min_score', 0)) or 0)))

            with transaction.atomic():
                test.save()

                if questions_data and len(questions_data) > 0:
                    test.questions.all().delete()
                    for idx, q_item in enumerate(questions_data, 1):
                        q_text = (q_item.get('text') or q_item.get('question') or '').strip()
                        q_img = q_item.get('imageUrl') or q_item.get('image', '')
                        opts = q_item.get('options', [])
                        correct_idx = int(q_item.get('correctIndex', 0))

                        q_obj = Question.objects.create(
                            test=test,
                            text=q_text,
                            image_url=q_img,
                            order=idx
                        )
                        for opt_idx, opt_raw in enumerate(opts):
                            if isinstance(opt_raw, dict):
                                opt_text = (opt_raw.get('text') or '').strip()
                                is_corr = bool(opt_raw.get('isCorrect') or opt_raw.get('is_correct'))
                            else:
                                opt_text = str(opt_raw).strip()
                                is_corr = (opt_idx == correct_idx)

                            Option.objects.create(
                                question=q_obj,
                                text=opt_text,
                                is_correct=is_corr
                            )

            return JsonResponse({'success': True, 'message': _msg(lang, 'Test muvaffaqiyatli tahrirlandi va saqlandi!', 'Тест успешно отредактирован и сохранён!')})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    elif request.method == 'DELETE':
        test_id_deleted = test.id
        test.delete()
        return JsonResponse({'success': True, 'deletedId': test_id_deleted, 'message': _msg(lang, "Test muvaffaqiyatli o'chirildi!", "Тест успешно удалён!")})

    return JsonResponse({'error': _msg(lang, "Metod qo'llab-quvvatlanmaydi", "Метод не поддерживается")}, status=405)





def _calc_distribution(scores_list):
    excellent = sum(1 for s in scores_list if s >= 85)
    good = sum(1 for s in scores_list if 70 <= s < 85)
    fair = sum(1 for s in scores_list if 50 <= s < 70)
    poor = sum(1 for s in scores_list if s < 50)
    return {
        'excellent': excellent,
        'good': good,
        'fair': fair,
        'poor': poor,
    }


def _calc_question_stats_for_answers(question_obj, q_answers, lang='uz'):
    total_answers = len(q_answers)
    opts = list(question_obj.options.all())
    correct_opt = next((o for o in opts if o.is_correct), None)
    if total_answers == 0:
        return {
            'questionId': question_obj.id,
            'order': question_obj.order,
            'text': question_obj.text,
            'imageUrl': question_obj.get_image_url(),
            'totalAnswers': 0,
            'correctCount': 0,
            'wrongCount': 0,
            'accuracy': None,
            'isWeak': False,
            'correctOptionText': correct_opt.text if correct_opt else '',
            'mostCommonWrongOption': '',
        }

    correct_count = sum(1 for a in q_answers if a.is_correct)
    wrong_count = total_answers - correct_count
    accuracy = round((correct_count / total_answers) * 100)

    wrong_opt_counts = {}
    for a in q_answers:
        if not a.is_correct:
            label = a.selected_option.text if a.selected_option else _msg(lang, "Tanlanmagan", "Не выбран")
            wrong_opt_counts[label] = wrong_opt_counts.get(label, 0) + 1
    common_wrong = ''
    if wrong_opt_counts:
        common_wrong = max(wrong_opt_counts.items(), key=lambda kv: kv[1])[0]

    return {
        'questionId': question_obj.id,
        'order': question_obj.order,
        'text': question_obj.text,
        'imageUrl': question_obj.get_image_url(),
        'totalAnswers': total_answers,
        'correctCount': correct_count,
        'wrongCount': wrong_count,
        'accuracy': accuracy,
        'isWeak': accuracy < 70 or wrong_count > 0 and accuracy < 75,
        'correctOptionText': correct_opt.text if correct_opt else '',
        'mostCommonWrongOption': common_wrong,
    }


def api_teacher_stats(request):
    teacher, auth_err = _resolve_authenticated_teacher_actor(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)

    is_teacher_portal = (request.GET.get('portal', '').strip().lower() == 'teacher') or (not is_admin_user(request.user))

    tests_qs = get_teacher_scoped_tests(teacher)
    tests_list = list(
        tests_qs.select_related('teacher')
        .prefetch_related('questions__options')
        .order_by('-created_at')
    )
    results_list = list(
        TestResult.objects.filter(test__in=tests_list)
        .select_related('student', 'test')
        .order_by('-submitted_at')
    )
    answers_list = list(
        StudentAnswer.objects.filter(result__test__in=tests_list)
        .select_related('result__student', 'question', 'selected_option')
    )
    all_students = list(CustomUser.objects.filter(role='student').order_by('grade', 'full_name'))

    now = timezone.now()
    site_settings = SiteSetting.get_settings()
    policy = serialize_student_tests_policy(site_settings=site_settings, now=now, lang=lang)
    active_tests_count = 0
    for t in tests_list:
        allowed_now, _, _, _ = _evaluate_test_student_access(t, now=now, site_settings=site_settings, lang=lang)
        if allowed_now:
            active_tests_count += 1

    total_tests = len(tests_list)
    total_submissions = len(results_list)
    all_scores = [int(r.score_percentage or 0) for r in results_list]
    avg_score = round(sum(all_scores) / total_submissions) if total_submissions > 0 else 0
    max_score = max(all_scores) if all_scores else 0
    min_score = min(all_scores) if all_scores else 0
    passed_count = sum(1 for s in all_scores if s >= 60)
    pass_rate = round((passed_count / total_submissions) * 100) if total_submissions > 0 else 0
    weak_submissions_count = sum(1 for s in all_scores if s < 60)
    avg_time_seconds = (
        round(sum(int(r.time_spent_seconds or 0) for r in results_list) / total_submissions)
        if total_submissions > 0 else 0
    )
    unique_students_tested = len({r.student_id for r in results_list})
    distribution = _calc_distribution(all_scores)

    # Index helper maps
    results_by_test = {}
    for r in results_list:
        results_by_test.setdefault(r.test_id, []).append(r)

    answers_by_question = {}
    answers_by_class = {}
    for a in answers_list:
        answers_by_question.setdefault(a.question_id, []).append(a)
        st_grade = (a.result.student.grade or '').strip() if a.result and a.result.student else ''
        if st_grade:
            answers_by_class.setdefault(st_grade.lower(), []).append(a)

    # Build canonical ordered list of classes
    active_classes_meta = get_active_classes_meta()
    sc_details = {sc.name: sc for sc in SchoolClass.objects.filter(is_active=True)}
    known_lower = {c['name'].lower(): c['name'] for c in active_classes_meta}
    ordered_class_entries = list(active_classes_meta)

    extra_grades = set()
    for st in all_students:
        g = (st.grade or '').strip()
        if g and g.lower() not in known_lower:
            known_lower[g.lower()] = g
            extra_grades.add(g)
    for r in results_list:
        g = (r.student.grade or '').strip() if r.student else ''
        if g and g.lower() not in known_lower:
            known_lower[g.lower()] = g
            extra_grades.add(g)

    for eg in sorted(extra_grades):
        st_in_eg = [s for s in all_students if (s.grade or '').strip().lower() == eg.lower()]
        ordered_class_entries.append({
            'name': eg,
            'language': 'ru' if 'RU' in eg.upper() else 'uz',
            'studentsCount': len(st_in_eg),
            'totalCoins': sum(int(s.coins or 0) for s in st_in_eg),
        })

    students_by_class_lower = {}
    for st in all_students:
        g_low = (st.grade or '').strip().lower()
        if g_low:
            students_by_class_lower.setdefault(g_low, []).append(st)

    # 1. Per-test detailed breakdown & question stats
    test_breakdown = []
    global_weak_questions = []

    for t in tests_list:
        t_res = results_by_test.get(t.id, [])
        t_scores = [int(r.score_percentage or 0) for r in t_res]
        sub_count = len(t_res)
        t_unique = len({r.student_id for r in t_res})
        t_avg = round(sum(t_scores) / sub_count) if sub_count > 0 else 0
        t_max = max(t_scores) if t_scores else 0
        t_min = min(t_scores) if t_scores else 0
        t_passed = sum(1 for s in t_scores if s >= 60)
        t_pass_rate = round((t_passed / sub_count) * 100) if sub_count > 0 else 0
        t_weak = sum(1 for s in t_scores if s < 60)
        t_avg_time = round(sum(int(r.time_spent_seconds or 0) for r in t_res) / sub_count) if sub_count > 0 else 0

        allowed_now, lock_reason_t, lock_msg_t, acc_meta = _evaluate_test_student_access(
            t, now=now, site_settings=site_settings, lang=lang
        )
        is_up = acc_meta['isUpcoming']
        is_exp = acc_meta['isExpired']
        is_act = bool(allowed_now)
        is_all_cls, target_cls_list = parse_test_grades(t.grade)

        eligible_students = [
            s for s in all_students if test_matches_grade(t.grade, s.grade)
        ] if not is_all_cls else all_students
        eligible_tested = len({r.student_id for r in t_res if any(s.id == r.student_id for s in eligible_students)})
        eligible_count = len(eligible_students)
        completion_rate = round((eligible_tested / eligible_count) * 100) if eligible_count > 0 else 0

        # Per-class performance on this test
        res_by_cls_low = {}
        for r in t_res:
            g_str = (r.student.grade or 'Belgilanmagan').strip() or 'Belgilanmagan'
            res_by_cls_low.setdefault(g_str.lower(), []).append(r)

        by_class_list = []
        included_cls_low = set()
        for entry in ordered_class_entries:
            cname = entry['name']
            clow = cname.lower()
            is_target = test_matches_grade(t.grade, cname)
            c_res = res_by_cls_low.get(clow, [])
            c_stds = students_by_class_lower.get(clow, [])
            # Include target classes with students or any class with submissions
            if (is_target and not is_all_cls) or (is_all_cls and len(c_stds) > 0) or len(c_res) > 0:
                included_cls_low.add(clow)
                c_scores = [int(r.score_percentage or 0) for r in c_res]
                c_subs = len(c_res)
                c_unique = len({r.student_id for r in c_res})
                c_pass = sum(1 for s in c_scores if s >= 60)
                by_class_list.append({
                    'className': cname,
                    'language': entry['language'],
                    'isTarget': is_target,
                    'studentsInClass': len(c_stds),
                    'submissions': c_subs,
                    'uniqueStudents': c_unique,
                    'completionRate': round((c_unique / len(c_stds)) * 100) if len(c_stds) > 0 else 0,
                    'avgScore': round(sum(c_scores) / c_subs) if c_subs > 0 else 0,
                    'minScore': min(c_scores) if c_scores else 0,
                    'maxScore': max(c_scores) if c_scores else 0,
                    'passRate': round((c_pass / c_subs) * 100) if c_subs > 0 else 0,
                    'weakCount': sum(1 for s in c_scores if s < 60),
                })

        # Also handle unassigned-grade student results if any
        if 'belgilanmagan' in res_by_cls_low and 'belgilanmagan' not in included_cls_low:
            c_res = res_by_cls_low['belgilanmagan']
            c_scores = [int(r.score_percentage or 0) for r in c_res]
            c_subs = len(c_res)
            by_class_list.append({
                'className': 'Belgilanmagan',
                'language': 'uz',
                'isTarget': False,
                'studentsInClass': 0,
                'submissions': c_subs,
                'uniqueStudents': len({r.student_id for r in c_res}),
                'completionRate': 0,
                'avgScore': round(sum(c_scores) / c_subs) if c_subs > 0 else 0,
                'minScore': min(c_scores) if c_scores else 0,
                'maxScore': max(c_scores) if c_scores else 0,
                'passRate': round((sum(1 for s in c_scores if s >= 60) / c_subs) * 100) if c_subs > 0 else 0,
                'weakCount': sum(1 for s in c_scores if s < 60),
            })

        # Question accuracy stats for this test
        q_stats = []
        t_questions = list(t.questions.all())
        t_questions.sort(key=lambda x: (x.order, x.id))
        for q in t_questions:
            qs_row = _calc_question_stats_for_answers(q, answers_by_question.get(q.id, []), lang=lang)
            q_stats.append(qs_row)
            if qs_row['totalAnswers'] > 0 and (qs_row['wrongCount'] > 0 or (qs_row['accuracy'] is not None and qs_row['accuracy'] < 80)):
                global_weak_questions.append({
                    **qs_row,
                    'testId': t.id,
                    'testTitle': t.title,
                    'testSubject': t.subject,
                    'testGrade': t.grade,
                })

        test_breakdown.append({
            'id': t.id,
            'title': t.title,
            'subject': t.subject,
            'grade': t.grade,
            'targetClasses': target_cls_list,
            'isAllClasses': is_all_cls,
            'language': t.language or 'uz',
            'teacherName': t.teacher.full_name if t.teacher else _msg(lang, 'Administrator', 'Администратор'),
            'isStudentAllowed': bool(t.is_student_allowed),
            'isActive': is_act,
            'isUpcoming': is_up,
            'isExpired': is_exp,
            'questionsCount': len(t_questions),
            'eligibleStudentsCount': eligible_count,
            'eligibleTestedCount': eligible_tested,
            'completionRate': completion_rate,
            'submissions': sub_count,
            'uniqueStudents': t_unique,
            'avgScore': t_avg,
            'minScore': t_min,
            'maxScore': t_max,
            'passRate': t_pass_rate,
            'weakCount': t_weak,
            'avgTimeSeconds': t_avg_time,
            'distribution': _calc_distribution(t_scores),
            'byClass': by_class_list,
            'questionStats': q_stats,
        })

    global_weak_questions.sort(key=lambda x: (x['accuracy'] if x['accuracy'] is not None else 101, -x['wrongCount']))

    # 2. Comprehensive Per-Class Statistics (Sinflar va Har bir sinf statistikasi)
    results_by_student = {}
    for r in results_list:
        results_by_student.setdefault(r.student_id, []).append(r)

    class_stats = []
    for entry in ordered_class_entries:
        cname = entry['name']
        clow = cname.lower()
        sc = sc_details.get(cname)
        cls_students = students_by_class_lower.get(clow, [])
        cls_results = [
            r for r in results_list
            if r.student and (r.student.grade or '').strip().lower() == clow
        ]
        cls_scores = [int(r.score_percentage or 0) for r in cls_results]
        cls_subs = len(cls_results)
        cls_avg = round(sum(cls_scores) / cls_subs) if cls_subs > 0 else 0
        cls_max = max(cls_scores) if cls_scores else 0
        cls_min = min(cls_scores) if cls_scores else 0
        cls_passed = sum(1 for s in cls_scores if s >= 60)
        cls_pass_rate = round((cls_passed / cls_subs) * 100) if cls_subs > 0 else 0
        cls_weak_results = sum(1 for s in cls_scores if s < 60)
        cls_avg_time = round(sum(int(r.time_spent_seconds or 0) for r in cls_results) / cls_subs) if cls_subs > 0 else 0

        cls_assigned_tests = [t for t in tests_list if test_matches_grade(t.grade, cname)]
        assigned_test_ids = {t.id for t in cls_assigned_tests}
        active_assigned_ids = {
            t.id for t in cls_assigned_tests
            if _evaluate_test_student_access(t, now=now, site_settings=site_settings, lang=lang)[0]
        }

        # Include assigned tests plus any test taken by students of this class
        taken_test_ids_in_cls = {r.test_id for r in cls_results}
        relevant_tests_for_cls = list(cls_assigned_tests)
        for t in tests_list:
            if t.id in taken_test_ids_in_cls and t.id not in assigned_test_ids:
                relevant_tests_for_cls.append(t)

        cls_tests_detail = []
        for t in relevant_tests_for_cls:
            t_cls_res = [r for r in cls_results if r.test_id == t.id]
            t_cls_scores = [int(r.score_percentage or 0) for r in t_cls_res]
            t_cls_subs = len(t_cls_res)
            t_cls_unique = len({r.student_id for r in t_cls_res})
            is_all_t, _ = parse_test_grades(t.grade)
            t_cls_allowed, _, _, _ = _evaluate_test_student_access(t, now=now, site_settings=site_settings, lang=lang)
            cls_tests_detail.append({
                'id': t.id,
                'title': t.title,
                'subject': t.subject,
                'grade': t.grade,
                'isAllClasses': is_all_t,
                'isAssigned': t.id in assigned_test_ids,
                'isStudentAllowed': bool(t.is_student_allowed),
                'isActive': bool(t_cls_allowed),
                'questionsCount': t.questions.count(),
                'studentsInClass': len(cls_students),
                'submissionsInClass': t_cls_subs,
                'uniqueStudentsInClass': t_cls_unique,
                'notTestedCount': max(0, len(cls_students) - t_cls_unique),
                'avgScore': round(sum(t_cls_scores) / t_cls_subs) if t_cls_subs > 0 else 0,
                'maxScore': max(t_cls_scores) if t_cls_scores else 0,
                'minScore': min(t_cls_scores) if t_cls_scores else 0,
                'passRate': round((sum(1 for s in t_cls_scores if s >= 60) / t_cls_subs) * 100) if t_cls_subs > 0 else 0,
            })

        # Per-student roster stats in this class
        cls_student_ids = {s.id for s in cls_students}
        cls_tested_roster_ids = {r.student_id for r in cls_results if r.student_id in cls_student_ids}
        participation_rate = round((len(cls_tested_roster_ids) / len(cls_students)) * 100) if len(cls_students) > 0 else 0

        students_detail = []
        not_tested_students_count = 0
        low_avg_students_count = 0
        missing_any_assigned_count = 0

        for s in cls_students:
            s_res = results_by_student.get(s.id, [])
            s_scores = [int(r.score_percentage or 0) for r in s_res]
            attempts_cnt = len(s_res)
            taken_ids = {r.test_id for r in s_res}
            missing_cnt = len(active_assigned_ids - taken_ids)
            if attempts_cnt == 0 and len(cls_assigned_tests) > 0:
                not_tested_students_count += 1
            if missing_cnt > 0:
                missing_any_assigned_count += 1
            s_avg = round(sum(s_scores) / attempts_cnt) if attempts_cnt > 0 else 0
            if attempts_cnt > 0 and s_avg < 60:
                low_avg_students_count += 1
            s_best = max(s_scores) if s_scores else 0
            last_r = s_res[0] if s_res else None
            if attempts_cnt == 0:
                st_status = 'not_started'
            elif s_avg >= 85:
                st_status = 'excellent'
            elif s_avg >= 60:
                st_status = 'good'
            else:
                st_status = 'weak'

            students_detail.append({
                'id': s.id,
                'fullName': s.full_name or s.username,
                'username': s.username,
                'avatarUrl': s.get_avatar_url(),
                'coins': int(s.coins or 0),
                'attemptsCount': attempts_cnt,
                'testsTakenCount': len(taken_ids),
                'assignedTestsCount': len(cls_assigned_tests),
                'missingAssignedTestsCount': missing_cnt,
                'avgScore': s_avg,
                'bestScore': s_best,
                'lastScore': int(last_r.score_percentage or 0) if last_r else None,
                'lastTestTitle': last_r.test.title if last_r and last_r.test else None,
                'lastSubmittedAt': last_r.submitted_at.strftime('%d.%m.%Y %H:%M') if last_r and last_r.submitted_at else None,
                'status': st_status,
            })

        # Per-class question weaknesses from StudentAnswers of students in this class
        cls_answers = answers_by_class.get(clow, [])
        cls_ans_by_q = {}
        for a in cls_answers:
            cls_ans_by_q.setdefault(a.question_id, []).append(a)
        cls_weak_questions = []
        for q_id, q_ans in cls_ans_by_q.items():
            q_obj = q_ans[0].question
            q_row = _calc_question_stats_for_answers(q_obj, q_ans, lang=lang)
            if q_row['totalAnswers'] > 0 and (q_row['wrongCount'] > 0 or (q_row['accuracy'] is not None and q_row['accuracy'] < 85)):
                cls_weak_questions.append({
                    **q_row,
                    'testId': q_obj.test_id,
                    'testTitle': q_obj.test.title if q_obj.test else '',
                })
        cls_weak_questions.sort(key=lambda x: (x['accuracy'] if x['accuracy'] is not None else 101, -x['wrongCount']))

        class_stats.append({
            'className': cname,
            'language': entry['language'],
            'languageLabel': (
                _msg(lang, "Rus sinfi", "Русский класс")
                if entry['language'] == 'ru'
                else _msg(lang, "O'zbek sinfi", "Узбекский класс")
            ),
            'room': sc.room if sc and sc.room else '-',
            'headTeacher': sc.head_teacher if sc and sc.head_teacher else '-',
            'studentsCount': len(cls_students),
            'assignedTestsCount': len(cls_assigned_tests),
            'activeAssignedTestsCount': len(active_assigned_ids),
            'submissionsCount': cls_subs,
            'uniqueStudentsTested': len({r.student_id for r in cls_results}),
            'participationRate': participation_rate,
            'avgScore': cls_avg,
            'maxScore': cls_max,
            'minScore': cls_min,
            'passRate': cls_pass_rate,
            'weakResultsCount': cls_weak_results,
            'lowAvgStudentsCount': low_avg_students_count,
            'notTestedStudentsCount': not_tested_students_count,
            'missingAnyAssignedCount': missing_any_assigned_count,
            'avgTimeSeconds': cls_avg_time,
            'totalCoins': sum(int(s.coins or 0) for s in cls_students),
            'distribution': _calc_distribution(cls_scores),
            'assignedTests': cls_tests_detail,
            'students': students_detail,
            'weakQuestions': cls_weak_questions[:15],
        })

    # Recent student submissions
    recent_submissions = []
    for r in results_list[:20]:
        recent_submissions.append({
            'resultId': r.id,
            'studentId': r.student.id,
            'studentName': r.student.full_name,
            'studentCoins': r.student.coins,
            'grade': r.student.grade or '-',
            'testId': r.test.id,
            'testTitle': r.test.title,
            'correct': r.correct_answers,
            'total': r.total_questions,
            'score': r.score_percentage,
            'timeSpent': r.time_spent_seconds,
            'date': r.submitted_at.strftime('%d.%m.%Y %H:%M')
        })

    return JsonResponse({
        'totalTests': total_tests,
        'testsCount': total_tests,
        'activeTestsCount': active_tests_count,
        'totalSubmissions': total_submissions,
        'submissionsCount': total_submissions,
        'uniqueStudentsTested': unique_students_tested,
        'totalStudentsCount': len(all_students),
        'avgScore': avg_score,
        'minScore': min_score,
        'maxScore': max_score,
        'passRate': pass_rate,
        'weakSubmissionsCount': weak_submissions_count,
        'avgTimeSeconds': avg_time_seconds,
        'distribution': distribution,
        'testBreakdown': test_breakdown,
        'classStats': class_stats,
        'weakQuestions': global_weak_questions[:20],
        'recentSubmissions': recent_submissions,
        'studentTestsPolicy': policy,
        'dailyCoinStatus': get_teacher_daily_coin_status(request.user, enforce_for_portal=is_teacher_portal),
    })


# ================= 🎓 STUDENT APIS =================

def api_student_tests(request):
    lang = _req_lang(request)
    student_id = request.GET.get('studentId')
    requested_grade = (request.GET.get('grade') or '').strip()
    subject_filter = request.GET.get('subject')
    lang_filter = request.GET.get('lang')

    student = None
    if student_id:
        student = CustomUser.objects.filter(id=student_id).first()
    elif request.user.is_authenticated:
        student = request.user

    # Qat'iy sinf izolyatsiyasi: o'quvchi faqat o'z sinfiga tegishli (yoki 'Barchasi') testlarni ko'radi
    enforce_student_grade_only = bool(student and student.role == 'student')
    if enforce_student_grade_only:
        effective_grade = (student.grade or '').strip()
    else:
        effective_grade = requested_grade

    now = timezone.now()
    site_settings = SiteSetting.get_settings()
    policy = serialize_student_tests_policy(site_settings=site_settings, now=now, lang=lang)

    tests = Test.objects.select_related('teacher').all()
    if subject_filter and subject_filter != 'all':
        tests = tests.filter(subject=subject_filter)
    if lang_filter and lang_filter != 'all':
        tests = tests.filter(language=lang_filter)

    test_qs = list(tests.order_by('-created_at'))
    if enforce_student_grade_only:
        if effective_grade:
            test_qs = [t for t in test_qs if test_matches_grade(t.grade, effective_grade)]
        else:
            test_qs = [t for t in test_qs if parse_test_grades(t.grade)[0]]
    elif effective_grade and effective_grade.lower() not in ('all', 'barchasi'):
        test_qs = [t for t in test_qs if test_matches_grade(t.grade, effective_grade)]

    data = []
    for t in test_qs:
        if student and student.role == 'student':
            results = TestResult.objects.filter(test=t, student=student).order_by('-submitted_at')
            attempts_count = results.count()
            last_result = results.first() if attempts_count > 0 else None
        else:
            attempts_count = 0
            last_result = None

        max_attempts = t.max_attempts
        if max_attempts > 0:
            attempts_left = max(0, max_attempts - attempts_count)
            has_attempts = (attempts_count < max_attempts)
        else:
            attempts_left = _msg(lang, 'cheksiz', 'безлимит')
            has_attempts = True

        allowed_now, lock_reason, lock_message, access_meta = _evaluate_test_student_access(
            t, now=now, site_settings=site_settings, lang=lang
        )
        is_upcoming = access_meta['isUpcoming']
        is_expired = access_meta['isExpired']

        if not allowed_now:
            can_start = False
            effective_lock_reason = lock_reason
            effective_lock_message = lock_message
        elif not has_attempts:
            can_start = False
            effective_lock_reason = 'max_attempts_reached'
            effective_lock_message = _msg(
                lang,
                f"Ushbu test uchun ajratilgan maksimal urinishlar ({max_attempts} marta) sonidan to'liq foydalanib bo'ldingiz!",
                f"Вы полностью использовали максимальное количество попыток для этого теста ({max_attempts} раз)!",
            )
        else:
            can_start = True
            effective_lock_reason = None
            effective_lock_message = ''

        t_name = t.teacher.full_name if t.teacher else _msg(lang, 'Administrator', 'Администратор')
        is_all_classes, target_classes_list = parse_test_grades(t.grade)
        r_top = int(t.reward_top_count or 0)
        r_amt = int(t.reward_coins_amount or 0)
        r_min = int(t.reward_min_score or 0)
        r_used = (
            CoinTransaction.objects.filter(test_result__test=t, portal='test_bonus')
            .values('student_id')
            .distinct()
            .count()
        ) if (r_top > 0 and r_amt > 0) else 0

        data.append({
            'id': t.id,
            'title': t.title,
            'description': t.description,
            'subject': t.subject,
            'teacherName': t_name,
            'teacher_name': t_name,
            'grade': t.grade,
            'targetClasses': target_classes_list,
            'isAllClasses': is_all_classes,
            'language': t.language or 'uz',
            'durationMinutes': t.duration_minutes,
            'questionCount': t.questions.count(),
            'completed': attempts_count > 0,
            'attemptsCount': attempts_count,
            'maxAttempts': max_attempts,
            'attemptsLeft': attempts_left,
            'hasAttempts': has_attempts,
            'canStart': can_start,
            'isStudentAllowed': bool(t.is_student_allowed),
            'is_student_allowed': bool(t.is_student_allowed),
            'portalTestsEnabled': policy['enabled'],
            'portalOpen': policy['portalOpen'],
            'portalStartTime': policy['startTime'],
            'portalEndTime': policy['endTime'],
            'lockReason': effective_lock_reason,
            'lockMessage': effective_lock_message,
            'isUpcoming': is_upcoming,
            'isExpired': is_expired,
            'rewardTopCount': r_top,
            'rewardCoinsAmount': r_amt,
            'rewardMinScore': r_min,
            'rewardSlotsUsed': r_used,
            'rewardSlotsLeft': max(0, r_top - r_used) if r_top > 0 else 0,
            'startTime': _fmt_local_dt(t.start_time),
            'endTime': _fmt_local_dt(t.end_time),
            'userScore': last_result.score_percentage if last_result else None,
            'userCorrect': last_result.correct_answers if last_result else None
        })

    return JsonResponse(data, safe=False)


def api_student_test_detail(request, test_id):
    lang = _req_lang(request)
    try:
        test = Test.objects.get(id=test_id)
        now = timezone.now()

        # 1. Global portal + Admin ruxsati + belgilangan vaqt nazorati (qattiq backend tekshiruvi)
        allowed_now, lock_reason, lock_message, _ = _evaluate_test_student_access(test, now=now, lang=lang)
        if not allowed_now:
            return JsonResponse({
                'error': lock_message,
                'lockReason': lock_reason,
            }, status=403)

        # 2. O'quvchini aniqlash va sinfini + urinishlar sonini tekshirish
        student_id = request.GET.get('studentId')
        student = None
        if student_id:
            student = CustomUser.objects.filter(id=student_id).first()
        elif request.user.is_authenticated:
            student = request.user

        if student and student.role == 'student':
            is_all_cls, _ = parse_test_grades(test.grade)
            if not is_all_cls:
                if not (student.grade or '').strip() or not test_matches_grade(test.grade, student.grade):
                    st_grade_disp = student.grade or _msg(lang, 'biriktirilmagan', 'не указан')
                    return JsonResponse({
                        'error': _msg(
                            lang,
                            f"Ushbu test faqat '{test.grade}' sinf(lar)i uchun mo'ljallangan! Sizning sinfingiz: {st_grade_disp}.",
                            f"Этот тест предназначен только для класса(ов) '{test.grade}'! Ваш класс: {st_grade_disp}.",
                        )
                    }, status=403)

        if student and test.max_attempts > 0:
            attempts_count = TestResult.objects.filter(test=test, student=student).count()
            if attempts_count >= test.max_attempts:
                return JsonResponse({
                    'error': _msg(
                        lang,
                        f"Siz bu test uchun ajratilgan maksimal urinishlar sonidan ({test.max_attempts} marta) to'liq foydalanib bo'ldingiz! Qayta topshirish taqiqlangan.",
                        f"Вы полностью использовали максимальное количество попыток для этого теста ({test.max_attempts} раз)! Повторная сдача запрещена.",
                    )
                }, status=403)

        questions = []
        for q in test.questions.order_by('order'):
            opts = [{'id': o.id, 'text': o.text} for o in q.options.all()]
            questions.append({
                'id': q.id,
                'question': q.text,
                'text': q.text,
                'imageUrl': q.get_image_url(),
                'options': opts
            })

        r_top = int(test.reward_top_count or 0)
        r_amt = int(test.reward_coins_amount or 0)
        r_min = int(test.reward_min_score or 0)
        r_used = (
            CoinTransaction.objects.filter(test_result__test=test, portal='test_bonus')
            .values('student_id')
            .distinct()
            .count()
        ) if (r_top > 0 and r_amt > 0) else 0

        return JsonResponse({
            'id': test.id,
            'title': test.title,
            'description': test.description,
            'subject': test.subject,
            'grade': test.grade,
            'language': test.language or 'uz',
            'teacherName': test.teacher.full_name if test.teacher else _msg(lang, 'Administrator', 'Администратор'),
            'durationMinutes': test.duration_minutes,
            'maxAttempts': test.max_attempts,
            'rewardTopCount': r_top,
            'rewardCoinsAmount': r_amt,
            'rewardMinScore': r_min,
            'rewardSlotsUsed': r_used,
            'rewardSlotsLeft': max(0, r_top - r_used) if r_top > 0 else 0,
            'startTime': _fmt_local_dt(test.start_time),
            'endTime': _fmt_local_dt(test.end_time),
            'questions': questions
        })
    except Test.DoesNotExist:
        return JsonResponse({'error': _msg(lang, 'Test topilmadi!', 'Тест не найден!')}, status=404)


@csrf_exempt
def api_student_submit_test(request, test_id):
    lang = _req_lang(request)
    if request.method != 'POST':
        return JsonResponse({'error': _msg(lang, 'Faqat POST qabul qilinadi', 'Принимаются только POST-запросы')}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
        student_id = data.get('studentId')
        answers = data.get('answers', {})  # { question_id: selected_option_id }
        time_spent_seconds = max(0, int(data.get('timeSpentSeconds', 0) or 0))

        student = None
        if student_id:
            student = CustomUser.objects.filter(id=student_id).first()
        elif request.user.is_authenticated:
            student = request.user

        if not student:
            return JsonResponse({'error': _msg(lang, "O'quvchi topilmadi!", "Ученик не найден!")}, status=400)

        try:
            test = Test.objects.get(id=test_id)
        except Test.DoesNotExist:
            return JsonResponse({'error': _msg(lang, 'Test topilmadi!', 'Тест не найден!')}, status=404)

        now = timezone.now()

        # Global portal + Admin ruxsati + belgilangan vaqt nazorati (qattiq backend tekshiruvi)
        allowed_now, lock_reason, lock_message, _ = _evaluate_test_student_access(test, now=now, lang=lang)
        if not allowed_now:
            return JsonResponse({
                'error': lock_message,
                'lockReason': lock_reason,
            }, status=403)

        # Sinf izolyatsiyasi: o'quvchi faqat o'z sinfiga biriktirilgan testni topshira oladi
        if student.role == 'student':
            is_all_cls, _ = parse_test_grades(test.grade)
            if not is_all_cls:
                if not (student.grade or '').strip() or not test_matches_grade(test.grade, student.grade):
                    return JsonResponse({
                        'error': _msg(
                            lang,
                            f"Ruxsat yo'q: ushbu test faqat '{test.grade}' sinf(lar)i uchun mo'ljallangan!",
                            f"Доступ запрещён: этот тест предназначен только для класса(ов) '{test.grade}'!",
                        )
                    }, status=403)

        if test.max_attempts > 0:
            attempts_count = TestResult.objects.filter(test=test, student=student).count()
            if attempts_count >= test.max_attempts:
                return JsonResponse({
                    'error': _msg(
                        lang,
                        f"Siz ushbu test uchun ajratilgan maksimal urinishlar ({test.max_attempts} marta) sonidan to'liq foydalangansiz!",
                        f"Вы полностью использовали максимальное количество попыток для этого теста ({test.max_attempts} раз)!",
                    )
                }, status=403)
        questions = test.questions.all()
        total_q = questions.count()
        correct_count = 0
        detailed_breakdown = []

        # Create or update Result
        test_result = TestResult.objects.create(
            test=test,
            student=student,
            total_questions=total_q,
            time_spent_seconds=time_spent_seconds
        )

        for q in questions:
            selected_opt_id = answers.get(str(q.id)) or answers.get(q.id)
            selected_option = None
            if selected_opt_id:
                selected_option = Option.objects.filter(id=selected_opt_id, question=q).first()

            correct_option = q.options.filter(is_correct=True).first()
            is_correct = (selected_option is not None) and (selected_option.is_correct)

            if is_correct:
                correct_count += 1

            StudentAnswer.objects.create(
                result=test_result,
                question=q,
                selected_option=selected_option,
                is_correct=is_correct
            )

            detailed_breakdown.append({
                'questionText': q.text,
                'imageUrl': q.get_image_url(),
                'selectedText': selected_option.text if selected_option else _msg(lang, 'Tanlanmagan', 'Не выбран'),
                'correctText': correct_option.text if correct_option else '',
                'isCorrect': is_correct
            })

        score_percent = round((correct_count / total_q * 100)) if total_q > 0 else 0
        test_result.correct_answers = correct_count
        test_result.score_percentage = score_percent
        test_result.save()

        # O'quvchilarga testdagi faollik va yuqori natijalar uchun avtomatik Diamond Coin berish
        if score_percent == 100:
            base_coins = 50
        elif score_percent >= 85:
            base_coins = 35
        elif score_percent >= 70:
            base_coins = 20
        elif score_percent >= 50:
            base_coins = 10
        else:
            base_coins = 5  # Ishtirok uchun rag'bat

        bonus_coins_earned = 0
        bonus_slot_rank = None
        with transaction.atomic():
            locked_test = Test.objects.select_for_update().get(id=test.id)
            locked_student = CustomUser.objects.select_for_update().get(id=student.id)

            if base_coins > 0:
                locked_student.coins += base_coins
                CoinTransaction.objects.create(
                    student=locked_student,
                    given_by=None,
                    amount=base_coins,
                    reason=_msg(
                        lang,
                        f"\"{locked_test.title}\" testida {score_percent}% natija uchun 🏆",
                        f"За результат {score_percent}% в тесте «{locked_test.title}» 🏆",
                    ),
                    test_result=test_result,
                    portal='test_score',
                )

            if (
                int(locked_test.reward_top_count or 0) > 0
                and int(locked_test.reward_coins_amount or 0) > 0
                and score_percent >= int(locked_test.reward_min_score or 0)
            ):
                already_won_bonus = CoinTransaction.objects.filter(
                    test_result__test=locked_test,
                    student=locked_student,
                    portal='test_bonus',
                ).exists()
                slots_used = (
                    CoinTransaction.objects.filter(
                        test_result__test=locked_test,
                        portal='test_bonus',
                    )
                    .values('student_id')
                    .distinct()
                    .count()
                )
                if (not already_won_bonus) and slots_used < int(locked_test.reward_top_count):
                    bonus_coins_earned = int(locked_test.reward_coins_amount)
                    bonus_slot_rank = slots_used + 1
                    locked_student.coins += bonus_coins_earned
                    CoinTransaction.objects.create(
                        student=locked_student,
                        given_by=None,
                        amount=bonus_coins_earned,
                        reason=_msg(
                            lang,
                            f"\"{locked_test.title}\" testida birinchi {locked_test.reward_top_count} faol qatnashchi ({bonus_slot_rank}-o'rin) bonusi ⚡",
                            f"Бонус первых {locked_test.reward_top_count} активных участников в тесте «{locked_test.title}» ({bonus_slot_rank}-е место) ⚡",
                        ),
                        test_result=test_result,
                        portal='test_bonus',
                    )

            locked_student.save(update_fields=['coins'])
            student = locked_student

        earned_coins = base_coins + bonus_coins_earned

        mins = time_spent_seconds // 60
        secs = time_spent_seconds % 60
        time_spent_display = f"{mins}:{secs:02d}"

        return JsonResponse({
            'success': True,
            'score': correct_count,
            'correctAnswers': correct_count,
            'total': total_q,
            'totalQuestions': total_q,
            'percentage': score_percent,
            'score_percentage': score_percent,
            'scorePercentage': score_percent,
            'timeSpent': time_spent_display,
            'timeSpentSeconds': time_spent_seconds,
            'baseCoinsEarned': base_coins,
            'bonusCoinsEarned': bonus_coins_earned,
            'bonusSlotRank': bonus_slot_rank,
            'earnedCoins': earned_coins,
            'coinsEarned': earned_coins,
            'totalCoins': student.coins,
            'breakdown': detailed_breakdown
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


def api_student_leaderboard(request):
    grade = request.GET.get('grade')
    if not grade:
        if request.user.is_authenticated and request.user.role == 'student' and request.user.grade:
            grade = request.user.grade
        else:
            grade = 'all'

    if grade and grade != 'all':
        classmates = CustomUser.objects.filter(role='student', grade=grade)
    else:
        classmates = CustomUser.objects.filter(role='student')

    leaderboard = []

    for s in classmates:
        results = TestResult.objects.filter(student=s)
        tests_count = results.count()
        total_correct = results.aggregate(sum=Sum('correct_answers'))['sum'] or 0
        total_score = results.aggregate(sum=Sum('score_percentage'))['sum'] or 0
        avg_score = round(total_score / tests_count) if tests_count > 0 else 0

        leaderboard.append({
            'studentId': s.id,
            'fullName': s.full_name,
            'username': s.username,
            'grade': s.grade or '-',
            'avatarUrl': s.get_avatar_url(),
            'testsCompleted': tests_count,
            'totalCorrect': total_correct,
            'avgScore': avg_score,
            'totalScore': total_score,
            'coins': s.coins
        })

    # Sort: coins desc, totalScore desc, avgScore desc
    leaderboard.sort(key=lambda x: (x['coins'], x['totalScore'], x['avgScore']), reverse=True)

    ranked = []
    for idx, item in enumerate(leaderboard, 1):
        item['rank'] = idx
        ranked.append(item)

    return JsonResponse({'grade': grade, 'leaderboard': ranked})


def api_student_my_results(request):
    lang = _req_lang(request)
    student_id = request.GET.get('studentId')
    student = None
    if student_id:
        student = CustomUser.objects.filter(id=student_id).first()
    elif request.user.is_authenticated:
        student = request.user

    if not student:
        return JsonResponse({'error': _msg(lang, "O'quvchi aniqlanmadi", "Ученик не определён")}, status=400)

    results = TestResult.objects.filter(student=student).select_related('test').order_by('-submitted_at')
    data = []
    for r in results:
        submitted_str = r.submitted_at.strftime('%d.%m.%Y %H:%M') if r.submitted_at else '-'
        data.append({
            'id': r.id,
            'testId': r.test_id,
            'testTitle': r.test.title,
            'test_title': r.test.title,
            'subject': r.test.subject,
            'grade': r.test.grade,
            'correct': r.correct_answers,
            'correctAnswers': r.correct_answers,
            'total': r.total_questions,
            'totalQuestions': r.total_questions,
            'total_questions': r.total_questions,
            'score': r.score_percentage,
            'score_percentage': r.score_percentage,
            'percentage': r.score_percentage,
            'timeSpent': r.time_spent_seconds,
            'date': submitted_str,
            'submitted_at': submitted_str,
        })

    return JsonResponse(data, safe=False)



# ================= 💎 DIAMOND SHOWCASE API (Hogwarts Style) =================

def api_diamond_showcase(request):
    """Hogwarts.uz uslubidagi Diamond School bosh sahifasi uchun API"""
    lang = _req_lang(request)
    # 1. Top o'quvchilar (Leaderboard)
    students = CustomUser.objects.filter(role='student')
    students_list = []
    for s in students:
        results = TestResult.objects.filter(student=s)
        tests_count = results.count()
        if tests_count > 0:
            total_score = results.aggregate(s=Sum('score_percentage'))['s'] or 0
            avg_score = round(total_score / tests_count)
            students_list.append({
                'id': s.id,
                'fullName': s.full_name or s.username,
                'grade': s.grade or '9-A',
                'testsCompleted': tests_count,
                'avgScore': avg_score,
                'totalScore': total_score,
                'avatarUrl': s.get_avatar_url(),
                'bio': s.bio or _msg(lang, "Bilimga intiluvchan o'quvchi", 'Целеустремлённый ученик')
            })

    # Sort by totalScore, then avgScore
    students_list.sort(key=lambda x: (x['totalScore'], x['avgScore']), reverse=True)

    # Agar o'quvchilar kam bo'lsa, namunaviy nufuzli reyting qo'shiladi
    default_champions = [
        {'id': 101, 'fullName': 'Azizbek Toxirov', 'grade': '10-A', 'testsCompleted': 24, 'avgScore': 98, 'totalScore': 2350, 'avatarUrl': 'https://api.dicebear.com/7.x/initials/svg?seed=AT&backgroundColor=0284c7,0077b6', 'bio': _msg(lang, "Respublika olimpiadasi mutlaq g'olibi", 'Абсолютный победитель республиканской олимпиады')},
        {'id': 102, 'fullName': 'Malika Karimova', 'grade': '9-B', 'testsCompleted': 22, 'avgScore': 95, 'totalScore': 2090, 'avatarUrl': 'https://api.dicebear.com/7.x/initials/svg?seed=MK&backgroundColor=00b4d8,0284c7', 'bio': _msg(lang, 'Xalqaro biologiya musobaqasi sovrindori', 'Призёр международного конкурса по биологии')},
        {'id': 103, 'fullName': 'Javohir Aliyev', 'grade': '11-A', 'testsCompleted': 20, 'avgScore': 92, 'totalScore': 1840, 'avatarUrl': 'https://api.dicebear.com/7.x/initials/svg?seed=JA&backgroundColor=0369a1,075985', 'bio': _msg(lang, "Dasturlash va matematika bo'yicha birinchi o'rin", 'Первое место по программированию и математике')},
        {'id': 104, 'fullName': 'Zulayho Shokirova', 'grade': '8-A', 'testsCompleted': 18, 'avgScore': 91, 'totalScore': 1638, 'avatarUrl': 'https://api.dicebear.com/7.x/initials/svg?seed=ZS&backgroundColor=0284c7,0077b6', 'bio': _msg(lang, 'Ingliz tili IELTS 7.5 sohibasi', 'Обладательница сертификата IELTS 7.5')},
        {'id': 105, 'fullName': 'Sardorbek Rahmonov', 'grade': '10-B', 'testsCompleted': 16, 'avgScore': 89, 'totalScore': 1424, 'avatarUrl': 'https://api.dicebear.com/7.x/initials/svg?seed=SR&backgroundColor=0077b6,00b4d8', 'bio': _msg(lang, 'Fizika fanidan maktab sardori', 'Капитан школы по физике')}
    ]

    combined_students = students_list + [dc for dc in default_champions if not any(s['fullName'] == dc['fullName'] for s in students_list)]
    combined_students.sort(key=lambda x: (x['totalScore'], x['avgScore']), reverse=True)

    for idx, st in enumerate(combined_students[:10], 1):
        st['rank'] = idx
        st['badge'] = 'CHAMPION' if idx == 1 else ('MASTER' if idx == 2 else ('ELITE' if idx == 3 else 'TOP SCHOLAR'))

    # 2. Maktab Ustozlari (Admin tomonidan boshqariladigan TeacherShowcase modelidan!)
    teachers_qs = TeacherShowcase.objects.filter(is_visible_on_site=True).order_by('order', 'id')
    teachers_list = []
    for t in teachers_qs:
        teachers_list.append({
            'id': t.id,
            'name': t.name,
            'subject': t.subject,
            'title': t.title,
            'image': t.get_image_url(),
            'experience': t.experience,
            'quote': t.quote,
            'studentsCount': t.students_count,
            'avgScore': t.avg_score
        })

    # 3. Iqtidorli O'quvchilar Karuseli (Admin tomonidan boshqariladigan TalentedStudent modelidan!)
    talents_qs = TalentedStudent.objects.filter(is_active=True).order_by('order', 'id')
    talented_students = []
    for s in talents_qs:
        photo_url = s.get_image_url()
        talented_students.append({
            'id': s.id,
            'name': s.name,
            'grade': s.grade,
            'image': photo_url,
            'photo': photo_url,
            'achievement': s.achievement,
            'badge': s.badge,
            'quote': s.quote,
            'xpScore': s.xp_score
        })

    # 4. Fanlar ro'yxati (Bilingual: UZ & RU)
    subjects_data = [
        {'id': 'math', 'name': 'Matematika', 'name_uz': 'Matematika', 'name_ru': 'Математика', 'desc': 'Olimpiada darajasidagi mantiqiy misol va masalalar yechimi', 'desc_uz': 'Olimpiada darajasidagi mantiqiy misol va masalalar yechimi', 'desc_ru': 'Решение олимпиадных логических задач и уравнений', 'icon': '📐', 'xp': '+50 XP', 'tests': 45, 'students': '1,200+'},
        {'id': 'bio', 'name': 'Biologiya', 'name_uz': 'Biologiya', 'name_ru': 'Биология', 'desc': 'Hujayra biologiyasi, genetika, odam anatomiyasi va ekologiya', 'desc_uz': 'Hujayra biologiyasi, genetika, odam anatomiyasi va ekologiya', 'desc_ru': 'Клеточная биология, генетика, анатомия человека и экология', 'icon': '🧬', 'xp': '+50 XP', 'tests': 38, 'students': '950+'},
        {'id': 'cs', 'name': 'Dasturlash (IT)', 'name_uz': 'Dasturlash (IT)', 'name_ru': 'Программирование (IT)', 'desc': 'Python, algoritmlar, ma\'lumotlar tuzilmasi va veb dasturlash', 'desc_uz': 'Python, algoritmlar, ma\'lumotlar tuzilmasi va veb dasturlash', 'desc_ru': 'Python, алгоритмы, структуры данных и веб-разработка', 'icon': '💻', 'xp': '+60 XP', 'tests': 52, 'students': '1,400+'},
        {'id': 'phys', 'name': 'Fizika', 'name_uz': 'Fizika', 'name_ru': 'Физика', 'desc': 'Mexanika, termodinamika, optika va atom fizikasi sirlari', 'desc_uz': 'Mexanika, termodinamika, optika va atom fizikasi sirlari', 'desc_ru': 'Механика, термодинамика, оптика и основы атомной физики', 'icon': '⚡', 'xp': '+50 XP', 'tests': 32, 'students': '820+'},
        {'id': 'chem', 'name': 'Kimyo', 'name_uz': 'Kimyo', 'name_ru': 'Химия', 'desc': 'Anorganik va organik kimyo, reaksiyalar va laboratoriya tahlillari', 'desc_uz': 'Anorganik va organik kimyo, reaksiyalar va laboratoriya tahlillari', 'desc_ru': 'Неорганическая и органическая химия, реакции и анализ', 'icon': '⚗️', 'xp': '+50 XP', 'tests': 29, 'students': '760+'},
        {'id': 'eng', 'name': 'Ingliz tili', 'name_uz': 'Ingliz tili', 'name_ru': 'Английский язык', 'desc': 'IELTS, CEFR grammatika, reading va advanced leksika', 'desc_uz': 'IELTS, CEFR grammatika, reading va advanced leksika', 'desc_ru': 'IELTS, CEFR грамматика, чтение и продвинутая лексика', 'icon': '🌐', 'xp': '+40 XP', 'tests': 41, 'students': '1,150+'}
    ]

    # 5. Sayt Ma'lumotlari & Kontaktlar (SiteSetting)
    settings_obj = SiteSetting.get_settings()
    site_settings_data = {
        'schoolName': settings_obj.school_name,
        'phonePrimary': settings_obj.phone_primary,
        'phoneSecondary': settings_obj.phone_secondary,
        'email': settings_obj.email,
        'addressUz': settings_obj.address_uz,
        'addressRu': settings_obj.address_ru,
        'landmark': settings_obj.landmark,
        'workingHoursUz': settings_obj.working_hours_uz,
        'workingHoursRu': settings_obj.working_hours_ru,
        'telegramUrl': settings_obj.telegram_url,
        'instagramUrl': settings_obj.instagram_url,
        'youtubeUrl': settings_obj.youtube_url,
        'statStudents': settings_obj.stat_students,
        'statTests': settings_obj.stat_tests,
        'statCapacity': settings_obj.stat_capacity,
        'statBooks': settings_obj.stat_books,
        'statDevices': settings_obj.stat_devices,
    }

    total_std = max(CustomUser.objects.filter(role='student').count(), 1540)
    total_tst = max(Test.objects.count(), 128)

    return JsonResponse({
        'topStudents': combined_students[:8],
        'talentedStudents': talented_students,
        'teachers': teachers_list,
        'subjects': subjects_data,
        'siteSettings': site_settings_data,
        'stats': {
            'studentsCount': settings_obj.stat_students or f"{total_std:,}+",
            'testsCount': settings_obj.stat_tests or f"{total_tst}+",
            'teachersCount': f"{len(teachers_list)}+",
            'transparency': '100%',
            'rating': '4.9'
        }
    })


@csrf_exempt
def api_admin_save_teacher_showcase(request):
    """Admin tomonidan saytdagi ustozni qo'shish yoki tahrirlash"""
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)
    if request.method != 'POST':
        return JsonResponse({'error': _msg(lang, "POST so'rovi talab qilinadi", "Требуется POST-запрос")}, status=405)
    try:
        t_id = request.POST.get('id')
        name = request.POST.get('name', '').strip()
        subject = request.POST.get('subject', '').strip()
        title = request.POST.get('title', '').strip() or 'Diamond School Fan Ustozi'
        experience = request.POST.get('experience', '').strip() or '5+ yil tajriba'
        quote = request.POST.get('quote', '').strip()
        order = int(request.POST.get('order', 1))
        is_visible = str(request.POST.get('is_visible_on_site', 'true')).lower() in ['true', '1', 'on']

        if not name or not subject:
            return JsonResponse({'error': _msg(lang, 'Ustoz ismi va fani kiritilishi shart!', 'Необходимо указать имя учителя и предмет!')}, status=400)

        if t_id:
            teacher = TeacherShowcase.objects.get(id=t_id)
        else:
            teacher = TeacherShowcase()

        teacher.name = name
        teacher.subject = subject
        teacher.title = title
        teacher.experience = experience
        teacher.quote = quote
        teacher.order = order
        teacher.is_visible_on_site = is_visible

        if 'photo' in request.FILES:
            teacher.photo = request.FILES['photo']
        elif request.POST.get('photo_url'):
            teacher.photo_url = request.POST.get('photo_url').strip()

        teacher.save()
        return JsonResponse({'success': True, 'id': teacher.id})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_admin_save_talented_student(request):
    """Admin tomonidan karuseldagi iqtidorli o'quvchini qo'shish yoki tahrirlash"""
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)
    if request.method != 'POST':
        return JsonResponse({'error': _msg(lang, "POST so'rovi talab qilinadi", "Требуется POST-запрос")}, status=405)
    try:
        s_id = request.POST.get('id')
        name = request.POST.get('name', '').strip()
        grade = request.POST.get('grade', '').strip() or '9-A sinf'
        achievement = request.POST.get('achievement', '').strip()
        badge = request.POST.get('badge', '').strip() or _msg(lang, 'Oltin Medalist', 'Золотой медалист')
        quote = request.POST.get('quote', '').strip()
        xp_score = int(request.POST.get('xp_score', 1500))
        order = int(request.POST.get('order', 1))
        is_active = str(request.POST.get('is_active', 'true')).lower() in ['true', '1', 'on']

        if not name or not achievement:
            return JsonResponse({'error': _msg(lang, "O'quvchi ismi va yutug'i kiritilishi shart!", "Необходимо указать имя ученика и его достижение!")}, status=400)

        if s_id:
            student = TalentedStudent.objects.get(id=s_id)
        else:
            student = TalentedStudent()

        student.name = name
        student.grade = grade
        student.achievement = achievement
        student.badge = badge
        student.quote = quote
        student.xp_score = xp_score
        student.order = order
        student.is_active = is_active

        if 'photo' in request.FILES:
            student.photo = request.FILES['photo']
        elif request.POST.get('photo_url'):
            student.photo_url = request.POST.get('photo_url').strip()

        student.save()
        return JsonResponse({'success': True, 'id': student.id})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_admin_delete_showcase_item(request):
    """Ustoz yoki Iqtidorli o'quvchini o'chirish"""
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)
    if request.method != 'POST':
        return JsonResponse({'error': _msg(lang, 'Faqat POST ruxsat etilgan', 'Разрешён только POST-запрос')}, status=405)
    try:
        is_json = (request.content_type or '').startswith('application/json')
        data = json.loads(request.body.decode('utf-8')) if is_json and request.body else request.POST
        item_type = data.get('type')
        item_id = data.get('id')
        if item_type == 'teacher':
            TeacherShowcase.objects.filter(id=item_id).delete()
        elif item_type == 'student':
            TalentedStudent.objects.filter(id=item_id).delete()
        else:
            return JsonResponse({'error': _msg(lang, "Noto'g'ri element turi", "Неверный тип элемента")}, status=400)
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


# ================= 📬 CONTACT / BOG'LANISH APIS =================

@csrf_exempt
def api_contact_submit(request):
    """Bosh sahifadagi 'Biz bilan bog'lanish' arizasini qabul qilish"""
    lang = _req_lang(request)
    if request.method != 'POST':
        return JsonResponse({'error': _msg(lang, "Faqat POST so'rovi qabul qilinadi", "Принимаются только POST-запросы")}, status=405)

    try:
        is_json = (request.content_type or '').startswith('application/json')
        if is_json and request.body:
            data = json.loads(request.body.decode('utf-8'))
        else:
            data = request.POST

        full_name = data.get('name') or data.get('fullName') or data.get('full_name') or ''
        full_name = str(full_name).strip()
        phone = data.get('phone') or ''
        phone = str(phone).strip()
        grade_interest = (
            data.get('grade')
            or data.get('gradeInterest')
            or data.get('grade_interest')
            or _msg(lang, "Umumiy ma'lumot", "Общая информация")
        )
        grade_interest = str(grade_interest).strip()
        message = data.get('message') or ''
        message = str(message).strip()

        if not full_name:
            return JsonResponse({'error': _msg(lang, 'Iltimos, ism va familiyangizni kiriting!', 'Пожалуйста, введите имя и фамилию!')}, status=400)
        if not phone or len(phone) < 7:
            return JsonResponse({'error': _msg(lang, "Iltimos, to'g'ri telefon raqamingizni kiriting!", "Пожалуйста, введите корректный номер телефона!")}, status=400)

        msg = ContactMessage.objects.create(
            full_name=full_name,
            phone=phone,
            grade_interest=grade_interest,
            message=message
        )

        return JsonResponse({
            'success': True,
            'message': _msg(
                lang,
                "Murojaatingiz qabul qilindi! Tez orada mutaxassislarimiz siz bilan bog'lanishadi.",
                "Ваше обращение принято! Наши специалисты скоро свяжутся с вами.",
            ),
            'id': msg.id
        })
    except Exception as e:
        return JsonResponse({'error': _msg(lang, f"Xatolik yuz berdi: {str(e)}", f"Произошла ошибка: {str(e)}")}, status=400)


@csrf_exempt
def api_admin_contact_messages(request):
    """Admin panel: Kelib tushgan murojaatlarni ko'rish, holatini yangilash va o'chirish"""
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)
    if request.method == 'GET':
        messages_qs = ContactMessage.objects.all().order_by('-created_at')
        total_count = messages_qs.count()
        pending_count = messages_qs.filter(is_contacted=False).count()
        contacted_count = messages_qs.filter(is_contacted=True).count()

        items = []
        for m in messages_qs:
            items.append({
                'id': m.id,
                'fullName': m.full_name,
                'phone': m.phone,
                'gradeInterest': m.grade_interest,
                'message': m.message,
                'isContacted': m.is_contacted,
                'adminNotes': m.admin_notes,
                'createdAt': m.created_at.strftime('%Y-%m-%d %H:%M') if m.created_at else ''
            })

        return JsonResponse({
            'totalCount': total_count,
            'pendingCount': pending_count,
            'contactedCount': contacted_count,
            'messages': items
        })

    elif request.method in ('PUT', 'PATCH', 'DELETE'):
        try:
            data = {}
            if (request.content_type or '').startswith('application/json') and request.body:
                data = json.loads(request.body.decode('utf-8'))
            msg_id = request.GET.get('id') or data.get('id')
            if not msg_id:
                return JsonResponse({'error': _msg(lang, "Xabar IDsi ko'rsatilmadi", "Не указан ID сообщения")}, status=400)

            msg = ContactMessage.objects.get(id=msg_id)
            if request.method == 'DELETE':
                msg.delete()
                return JsonResponse({'success': True, 'deleted': True})

            val = True
            if 'is_contacted' in data or 'isContacted' in data:
                raw_val = data.get('is_contacted') if 'is_contacted' in data else data.get('isContacted')
                val = str(raw_val).lower() in ['true', '1', 'yes', 'on']
            msg.is_contacted = val
            msg.save()
            return JsonResponse({'success': True, 'isContacted': msg.is_contacted})
        except ContactMessage.DoesNotExist:
            return JsonResponse({'error': _msg(lang, 'Murojaat topilmadi', 'Обращение не найдено')}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    elif request.method in ('POST', 'PUT', 'PATCH'):
        try:
            if (request.content_type or '').startswith('application/json') and request.body:
                data = json.loads(request.body.decode('utf-8'))
            else:
                data = request.POST

            msg_id = data.get('id')
            action = data.get('action', 'toggle_contacted')

            if not msg_id:
                return JsonResponse({'error': _msg(lang, "Xabar IDsi ko'rsatilmadi", "Не указан ID сообщения")}, status=400)

            msg = ContactMessage.objects.get(id=msg_id)

            if action == 'toggle_contacted':
                msg.is_contacted = not msg.is_contacted
                msg.save()
                return JsonResponse({'success': True, 'isContacted': msg.is_contacted})
            elif action == 'set_contacted':
                val = str(data.get('is_contacted', 'true')).lower() in ['true', '1']
                msg.is_contacted = val
                msg.save()
                return JsonResponse({'success': True, 'isContacted': msg.is_contacted})
            elif action == 'save_notes':
                msg.admin_notes = data.get('notes', '').strip()
                msg.save()
                return JsonResponse({'success': True})
            elif action == 'delete':
                msg.delete()
                return JsonResponse({'success': True, 'deleted': True})
            else:
                return JsonResponse({'error': _msg(lang, "Noma'lum amal", "Неизвестное действие")}, status=400)
        except ContactMessage.DoesNotExist:
            return JsonResponse({'error': _msg(lang, 'Murojaat topilmadi', 'Обращение не найдено')}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': _msg(lang, "Noto'g'ri metod", "Неподдерживаемый метод")}, status=405)


@csrf_exempt
def api_admin_site_settings(request):
    """Admin panel: Maktab ma'lumotlarini (kontaktlar, manzil, tarmoqlar, stats) olish va yangilash"""
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)
    settings_obj = SiteSetting.get_settings()

    if request.method == 'GET':
        return JsonResponse({
            'schoolName': settings_obj.school_name,
            'phonePrimary': settings_obj.phone_primary,
            'phoneSecondary': settings_obj.phone_secondary,
            'email': settings_obj.email,
            'addressUz': settings_obj.address_uz,
            'addressRu': settings_obj.address_ru,
            'landmark': settings_obj.landmark,
            'workingHoursUz': settings_obj.working_hours_uz,
            'workingHoursRu': settings_obj.working_hours_ru,
            'telegramUrl': settings_obj.telegram_url,
            'instagramUrl': settings_obj.instagram_url,
            'youtubeUrl': settings_obj.youtube_url,
            'statStudents': settings_obj.stat_students,
            'statTests': settings_obj.stat_tests,
            'statCapacity': settings_obj.stat_capacity,
            'statBooks': settings_obj.stat_books,
            'statDevices': settings_obj.stat_devices,
        })

    elif request.method in ('POST', 'PUT', 'PATCH'):
        try:
            if (request.content_type or '').startswith('application/json') and request.body:
                data = json.loads(request.body.decode('utf-8'))
            else:
                data = request.POST

            if 'school_name' in data or 'schoolName' in data:
                settings_obj.school_name = (data.get('school_name') or data.get('schoolName') or settings_obj.school_name).strip()
            if 'phone_primary' in data or 'phonePrimary' in data:
                settings_obj.phone_primary = (data.get('phone_primary') or data.get('phonePrimary') or settings_obj.phone_primary).strip()
            if 'phone_secondary' in data or 'phoneSecondary' in data:
                settings_obj.phone_secondary = (data.get('phone_secondary') or data.get('phoneSecondary') or settings_obj.phone_secondary).strip()
            if 'email' in data:
                settings_obj.email = (data.get('email') or settings_obj.email).strip()
            if 'address_uz' in data or 'addressUz' in data:
                settings_obj.address_uz = (data.get('address_uz') or data.get('addressUz') or settings_obj.address_uz).strip()
            if 'address_ru' in data or 'addressRu' in data:
                settings_obj.address_ru = (data.get('address_ru') or data.get('addressRu') or settings_obj.address_ru).strip()
            if 'landmark' in data:
                settings_obj.landmark = (data.get('landmark') or settings_obj.landmark).strip()
            if 'working_hours_uz' in data or 'workingHoursUz' in data:
                settings_obj.working_hours_uz = (data.get('working_hours_uz') or data.get('workingHoursUz') or settings_obj.working_hours_uz).strip()
            if 'working_hours_ru' in data or 'workingHoursRu' in data:
                settings_obj.working_hours_ru = (data.get('working_hours_ru') or data.get('workingHoursRu') or settings_obj.working_hours_ru).strip()
            if 'telegram_url' in data or 'telegramUrl' in data:
                settings_obj.telegram_url = (data.get('telegram_url') or data.get('telegramUrl') or settings_obj.telegram_url).strip()
            if 'instagram_url' in data or 'instagramUrl' in data:
                settings_obj.instagram_url = (data.get('instagram_url') or data.get('instagramUrl') or settings_obj.instagram_url).strip()
            if 'youtube_url' in data or 'youtubeUrl' in data:
                settings_obj.youtube_url = (data.get('youtube_url') or data.get('youtubeUrl') or settings_obj.youtube_url).strip()
            if 'stat_students' in data or 'statStudents' in data:
                settings_obj.stat_students = (data.get('stat_students') or data.get('statStudents') or settings_obj.stat_students).strip()
            if 'stat_tests' in data or 'statTests' in data:
                settings_obj.stat_tests = (data.get('stat_tests') or data.get('statTests') or settings_obj.stat_tests).strip()
            if 'stat_capacity' in data or 'statCapacity' in data:
                settings_obj.stat_capacity = (data.get('stat_capacity') or data.get('statCapacity') or settings_obj.stat_capacity).strip()
            if 'stat_books' in data or 'statBooks' in data:
                settings_obj.stat_books = (data.get('stat_books') or data.get('statBooks') or settings_obj.stat_books).strip()
            if 'stat_devices' in data or 'statDevices' in data:
                settings_obj.stat_devices = (data.get('stat_devices') or data.get('statDevices') or settings_obj.stat_devices).strip()

            settings_obj.save()
            return JsonResponse({
                'success': True,
                'message': _msg(lang, "Sayt sozlamalari va ma'lumotlari muvaffaqiyatli saqlandi!", "Настройки и данные сайта успешно сохранены!")
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': _msg(lang, "Noto'g'ri metod", "Неподдерживаемый метод")}, status=405)


# ================= 🏫 SCHOOL CLASSES APIS (BILINGUAL UZ/RU) =================

@csrf_exempt
def api_admin_classes(request):
    """Admin panel: Barcha sinflar ro'yxati, tillar (UZ/RU) bo'yicha tahlili va yangi sinf qo'shish"""
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)
    if request.method == 'GET':
        classes_qs = SchoolClass.objects.select_related('tutor').filter(is_active=True).order_by('grade_level', 'language', 'name')

        classes_data = []
        uz_classes = []
        ru_classes = []
        overall_dist = {'excellent': 0, 'good': 0, 'fair': 0, 'poor': 0}
        uz_dist = {'excellent': 0, 'good': 0, 'fair': 0, 'poor': 0}
        ru_dist = {'excellent': 0, 'good': 0, 'fair': 0, 'poor': 0}
        parallel_map = {}

        for c in classes_qs:
            std_qs = CustomUser.objects.filter(role='student', grade=c.name)
            std_count = std_qs.count()
            std_coins = sum(int(s.coins or 0) for s in std_qs)
            class_bonus_coins = int(c.bonus_coins or 0)
            total_cls_coins = std_coins + class_bonus_coins
            avg_coins = round(std_coins / std_count) if std_count > 0 else 0
            res_qs = TestResult.objects.filter(student__grade=c.name)
            subs_count = res_qs.count()
            active_std_count = std_qs.filter(results__isnull=False).distinct().count()
            avg_score = round(res_qs.aggregate(avg=Avg('score_percentage'))['avg'] or 0) if subs_count > 0 else 0

            cls_dist = {
                'excellent': res_qs.filter(score_percentage__gte=85).count(),
                'good': res_qs.filter(score_percentage__gte=70, score_percentage__lt=85).count(),
                'fair': res_qs.filter(score_percentage__gte=50, score_percentage__lt=70).count(),
                'poor': res_qs.filter(score_percentage__lt=50).count(),
            }
            passed_cnt = res_qs.filter(score_percentage__gte=60).count()
            pass_rate = round((passed_cnt / subs_count) * 100) if subs_count > 0 else 0

            for k in ('excellent', 'good', 'fair', 'poor'):
                overall_dist[k] += cls_dist[k]
                if c.language == 'uz':
                    uz_dist[k] += cls_dist[k]
                else:
                    ru_dist[k] += cls_dist[k]

            gl = int(c.grade_level or 9)
            if gl not in parallel_map:
                parallel_map[gl] = {
                    'gradeLevel': gl,
                    'label': _msg(lang, f"{gl}-sinf", f"{gl}-класс"),
                    'classesCount': 0,
                    'studentsCount': 0,
                    'activeStudentsCount': 0,
                    'studentCoins': 0,
                    'classBonusCoins': 0,
                    'totalCoins': 0,
                    'submissionsCount': 0,
                    '_score_sum': 0,
                }
            pm = parallel_map[gl]
            pm['classesCount'] += 1
            pm['studentsCount'] += std_count
            pm['activeStudentsCount'] += active_std_count
            pm['studentCoins'] += std_coins
            pm['classBonusCoins'] += class_bonus_coins
            pm['totalCoins'] += total_cls_coins
            pm['submissionsCount'] += subs_count
            if subs_count > 0:
                pm['_score_sum'] += sum(res_qs.values_list('score_percentage', flat=True))

            tutor_obj = c.tutor if (c.tutor and c.tutor.role == 'tutor') else None
            item = {
                'id': c.id,
                'name': c.name,
                'gradeLevel': c.grade_level,
                'language': c.language,
                'languageLabel': (
                    _msg(lang, "O'zbek tili", "Узбекский язык")
                    if c.language == 'uz'
                    else _msg(lang, "Rus tili (Русский)", "Русский язык")
                ),
                'room': c.room or '-',
                'headTeacher': (c.head_teacher or (tutor_obj.full_name if tutor_obj else '')) or _msg(lang, 'Belgilanmagan', 'Не указан'),
                'tutorId': tutor_obj.id if tutor_obj else None,
                'tutorName': tutor_obj.full_name if tutor_obj else '',
                'tutorUsername': tutor_obj.username if tutor_obj else '',
                'tutorCoins': int(tutor_obj.coins or 0) if tutor_obj else 0,
                'description': c.description,
                'studentsCount': std_count,
                'activeStudentsCount': active_std_count,
                'isActiveClass': bool(subs_count > 0 or total_cls_coins > 0 or active_std_count > 0),
                'studentCoins': std_coins,
                'classBonusCoins': class_bonus_coins,
                'bonusCoins': class_bonus_coins,
                'totalCoins': total_cls_coins,
                'avgCoins': avg_coins,
                'submissionsCount': subs_count,
                'avgScore': avg_score,
                'passRate': pass_rate,
                'distribution': cls_dist,
                'rating': (
                    _msg(lang, "Yetakchi sinf", "Лидер")
                    if avg_score >= 85
                    else (
                        _msg(lang, "Yaxshi", "Хорошо")
                        if avg_score >= 70
                        else (
                            _msg(lang, "Natija yo'q", "Нет оценок")
                            if subs_count == 0
                            else _msg(lang, "Rivojlanmoqda", "Развивается")
                        )
                    )
                ),
            }
            classes_data.append(item)
            if c.language == 'uz':
                uz_classes.append(item)
            else:
                ru_classes.append(item)

        # Rank classes by total coins
        classes_data_sorted = sorted(classes_data, key=lambda x: (x['totalCoins'], x['studentsCount']), reverse=True)
        for idx, item in enumerate(classes_data_sorted):
            item['coinRank'] = idx + 1

        parallel_stats = []
        for gl in sorted(parallel_map.keys()):
            pm = parallel_map[gl]
            sc_sum = pm.pop('_score_sum', 0)
            pm['avgScore'] = round(sc_sum / pm['submissionsCount']) if pm['submissionsCount'] > 0 else 0
            parallel_stats.append(pm)

        uz_with_subs = [c for c in uz_classes if c['submissionsCount'] > 0]
        ru_with_subs = [c for c in ru_classes if c['submissionsCount'] > 0]
        uz_avg = round(sum(c['avgScore'] for c in uz_with_subs) / len(uz_with_subs)) if uz_with_subs else 0
        ru_avg = round(sum(c['avgScore'] for c in ru_with_subs) / len(ru_with_subs)) if ru_with_subs else 0
        uz_stds = sum(c['studentsCount'] for c in uz_classes)
        ru_stds = sum(c['studentsCount'] for c in ru_classes)
        uz_active_stds = sum(c['activeStudentsCount'] for c in uz_classes)
        ru_active_stds = sum(c['activeStudentsCount'] for c in ru_classes)
        uz_coins = sum(c['totalCoins'] for c in uz_classes)
        ru_coins = sum(c['totalCoins'] for c in ru_classes)
        total_coins = uz_coins + ru_coins
        class_bonus_total = sum(c['classBonusCoins'] for c in classes_data)
        total_subs = sum(c['submissionsCount'] for c in classes_data)
        all_subs_qs = TestResult.objects.filter(student__grade__in=[c['name'] for c in classes_data])
        overall_avg = round(all_subs_qs.aggregate(avg=Avg('score_percentage'))['avg'] or 0) if total_subs > 0 else 0

        return JsonResponse({
            'classes': classes_data,
            'summary': {
                'total': len(classes_data),
                'totalClasses': len(classes_data),
                'activeClassesCount': sum(1 for c in classes_data if c['isActiveClass']),
                'totalStudents': uz_stds + ru_stds,
                'totalActiveStudents': uz_active_stds + ru_active_stds,
                'totalSubmissions': total_subs,
                'overallAvgScore': overall_avg,
                'uzbekCount': len(uz_classes),
                'uzCount': len(uz_classes),
                'russianCount': len(ru_classes),
                'ruCount': len(ru_classes),
                'uzbekAvg': uz_avg,
                'uzAvgScore': uz_avg,
                'russianAvg': ru_avg,
                'ruAvgScore': ru_avg,
                'uzStudentsCount': uz_stds,
                'ruStudentsCount': ru_stds,
                'uzActiveStudentsCount': uz_active_stds,
                'ruActiveStudentsCount': ru_active_stds,
                'totalCoins': total_coins,
                'classBonusCoinsTotal': class_bonus_total,
                'uzCoins': uz_coins,
                'ruCoins': ru_coins,
                'scoreDistribution': overall_dist,
                'uzScoreDistribution': uz_dist,
                'ruScoreDistribution': ru_dist,
                'parallelStats': parallel_stats,
                'topClass': classes_data_sorted[0]['name'] if classes_data_sorted else '-',
                'topClassCoins': classes_data_sorted[0]['totalCoins'] if classes_data_sorted else 0
            }
        })

    elif request.method in ('POST', 'PUT', 'PATCH'):
        try:
            if (request.content_type or '').startswith('application/json') and request.body:
                data = json.loads(request.body.decode('utf-8'))
            else:
                data = request.POST

            name = (data.get('name') or '').strip().upper()
            if not name:
                return JsonResponse({'error': _msg(lang, 'Sinf nomi kiritilishi shart (masalan: 9-A, 10-B yoki 9-RU)!', 'Необходимо указать название класса (например: 9-A, 10-B или 9-RU)!')}, status=400)

            # Auto-detect grade level from name digits if not explicitly provided or default
            raw_grade = data.get('grade_level') or data.get('gradeLevel')
            if raw_grade:
                try:
                    grade_level = int(raw_grade)
                except (ValueError, TypeError):
                    grade_level = 9
            else:
                digits = ''.join(filter(str.isdigit, name))
                grade_level = int(digits) if digits else 9

            # Auto-detect language or use provided
            language = (data.get('language') or '').strip().lower()
            if not language:
                language = 'ru' if ('RU' in name or 'РУ' in name) else 'uz'
            elif language not in ['uz', 'ru']:
                language = 'ru' if 'ru' in language else 'uz'

            room = (data.get('room') or '').strip()
            head_teacher = (data.get('head_teacher') or data.get('headTeacher') or '').strip()
            description = (data.get('description') or '').strip()
            raw_tutor_id = data.get('tutorId') if 'tutorId' in data else data.get('tutor_id')
            tutor_obj = None
            if raw_tutor_id not in (None, '', 'none', 'null'):
                tutor_obj = CustomUser.objects.filter(id=raw_tutor_id, role='tutor').first()
                if not tutor_obj:
                    return JsonResponse({'error': _msg(lang, 'Tanlangan tyuter topilmadi!', 'Выбранный тьютор не найден!')}, status=404)
                if not head_teacher:
                    head_teacher = tutor_obj.full_name

            # Uniqueness check
            existing = SchoolClass.objects.filter(name__iexact=name).first()
            if existing:
                if not existing.is_active:
                    existing.is_active = True
                    existing.grade_level = grade_level
                    existing.language = language
                    existing.room = room
                    existing.head_teacher = head_teacher
                    existing.tutor = tutor_obj
                    existing.description = description
                    existing.save()
                    return JsonResponse({'success': True, 'message': _msg(lang, f"'{name}' sinfi qayta faollashtirildi!", f"Класс '{name}' снова активирован!")})
                return JsonResponse({'error': _msg(lang, f"'{name}' nomli sinf allaqachon mavjud!", f"Класс '{name}' уже существует!")}, status=400)

            sc = SchoolClass.objects.create(
                name=name,
                grade_level=grade_level,
                language=language,
                room=room,
                head_teacher=head_teacher,
                tutor=tutor_obj,
                description=description,
                is_active=True
            )
            return JsonResponse({'success': True, 'message': _msg(lang, f"'{sc.name}' sinfi muvaffaqiyatli qo'shildi!", f"Класс '{sc.name}' успешно добавлен!"), 'id': sc.id})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': _msg(lang, "Noto'g'ri metod", "Неподдерживаемый метод")}, status=405)


@csrf_exempt
def api_admin_class_manage(request, class_id):
    """Admin panel: Sinfni tahrirlash yoki o'chirish"""
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)
    try:
        sc = SchoolClass.objects.get(id=class_id)
    except SchoolClass.DoesNotExist:
        return JsonResponse({'error': _msg(lang, 'Sinf topilmadi', 'Класс не найден')}, status=404)

    if request.method == 'DELETE':
        class_name = sc.name
        sc.delete()
        return JsonResponse({'success': True, 'message': _msg(lang, f"'{class_name}' sinfi tizimdan o'chirildi!", f"Класс '{class_name}' удалён из системы!")})

    elif request.method in ('POST', 'PUT', 'PATCH'):
        try:
            if (request.content_type or '').startswith('application/json') and request.body:
                data = json.loads(request.body.decode('utf-8'))
            else:
                data = request.POST

            if 'name' in data:
                sc.name = data['name'].strip().upper()
            if 'grade_level' in data or 'gradeLevel' in data:
                sc.grade_level = int(data.get('grade_level') or data.get('gradeLevel'))
            if 'language' in data:
                sc.language = data['language'].strip().lower()
            if 'room' in data:
                sc.room = data['room'].strip()
            if 'head_teacher' in data or 'headTeacher' in data:
                sc.head_teacher = (data.get('head_teacher') or data.get('headTeacher') or '').strip()
            if 'tutorId' in data or 'tutor_id' in data:
                raw_tid = data.get('tutorId') if 'tutorId' in data else data.get('tutor_id')
                prev_tutor_name = sc.tutor.full_name if sc.tutor else ''
                if raw_tid in (None, '', 'none', 'null'):
                    sc.tutor = None
                    if prev_tutor_name and (sc.head_teacher or '').strip() == prev_tutor_name.strip():
                        sc.head_teacher = ''
                else:
                    new_tutor = CustomUser.objects.filter(id=raw_tid, role='tutor').first()
                    if not new_tutor:
                        return JsonResponse({'error': _msg(lang, 'Tanlangan tyuter topilmadi!', 'Выбранный тьютор не найден!')}, status=404)
                    sc.tutor = new_tutor
                    if not (sc.head_teacher or '').strip() or (prev_tutor_name and sc.head_teacher.strip() == prev_tutor_name.strip()):
                        sc.head_teacher = new_tutor.full_name
            if 'description' in data:
                sc.description = data['description'].strip()

            sc.save()
            return JsonResponse({'success': True, 'message': _msg(lang, f"'{sc.name}' sinfi ma'lumotlari yangilandi!", f"Данные класса '{sc.name}' обновлены!")})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': _msg(lang, "Noto'g'ri metod", "Неподдерживаемый метод")}, status=405)


# ================= 🪙 DIAMOND COINS & REWARD APIS =================

@csrf_exempt
def api_award_coins(request):
    """Admin yoki O'qituvchi tomonidan o'quvchiga coin berish / rag'batlantirish"""
    lang = _req_lang(request)
    if request.method != 'POST':
        return JsonResponse({'error': _msg(lang, "Faqat POST so'rovi qabul qilinadi", "Принимаются только POST-запросы")}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({'error': _msg(lang, 'Tizimga kirish talab etiladi!', 'Требуется вход в систему!')}, status=401)

    perm_err = check_teacher_permission(request)
    if perm_err:
        return perm_err

    try:
        data = json.loads(request.body.decode('utf-8'))
        student_id = data.get('studentId') or data.get('student_id')
        student_ids_raw = data.get('studentIds') or data.get('student_ids') or []
        class_name = (data.get('className') or data.get('class_name') or '').strip()
        award_scope = (data.get('awardScope') or data.get('scope') or data.get('target') or '').strip().lower()
        amount = int(data.get('amount', 0) or 0)
        raw_class_amount = data.get('classAmount') if 'classAmount' in data else data.get('class_amount')
        class_amount = int(raw_class_amount) if raw_class_amount not in (None, '') else amount
        raw_reason = (data.get('reason') or '').strip()
        if raw_reason:
            reason = raw_reason
        elif amount < 0:
            reason = _msg(lang, "Dars intizomini buzgani uchun", "За нарушение дисциплины на уроке")
        else:
            reason = _msg(lang, "Darsdagi namunali faollik uchun", "За образцовую активность на уроке")
        result_id = data.get('resultId') or data.get('result_id')
        test_id_param = data.get('testId') or data.get('test_id')
        activity_type = (data.get('activityType') or data.get('activity_type') or 'lesson_activity').strip()

        giver = request.user
        is_admin = is_admin_user(giver)
        portal = (data.get('portal') or '').strip().lower()
        enforce_teacher_rules = (not is_admin) or (portal == 'teacher')
        is_admin_preview = is_admin and (portal == 'teacher')
        tx_portal = 'teacher' if enforce_teacher_rules else 'admin'

        # O'qituvchi (yoki Teacher portali) FAQAT darsdagi faollik/intizom uchun HAR BIR sinfga kuniga max +5 coin berishi va yakka o'quvchidan -1..-5 coin olishi mumkin
        if enforce_teacher_rules:
            if (isinstance(student_ids_raw, list) and len(student_ids_raw) > 0) or award_scope in (
                'class_only', 'class', 'both', 'class_and_students', 'class_and_active', 'active_students'
            ):
                return JsonResponse({
                    'error': _msg(
                        lang,
                        "Cheklov: O'qituvchi faqat darsdagi faollik uchun bitta o'quvchi yoki o'z sinfiga coin berishi mumkin!",
                        "Ограничение: учитель может начислять койны за активность на уроке только одному ученику или своему классу!",
                    )
                }, status=403)
            if result_id or test_id_param or activity_type != 'lesson_activity':
                return JsonResponse({
                    'error': _msg(
                        lang,
                        "Cheklov: O'qituvchi faqat darsdagi faollik uchun coin berishi mumkin! Boshqa holatlarda coin berish taqiqlangan.",
                        "Ограничение: учитель может начислять койны только за активность на уроке! Начисление по другим причинам запрещено.",
                    )
                }, status=403)
            reason_err = validate_teacher_lesson_activity_reason(reason, lang=lang)
            if reason_err:
                return JsonResponse({'error': reason_err}, status=403)

            if amount == 0:
                return JsonResponse({'error': _msg(lang, "Coin miqdori 0 bo'lishi mumkin emas!", "Количество койнов не может быть 0!")}, status=400)
            if amount > DAILY_TEACHER_MAX_COINS:
                return JsonResponse({
                    'error': _msg(
                        lang,
                        f"Kunlik limit: Har bir sinf uchun kuniga ko'pi bilan {DAILY_TEACHER_MAX_COINS} Coin berish mumkin!",
                        f"Дневной лимит: максимум {DAILY_TEACHER_MAX_COINS} Coin в день для каждого класса!",
                    )
                }, status=403)
            if amount < -DAILY_TEACHER_MAX_COINS:
                return JsonResponse({
                    'error': _msg(
                        lang,
                        f"Bir urinishda ko'pi bilan {DAILY_TEACHER_MAX_COINS} Coin olish mumkin!",
                        f"За один раз можно снять не более {DAILY_TEACHER_MAX_COINS} койнов!",
                    )
                }, status=403)

            if amount < 0 and class_name and not student_id:
                return JsonResponse({
                    'error': _msg(
                        lang,
                        "O'qituvchi butun sinfdan birvarakayiga coin ola olmaydi, aniq o'quvchini tanlang!",
                        "Учитель не может снимать койны сразу со всего класса, выберите конкретного ученика!",
                    )
                }, status=403)

            # Maqsadli sinfni aniqlash
            target_class = ''
            if class_name and not student_id:
                target_class = class_name
            elif student_id:
                st_check = CustomUser.objects.filter(id=student_id, role='student').first()
                if not st_check:
                    return JsonResponse({'error': _msg(lang, "O'quvchi topilmadi!", "Ученик не найден!")}, status=404)
                target_class = (st_check.grade or '').strip()

            if not target_class:
                return JsonResponse({'error': _msg(lang, "Sinf tanlanishi shart!", "Необходимо выбрать класс!")}, status=400)

            if amount > 0:
                daily_status = get_teacher_daily_coin_status(giver, enforce_for_portal=True, grade=target_class)
                if not daily_status['canAwardToday'] or daily_status['coinsRemainingToday'] <= 0:
                    return JsonResponse({
                        'error': _msg(
                            lang,
                            f"Kunlik limit tugadi! Bugun '{target_class}' sinfi uchun kunlik {DAILY_TEACHER_MAX_COINS} coin limiti to'liq berib bo'lindi. Boshqa sinflarga berishingiz mumkin, '{target_class}' sinfi uchun yangi limit ertaga ochiladi.",
                            f"Дневной лимит исчерпан! На сегодня лимит в {DAILY_TEACHER_MAX_COINS} койнов для класса '{target_class}' полностью использован. Вы можете начислять другим классам, а новый лимит для '{target_class}' откроется завтра.",
                        ),
                        'dailyCoinStatus': daily_status
                    }, status=403)

                if amount > daily_status['coinsRemainingToday']:
                    return JsonResponse({
                        'error': _msg(
                            lang,
                            f"Kunlik limitdan oshib ketdi! Bugun '{target_class}' sinfi uchun yana ko'pi bilan {daily_status['coinsRemainingToday']} coin berishingiz mumkin.",
                            f"Превышен дневной лимит! На сегодня для класса '{target_class}' можно начислить не более {daily_status['coinsRemainingToday']} койнов.",
                        ),
                        'dailyCoinStatus': daily_status
                    }, status=403)

        # 0. Admin: Tanlangan bir nechta (faol) o'quvchilarga birgalikda coin berish
        if not enforce_teacher_rules and isinstance(student_ids_raw, list) and len(student_ids_raw) > 0:
            clean_ids = []
            for sid in student_ids_raw:
                try:
                    iv = int(sid)
                    if iv not in clean_ids:
                        clean_ids.append(iv)
                except (ValueError, TypeError):
                    continue
            if not clean_ids:
                return JsonResponse({'error': _msg(lang, "Kamida bitta o'quvchi tanlanishi shart!", "Необходимо выбрать хотя бы одного ученика!")}, status=400)
            if amount == 0:
                return JsonResponse({'error': _msg(lang, "Coin miqdori 0 bo'lishi mumkin emas!", "Количество койнов не может быть 0!")}, status=400)

            awarded_students = []
            with transaction.atomic():
                st_map = {
                    s.id: s
                    for s in CustomUser.objects.select_for_update().filter(id__in=clean_ids, role='student')
                }
                target_students = [st_map[sid] for sid in clean_ids if sid in st_map]
                if not target_students:
                    return JsonResponse({'error': _msg(lang, "Tanlangan o'quvchilar topilmadi!", "Выбранные ученики не найдены!")}, status=404)

                for st in target_students:
                    st.coins = max(0, int(st.coins or 0) + amount)
                    st.save(update_fields=['coins'])
                    CoinTransaction.objects.create(
                        student=st,
                        given_by=giver,
                        amount=amount,
                        reason=reason,
                        portal=tx_portal,
                    )
                    awarded_students.append({
                        'id': st.id,
                        'fullName': st.full_name,
                        'grade': st.grade or '-',
                        'coins': st.coins,
                    })

            return JsonResponse({
                'success': True,
                'isBatch': True,
                'count': len(awarded_students),
                'amountAwarded': amount,
                'totalGiven': len(awarded_students) * amount,
                'awardedStudents': awarded_students,
                'message': _msg(
                    lang,
                    f"{len(awarded_students)} nafar o'quvchiga {amount:+d} Diamond Coin muvaffaqiyatli berildi!",
                    f"{len(awarded_students)} ученикам успешно начислено {amount:+d} Diamond Coin!",
                ),
            })

        # 1. Sinf bo'yicha (sinfning o'ziga va/yoki o'quvchilariga) taqdirlash
        if class_name and not student_id:
            sc = SchoolClass.objects.filter(name__iexact=class_name).first()
            resolved_class_name = sc.name if sc else class_name

            if not enforce_teacher_rules and award_scope in ('class_only', 'class'):
                if not sc:
                    return JsonResponse({'error': _msg(lang, f"'{class_name}' sinfi topilmadi!", f"Класс '{class_name}' не найден!")}, status=404)
                if class_amount == 0:
                    return JsonResponse({'error': _msg(lang, "Coin miqdori 0 bo'lishi mumkin emas!", "Количество койнов не может быть 0!")}, status=400)

                credited_tutor = None
                with transaction.atomic():
                    sc_locked = SchoolClass.objects.select_for_update().select_related('tutor').get(id=sc.id)
                    sc_locked.bonus_coins = max(0, int(sc_locked.bonus_coins or 0) + class_amount)
                    sc_locked.save(update_fields=['bonus_coins'])
                    if sc_locked.tutor_id and sc_locked.tutor and sc_locked.tutor.role == 'tutor':
                        credited_tutor = CustomUser.objects.select_for_update().get(id=sc_locked.tutor_id)
                        credited_tutor.coins = max(0, int(credited_tutor.coins or 0) + class_amount)
                        credited_tutor.save(update_fields=['coins'])
                    ClassCoinTransaction.objects.create(
                        school_class=sc_locked,
                        tutor=credited_tutor,
                        given_by=giver,
                        amount=class_amount,
                        reason=f"{reason} {_msg(lang, '(Faol sinf fondi)', '(Фонд активного класса)')}",
                    )

                msg_uz = (
                    f"'{sc_locked.name}' sinf fondiga {class_amount:+d} Diamond Coin qo'shildi va tyuter {credited_tutor.full_name} hisobiga yozildi! (Tyuter balansi: {credited_tutor.coins} 💎)"
                    if credited_tutor
                    else f"'{sc_locked.name}' faol sinf fondiga {class_amount:+d} Diamond Coin qo'shildi! (Sinf fondi: {sc_locked.bonus_coins} 💎)"
                )
                msg_ru = (
                    f"В фонд класса '{sc_locked.name}' добавлено {class_amount:+d} Diamond Coin и зачислено на счёт тьютора {credited_tutor.full_name}! (Баланс тьютора: {credited_tutor.coins} 💎)"
                    if credited_tutor
                    else f"В фонд активного класса '{sc_locked.name}' добавлено {class_amount:+d} Diamond Coin! (Фонд класса: {sc_locked.bonus_coins} 💎)"
                )

                return JsonResponse({
                    'success': True,
                    'isClassAward': True,
                    'awardScope': 'class_only',
                    'className': sc_locked.name,
                    'classBonusCoins': sc_locked.bonus_coins,
                    'tutorId': credited_tutor.id if credited_tutor else None,
                    'tutorName': credited_tutor.full_name if credited_tutor else '',
                    'tutorCoins': int(credited_tutor.coins or 0) if credited_tutor else 0,
                    'amountAwarded': class_amount,
                    'count': 0,
                    'totalGiven': class_amount,
                    'message': _msg(lang, msg_uz, msg_ru),
                })

            if not enforce_teacher_rules and award_scope in ('both', 'class_and_students', 'class_and_active'):
                if not sc:
                    return JsonResponse({'error': _msg(lang, f"'{class_name}' sinfi topilmadi!", f"Класс '{class_name}' не найден!")}, status=404)
                if amount == 0 and class_amount == 0:
                    return JsonResponse({'error': _msg(lang, "Coin miqdori 0 bo'lishi mumkin emas!", "Количество койнов не может быть 0!")}, status=400)

                std_qs = CustomUser.objects.filter(role='student', grade=resolved_class_name)
                if award_scope == 'class_and_active':
                    std_qs = std_qs.filter(results__isnull=False).distinct()
                std_ids = list(std_qs.values_list('id', flat=True))

                awarded_count = 0
                credited_tutor = None
                with transaction.atomic():
                    sc_locked = SchoolClass.objects.select_for_update().select_related('tutor').get(id=sc.id)
                    if class_amount != 0:
                        sc_locked.bonus_coins = max(0, int(sc_locked.bonus_coins or 0) + class_amount)
                        sc_locked.save(update_fields=['bonus_coins'])
                        if sc_locked.tutor_id and sc_locked.tutor and sc_locked.tutor.role == 'tutor':
                            credited_tutor = CustomUser.objects.select_for_update().get(id=sc_locked.tutor_id)
                            credited_tutor.coins = max(0, int(credited_tutor.coins or 0) + class_amount)
                            credited_tutor.save(update_fields=['coins'])
                        ClassCoinTransaction.objects.create(
                            school_class=sc_locked,
                            tutor=credited_tutor,
                            given_by=giver,
                            amount=class_amount,
                            reason=f"{reason} {_msg(lang, '(Faol sinf fondi)', '(Фонд активного класса)')}",
                        )
                    stds = list(CustomUser.objects.select_for_update().filter(id__in=std_ids))
                    if amount != 0:
                        for st in stds:
                            st.coins = max(0, int(st.coins or 0) + amount)
                            st.save(update_fields=['coins'])
                            CoinTransaction.objects.create(
                                student=st,
                                given_by=giver,
                                amount=amount,
                                reason=f"{reason} {_msg(lang, '(Sinf jamoasi uchun)', '(Для команды класса)')}",
                                portal=tx_portal,
                            )
                            awarded_count += 1

                tutor_note_uz = f" (Tyuter {credited_tutor.full_name} hisobiga ham {class_amount:+d} coin yozildi)" if credited_tutor else ""
                tutor_note_ru = f" (Тьютору {credited_tutor.full_name} также начислено {class_amount:+d} койн.)" if credited_tutor else ""
                if awarded_count > 0:
                    msg = _msg(
                        lang,
                        f"'{sc_locked.name}' sinf fondiga {class_amount:+d}{tutor_note_uz} va {awarded_count} nafar {'faol ' if award_scope == 'class_and_active' else ''}o'quvchiga {amount:+d} Diamond Coin berildi!",
                        f"В фонд класса '{sc_locked.name}' начислено {class_amount:+d}{tutor_note_ru}, а {awarded_count} {'активным ' if award_scope == 'class_and_active' else ''}ученикам по {amount:+d} Diamond Coin!",
                    )
                else:
                    msg = _msg(
                        lang,
                        f"'{sc_locked.name}' sinf fondiga {class_amount:+d} Diamond Coin qo'shildi{tutor_note_uz}! (Sinfda mos o'quvchilar hozircha 0 nafar)",
                        f"В фонд класса '{sc_locked.name}' добавлено {class_amount:+d} Diamond Coin{tutor_note_ru}! (Подходящих учеников в классе пока 0)",
                    )

                return JsonResponse({
                    'success': True,
                    'isClassAward': True,
                    'isBatch': True,
                    'awardScope': award_scope,
                    'className': sc_locked.name,
                    'classBonusCoins': sc_locked.bonus_coins,
                    'tutorId': credited_tutor.id if credited_tutor else None,
                    'tutorName': credited_tutor.full_name if credited_tutor else '',
                    'tutorCoins': int(credited_tutor.coins or 0) if credited_tutor else 0,
                    'count': awarded_count,
                    'amountAwarded': amount,
                    'classAmountAwarded': class_amount,
                    'totalGiven': (awarded_count * amount) + class_amount,
                    'message': msg,
                })

            if amount == 0:
                return JsonResponse({'error': _msg(lang, "Coin miqdori 0 bo'lishi mumkin emas!", "Количество койнов не может быть 0!")}, status=400)

            if not enforce_teacher_rules and award_scope == 'active_students':
                std_ids = list(
                    CustomUser.objects.filter(role='student', grade=resolved_class_name, results__isnull=False)
                    .distinct()
                    .values_list('id', flat=True)
                )
                if not std_ids:
                    return JsonResponse({
                        'error': _msg(
                            lang,
                            f"'{resolved_class_name}' sinfida testlarda qatnashgan faol o'quvchilar topilmadi! Faol sinfning o'ziga coin berish uchun 'Faol sinf o'ziga' rejimini tanlang.",
                            f"В классе '{resolved_class_name}' не найдены активные ученики, проходившие тесты! Для награждения самого класса выберите режим 'Только фонду класса'.",
                        )
                    }, status=404)
                stds = list(CustomUser.objects.filter(id__in=std_ids))
                tx_suffix = _msg(lang, "(Faol qatnashchi - sinf bo'yicha)", "(Активный участник класса)")
            else:
                stds = list(CustomUser.objects.filter(role='student', grade=resolved_class_name))
                if not stds:
                    return JsonResponse({'error': _msg(lang, f"'{resolved_class_name}' sinfida o'quvchilar topilmadi!", f"В классе '{resolved_class_name}' ученики не найдены!")}, status=404)
                tx_suffix = _msg(lang, "(Sinf jamoasi uchun)", "(Для команды класса)")

            if enforce_teacher_rules:
                st_totals = get_teacher_students_today_coin_totals(
                    giver, [s.id for s in stds], is_admin_preview=is_admin_preview
                )
                for st in stds:
                    if st_totals.get(st.id, 0) + amount > DAILY_TEACHER_MAX_COINS:
                        return JsonResponse({
                            'error': _msg(
                                lang,
                                f"Limit: {st.full_name} ({resolved_class_name}) bugun allaqachon {st_totals.get(st.id, 0)} coin olgan. Bir bolaga {DAILY_TEACHER_MAX_COINS} coindan ortiq berib bo'lmaydi!",
                                f"Лимит: {st.full_name} ({resolved_class_name}) сегодня уже получил(а) {st_totals.get(st.id, 0)} койнов. Одному ученику нельзя начислить более {DAILY_TEACHER_MAX_COINS} койнов!",
                            ),
                            'dailyCoinStatus': get_teacher_daily_coin_status(giver, enforce_for_portal=True, grade=resolved_class_name),
                        }, status=403)

            awarded_count = 0
            with transaction.atomic():
                locked_stds = list(CustomUser.objects.select_for_update().filter(id__in=[s.id for s in stds]))
                for st in locked_stds:
                    st.coins = max(0, int(st.coins or 0) + amount)
                    st.save(update_fields=['coins'])
                    CoinTransaction.objects.create(
                        student=st,
                        given_by=giver,
                        amount=amount,
                        reason=f"{reason} {tx_suffix}".strip(),
                        portal=tx_portal,
                    )
                    awarded_count += 1
            return JsonResponse({
                'success': True,
                'isBatch': True,
                'awardScope': award_scope or 'all_students',
                'className': resolved_class_name,
                'count': awarded_count,
                'amountAwarded': amount,
                'totalGiven': awarded_count * amount,
                'dailyCoinStatus': get_teacher_daily_coin_status(giver, enforce_for_portal=enforce_teacher_rules, grade=resolved_class_name),
                'message': _msg(
                    lang,
                    f"'{resolved_class_name}' sinfidagi {awarded_count} nafar {'faol ' if award_scope == 'active_students' else 'barcha '}o'quvchiga {amount:+d} Diamond Coin muvaffaqiyatli berildi!",
                    f"{awarded_count} {'активным ' if award_scope == 'active_students' else 'всем '}ученикам класса '{resolved_class_name}' успешно начислено {amount:+d} Diamond Coin!",
                )
            })

        # 2. Yakka o'quvchiga taqdim etish
        if not student_id or amount == 0:
            return JsonResponse({'error': _msg(lang, "O'quvchi ID va coin miqdori to'g'ri kiritilishi shart!", "Необходимо корректно указать ID ученика и количество койнов!")}, status=400)

        student = CustomUser.objects.filter(id=student_id, role='student').first()
        if not student:
            return JsonResponse({'error': _msg(lang, "O'quvchi topilmadi!", "Ученик не найден!")}, status=404)

        student_grade = (student.grade or '').strip()
        if enforce_teacher_rules and amount > 0:
            st_totals = get_teacher_students_today_coin_totals(
                giver, [student.id], is_admin_preview=is_admin_preview
            )
            already_today = st_totals.get(student.id, 0)
            if already_today + amount > DAILY_TEACHER_MAX_COINS:
                return JsonResponse({
                    'error': _msg(
                        lang,
                        f"Limit: {student.full_name} bugun {already_today} coin olgan. Har bir o'quvchiga ko'pi bilan {DAILY_TEACHER_MAX_COINS} coin berish mumkin!",
                        f"Лимит: {student.full_name} сегодня уже получил(а) {already_today} койнов. Одному ученику можно начислить максимум {DAILY_TEACHER_MAX_COINS} койнов!",
                    ),
                    'dailyCoinStatus': get_teacher_daily_coin_status(giver, enforce_for_portal=True, grade=student_grade),
                }, status=403)

        test_result = None
        if result_id and is_admin and not enforce_teacher_rules:
            test_result = TestResult.objects.filter(id=result_id).first()

        with transaction.atomic():
            student_locked = CustomUser.objects.select_for_update().get(id=student.id)
            current_coins = int(student_locked.coins or 0)
            if amount < 0 and enforce_teacher_rules and current_coins < abs(amount):
                return JsonResponse({
                    'error': _msg(
                        lang,
                        f"{student_locked.full_name} hisobida yetarli coin yo'q (Mavjud: {current_coins} 💎)!",
                        f"На балансе ученика {student_locked.full_name} недостаточно койнов (Доступно: {current_coins} 💎)!",
                    )
                }, status=400)
            new_coins = max(0, current_coins + amount)
            student_locked.coins = new_coins
            student_locked.save(update_fields=['coins'])

            CoinTransaction.objects.create(
                student=student_locked,
                given_by=giver,
                amount=amount,
                reason=reason,
                test_result=test_result,
                portal=tx_portal,
            )

        success_msg = (
            _msg(
                lang,
                f"{student_locked.full_name} hisobidan {abs(amount)} Diamond Coin olindi!",
                f"С баланса ученика {student_locked.full_name} снято {abs(amount)} Diamond Coin!",
            )
            if amount < 0
            else _msg(
                lang,
                f"{student_locked.full_name} ga {amount:+d} Diamond Coin muvaffaqiyatli berildi!",
                f"Ученику {student_locked.full_name} успешно начислено {amount:+d} Diamond Coin!",
            )
        )

        return JsonResponse({
            'success': True,
            'studentId': student_locked.id,
            'studentName': student_locked.full_name,
            'coins': student_locked.coins,
            'amountAwarded': amount,
            'reason': reason,
            'dailyCoinStatus': get_teacher_daily_coin_status(giver, enforce_for_portal=enforce_teacher_rules, grade=student_grade),
            'message': success_msg,
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


def api_coin_rankings(request):
    """Admin va O'qituvchilar uchun: coinlar bo'yicha TOP va PAST natijali o'quvchilar tahlili"""
    lang = _req_lang(request)
    grade = request.GET.get('grade', 'all')
    students_qs = CustomUser.objects.filter(role='student')
    if grade and grade != 'all':
        students_qs = students_qs.filter(grade=grade)

    student_coins_sum = students_qs.aggregate(sum=Sum('coins'))['sum'] or 0
    bonus_classes_qs = SchoolClass.objects.filter(is_active=True)
    if grade and grade != 'all':
        bonus_classes_qs = bonus_classes_qs.filter(name__iexact=grade)
    class_bonus_sum = bonus_classes_qs.aggregate(sum=Sum('bonus_coins'))['sum'] or 0
    total_coins_sum = student_coins_sum + class_bonus_sum

    total_students_count = students_qs.count()
    avg_coins = round(student_coins_sum / total_students_count) if total_students_count > 0 else 0

    students_list = []
    active_students_count = 0
    for s in students_qs:
        res_count = s.results.count()
        is_active_participant = res_count > 0
        if is_active_participant:
            active_students_count += 1
        avg_score = round(s.results.aggregate(avg=Avg('score_percentage'))['avg'] or 0)
        students_list.append({
            'id': s.id,
            'fullName': s.full_name,
            'username': s.username,
            'grade': s.grade or '-',
            'avatarUrl': s.get_avatar_url(),
            'coins': s.coins,
            'testsPassed': res_count,
            'avgScore': avg_score,
            'isActiveParticipant': is_active_participant,
        })

    # TOP: Eng ko'p coin to'plaganlar
    top_students = sorted(students_list, key=lambda x: (x['coins'], x['testsPassed'], x['avgScore']), reverse=True)
    for idx, s in enumerate(top_students, 1):
        s['rank'] = idx

    # BOTTOM: Eng kam coin to'plagan / past natijalilar (pastdan yuqoriga)
    bottom_students = sorted(students_list, key=lambda x: (x['coins'], x['avgScore']))
    for idx, s in enumerate(bottom_students, 1):
        s['bottomRank'] = idx

    # So'nggi coin o'tkazmalari (o'quvchilar + faol sinf fondi birgalikda)
    combined_txs = []
    tx_qs = CoinTransaction.objects.select_related('student', 'given_by').order_by('-created_at')[:30]
    for tx in tx_qs:
        combined_txs.append({
            'id': f"s_{tx.id}",
            'entryType': 'student',
            'studentId': tx.student.id,
            'studentName': tx.student.full_name,
            'grade': tx.student.grade or '-',
            'amount': tx.amount,
            'reason': tx.reason,
            'portal': tx.portal or '',
            'givenBy': tx.given_by.full_name if tx.given_by else _msg(lang, 'Tizim (Avtomatik)', 'Система (Авто)'),
            'date': tx.created_at.strftime('%d.%m.%Y %H:%M'),
            '_sort_dt': tx.created_at,
        })

    ctx_qs = ClassCoinTransaction.objects.select_related('school_class', 'given_by', 'tutor').order_by('-created_at')[:20]
    for ctx in ctx_qs:
        cls_name = ctx.school_class.name if ctx.school_class else '-'
        tx_tutor = ctx.tutor or (ctx.school_class.tutor if ctx.school_class and ctx.school_class.tutor else None)
        combined_txs.append({
            'id': f"c_{ctx.id}",
            'entryType': 'class',
            'classId': ctx.school_class_id,
            'className': cls_name,
            'tutorId': tx_tutor.id if tx_tutor else None,
            'tutorName': tx_tutor.full_name if tx_tutor else '',
            'studentId': None,
            'studentName': (
                _msg(lang, f"{cls_name} sinfi (Tyuter: {tx_tutor.full_name})", f"Класс {cls_name} (Тьютор: {tx_tutor.full_name})")
                if tx_tutor
                else _msg(lang, f"{cls_name} sinfi (Sinf fondi)", f"Класс {cls_name} (Фонд класса)")
            ),
            'grade': cls_name,
            'amount': ctx.amount,
            'reason': ctx.reason,
            'portal': 'admin_class',
            'givenBy': ctx.given_by.full_name if ctx.given_by else _msg(lang, 'Administrator', 'Администратор'),
            'date': ctx.created_at.strftime('%d.%m.%Y %H:%M'),
            '_sort_dt': ctx.created_at,
        })

    combined_txs.sort(key=lambda item: item['_sort_dt'], reverse=True)
    recent_txs = []
    for item in combined_txs[:40]:
        item.pop('_sort_dt', None)
        recent_txs.append(item)

    # Sinflar bo'yicha coin statistikasi (Barcha faol sinflar: o'quvchilar coini + sinf fondi)
    classes_coin_stats = []
    all_school_classes = SchoolClass.objects.select_related('tutor').filter(is_active=True).order_by('grade_level', 'name')
    uz_coins_tot = 0
    ru_coins_tot = 0
    uz_stds_tot = 0
    ru_stds_tot = 0

    for sc in all_school_classes:
        st_qs = CustomUser.objects.filter(role='student', grade=sc.name)
        st_count = st_qs.count()
        st_coins = sum(int(s.coins or 0) for s in st_qs)
        cls_bonus = int(sc.bonus_coins or 0)
        tot_c = st_coins + cls_bonus
        avg_c = round(st_coins / st_count) if st_count > 0 else 0
        active_st_cnt = st_qs.filter(results__isnull=False).distinct().count()
        cls_res_qs = TestResult.objects.filter(student__grade=sc.name)
        subs_cnt = cls_res_qs.count()
        cls_avg_score = round(cls_res_qs.aggregate(avg=Avg('score_percentage'))['avg'] or 0) if subs_cnt > 0 else 0

        if sc.language == 'uz':
            uz_coins_tot += tot_c
            uz_stds_tot += st_count
        else:
            ru_coins_tot += tot_c
            ru_stds_tot += st_count

        tutor_obj = sc.tutor if (sc.tutor and sc.tutor.role == 'tutor') else None
        classes_coin_stats.append({
            'id': sc.id,
            'className': sc.name,
            'language': sc.language,
            'languageLabel': (
                _msg(lang, "O'zbek tili", "Узбекский язык")
                if sc.language == 'uz'
                else _msg(lang, "Rus tili (Русский)", "Русский язык")
            ),
            'tutorId': tutor_obj.id if tutor_obj else None,
            'tutorName': tutor_obj.full_name if tutor_obj else '',
            'tutorCoins': int(tutor_obj.coins or 0) if tutor_obj else 0,
            'studentCoins': st_coins,
            'classBonusCoins': cls_bonus,
            'bonusCoins': cls_bonus,
            'totalCoins': tot_c,
            'avgCoins': avg_c,
            'avgScore': cls_avg_score,
            'studentsCount': st_count,
            'activeStudentsCount': active_st_cnt,
            'submissionsCount': subs_cnt,
            'isActiveParticipant': bool(tot_c > 0 or subs_cnt > 0 or cls_bonus > 0),
        })

    # Eng ko'p to'plagan sinflar bo'yicha tartiblash
    classes_coin_stats.sort(key=lambda x: (x['totalCoins'], x['submissionsCount'], x['studentsCount']), reverse=True)
    for idx, c in enumerate(classes_coin_stats):
        c['rank'] = idx + 1

    lang_denom = (uz_coins_tot + ru_coins_tot) or total_coins_sum
    language_coin_stats = {
        'uzbek': {
            'totalCoins': uz_coins_tot,
            'studentsCount': uz_stds_tot,
            'pct': round((uz_coins_tot / lang_denom) * 100) if lang_denom > 0 else 0
        },
        'russian': {
            'totalCoins': ru_coins_tot,
            'studentsCount': ru_stds_tot,
            'pct': round((ru_coins_tot / lang_denom) * 100) if lang_denom > 0 else 0
        }
    }

    # O'quvchilarning coin toifalari taqsimoti (Donut grafik shakli uchun)
    tier_base_qs = students_qs
    tier_diamond_qs = tier_base_qs.filter(coins__gte=100)
    tier_gold_qs = tier_base_qs.filter(coins__gte=50, coins__lt=100)
    tier_silver_qs = tier_base_qs.filter(coins__gte=20, coins__lt=50)
    tier_bronze_qs = tier_base_qs.filter(coins__gte=1, coins__lt=20)
    tier_zero_qs = tier_base_qs.filter(coins=0)

    tier_diamond = tier_diamond_qs.count()
    tier_gold = tier_gold_qs.count()
    tier_silver = tier_silver_qs.count()
    tier_bronze = tier_bronze_qs.count()
    tier_zero = tier_zero_qs.count()

    student_coin_tiers = {
        'diamond': tier_diamond,
        'gold': tier_gold,
        'silver': tier_silver,
        'bronze': tier_bronze,
        'zero': tier_zero,
        'tierCoins': {
            'diamond': tier_diamond_qs.aggregate(sum=Sum('coins'))['sum'] or 0,
            'gold': tier_gold_qs.aggregate(sum=Sum('coins'))['sum'] or 0,
            'silver': tier_silver_qs.aggregate(sum=Sum('coins'))['sum'] or 0,
            'bronze': tier_bronze_qs.aggregate(sum=Sum('coins'))['sum'] or 0,
            'zero': 0,
        },
    }

    # Coin manbalari (portal/sabab bo'yicha) hamda kunlik coin dinamikasi
    all_tx_analytics = CoinTransaction.objects.select_related('given_by', 'student')
    all_ctx_analytics = ClassCoinTransaction.objects.select_related('school_class')
    all_res_analytics = TestResult.objects.select_related('student')
    if grade and grade != 'all':
        all_tx_analytics = all_tx_analytics.filter(student__grade=grade)
        all_ctx_analytics = all_ctx_analytics.filter(school_class__name__iexact=grade)
        all_res_analytics = all_res_analytics.filter(student__grade=grade)

    src_buckets = {
        'test_auto': {
            'key': 'test_auto',
            'label': _msg(lang, 'Avtomatik Test & Top-N Bonus', 'Авто за тест и Топ-N бонус'),
            'shortLabel': _msg(lang, 'Avto Test', 'Авто тест'),
            'coins': 0,
            'txCount': 0,
            'color': '#10b981',
        },
        'admin_students': {
            'key': 'admin_students',
            'label': _msg(lang, "Admin: Faol O'quvchilarga", "Админ: активным ученикам"),
            'shortLabel': _msg(lang, "Admin (Bola)", "Админ (учен.)"),
            'coins': 0,
            'txCount': 0,
            'color': '#f59e0b',
        },
        'admin_class': {
            'key': 'admin_class',
            'label': _msg(lang, 'Admin: Faol Sinflar Fondi', 'Админ: фонд активных классов'),
            'shortLabel': _msg(lang, 'Sinf Fondi', 'Фонд класса'),
            'coins': 0,
            'txCount': 0,
            'color': '#a855f7',
        },
        'teacher_lesson': {
            'key': 'teacher_lesson',
            'label': _msg(lang, "O'qituvchi: Dars Faolligi", "Учитель: активность на уроке"),
            'shortLabel': _msg(lang, 'Dars Faolligi', 'Урок'),
            'coins': 0,
            'txCount': 0,
            'color': '#06b6d4',
        },
        'test_manual': {
            'key': 'test_manual',
            'label': _msg(lang, 'Test Natijalari & Yaratish', 'Результаты и создание тестов'),
            'shortLabel': _msg(lang, 'Test Mukofoti', 'Тесты'),
            'coins': 0,
            'txCount': 0,
            'color': '#3b82f6',
        },
    }
    timeline_map = {}

    def _to_date_key(dt):
        if not dt:
            return None
        try:
            local_dt = timezone.localtime(dt) if timezone.is_aware(dt) else dt
        except Exception:
            local_dt = dt
        return local_dt.strftime('%Y-%m-%d'), local_dt.strftime('%d.%m'), local_dt.strftime('%d.%m.%Y')

    def _ensure_tl(dt):
        keys = _to_date_key(dt)
        if not keys:
            return None
        dk, lbl, full_d = keys
        if dk not in timeline_map:
            timeline_map[dk] = {
                'dateKey': dk,
                'label': lbl,
                'fullDate': full_d,
                'studentCoins': 0,
                'classCoins': 0,
                'totalCoins': 0,
                'txCount': 0,
                'submissionsCount': 0,
            }
        return timeline_map[dk]

    for tx in all_tx_analytics:
        amt = int(tx.amount or 0)
        p = (tx.portal or '').strip().lower()
        if p in ('test_score', 'test_bonus') or (not p and tx.test_result_id and not tx.given_by_id):
            bkey = 'test_auto'
        elif p in ('teacher_results', 'test_create', 'admin_test_reward') or (tx.test_result_id and tx.given_by_id):
            bkey = 'test_manual'
        elif p in ('lesson_activity', 'teacher') or (not p and not tx.test_result_id and tx.given_by and tx.given_by.role == 'teacher'):
            bkey = 'teacher_lesson'
        else:
            bkey = 'admin_students'
        if amt > 0:
            src_buckets[bkey]['coins'] += amt
            src_buckets[bkey]['txCount'] += 1
        tl = _ensure_tl(tx.created_at)
        if tl is not None and amt > 0:
            tl['studentCoins'] += amt
            tl['totalCoins'] += amt
            tl['txCount'] += 1

    for ctx in all_ctx_analytics:
        amt = int(ctx.amount or 0)
        if amt > 0:
            src_buckets['admin_class']['coins'] += amt
            src_buckets['admin_class']['txCount'] += 1
        tl = _ensure_tl(ctx.created_at)
        if tl is not None and amt > 0:
            tl['classCoins'] += amt
            tl['totalCoins'] += amt
            tl['txCount'] += 1

    for tr in all_res_analytics:
        tl = _ensure_tl(tr.submitted_at)
        if tl is not None:
            tl['submissionsCount'] += 1

    coin_sources = list(src_buckets.values())
    coin_timeline = [timeline_map[k] for k in sorted(timeline_map.keys())][-12:]

    tutor_rankings = []
    for tut in CustomUser.objects.filter(role='tutor').prefetch_related('tutor_classes').order_by('-coins', 'full_name'):
        t_classes = [c.name for c in tut.tutor_classes.all() if c.is_active]
        tutor_rankings.append({
            'id': tut.id,
            'fullName': tut.full_name,
            'username': tut.username,
            'coins': int(tut.coins or 0),
            'assignedClasses': t_classes,
            'avatarUrl': tut.get_avatar_url(),
        })

    return JsonResponse({
        'success': True,
        'summary': {
            'totalCoins': total_coins_sum,
            'studentsCoinsTotal': student_coins_sum,
            'classBonusCoinsTotal': class_bonus_sum,
            'totalStudents': total_students_count,
            'activeStudentsCount': active_students_count,
            'avgCoins': avg_coins,
            'topPerformer': top_students[0]['fullName'] if top_students else '-',
            'topPerformerCoins': top_students[0]['coins'] if top_students else 0
        },
        'topStudents': top_students[:500],
        'bottomStudents': bottom_students[:500],
        'tutorRankings': tutor_rankings,
        'recentTransactions': recent_txs,
        'classesCoinStats': classes_coin_stats,
        'languageCoinStats': language_coin_stats,
        'studentCoinTiers': student_coin_tiers,
        'coinSources': coin_sources,
        'coinTimeline': coin_timeline,
    })


def api_student_coin_history(request):
    """O'quvchi o'zining barcha coinlarini va qayerdan olganligini ko'rishi uchun"""
    lang = _req_lang(request)
    student_id = request.GET.get('studentId')
    student = None
    if student_id:
        student = CustomUser.objects.filter(id=student_id).first()
    elif request.user.is_authenticated:
        student = request.user

    if not student:
        return JsonResponse({'error': _msg(lang, "O'quvchi topilmadi", "Ученик не найден")}, status=400)

    txs = CoinTransaction.objects.filter(student=student).select_related('given_by').order_by('-created_at')[:30]
    history = []
    for tx in txs:
        history.append({
            'id': tx.id,
            'amount': tx.amount,
            'reason': tx.reason,
            'givenBy': tx.given_by.full_name if tx.given_by else _msg(lang, 'Tizim (Avtomatik)', 'Система (Авто)'),
            'date': tx.created_at.strftime('%d.%m.%Y %H:%M')
        })

    return JsonResponse({
        'coins': student.coins,
        'history': history
    })


def api_teacher_test_participants(request, test_id):
    """O'qituvchi ma'lum bir test natijalarini ko'rish va diagrammalar bilan tahlil qilish"""
    perm_err = check_teacher_permission(request)
    if perm_err:
        return perm_err
    lang = _req_lang(request)

    test = Test.objects.select_related('teacher').filter(id=test_id).first()
    if not test:
        return JsonResponse({'error': _msg(lang, 'Test topilmadi!', 'Тест не найден!')}, status=404)

    if not is_admin_user(request.user) and test.teacher_id != request.user.id:
        return JsonResponse({'error': _msg(lang, "Sizga faqat o'zingizga biriktirilgan test natijalarini ko'rishga ruxsat berilgan!", "Вам разрешено просматривать результаты только назначенных вам тестов!")}, status=403)

    results = list(
        TestResult.objects.filter(test=test)
        .select_related('student')
        .order_by('-score_percentage', 'time_spent_seconds', '-submitted_at', 'id')
    )

    # Sum coin transactions per individual TestResult (prevents double-counting repeat attempts)
    result_txs = {}
    for tx in CoinTransaction.objects.filter(test_result__test=test, test_result__isnull=False):
        result_txs[tx.test_result_id] = result_txs.get(tx.test_result_id, 0) + int(tx.amount or 0)

    total_coins_awarded = sum(result_txs.values())
    scores = [int(r.score_percentage or 0) for r in results]
    total_cnt = len(results)
    avg_score = round(sum(scores) / total_cnt) if total_cnt > 0 else 0
    max_score = max(scores) if scores else 0
    min_score = min(scores) if scores else 0
    pass_count = sum(1 for s in scores if s >= 60)
    pass_rate = round((pass_count / total_cnt) * 100) if total_cnt > 0 else 0
    avg_time_seconds = round(sum(int(r.time_spent_seconds or 0) for r in results) / total_cnt) if total_cnt > 0 else 0
    unique_students = len({r.student_id for r in results})
    distribution = _calc_distribution(scores)

    # Chronological attempt numbering per student on this test
    chronological_results = sorted(results, key=lambda r: (r.submitted_at or timezone.now(), r.id))
    student_total_attempts = {}
    for r in chronological_results:
        student_total_attempts[r.student_id] = student_total_attempts.get(r.student_id, 0) + 1
    student_seen_count = {}
    attempt_map = {}
    for r in chronological_results:
        student_seen_count[r.student_id] = student_seen_count.get(r.student_id, 0) + 1
        attempt_map[r.id] = (student_seen_count[r.student_id], student_total_attempts[r.student_id])

    # Group results by class for comparison diagrams
    by_class_map = {}
    participants = []
    for idx, r in enumerate(results, 1):
        s = r.student
        grade_label = (s.grade or 'Belgilanmagan').strip() or 'Belgilanmagan'
        already_awarded = result_txs.get(r.id, 0)
        attempt_num, total_attempts = attempt_map.get(r.id, (1, 1))

        # Tavsiya etilgan rag'batlantirish miqdori
        if idx == 1 and r.score_percentage >= 70:
            suggested = 50
        elif idx == 2 and r.score_percentage >= 60:
            suggested = 30
        elif idx == 3 and r.score_percentage >= 50:
            suggested = 20
        elif r.score_percentage >= 80:
            suggested = 25
        elif r.score_percentage >= 50:
            suggested = 10
        else:
            suggested = 5

        mins = int(r.time_spent_seconds or 0) // 60
        secs = int(r.time_spent_seconds or 0) % 60

        cls_bucket = by_class_map.setdefault(grade_label, {
            'className': grade_label,
            'scores': [],
            'studentIds': set(),
            'coinsAwarded': 0,
            'timeTotal': 0,
        })
        cls_bucket['scores'].append(int(r.score_percentage or 0))
        cls_bucket['studentIds'].add(s.id)
        cls_bucket['coinsAwarded'] += already_awarded
        cls_bucket['timeTotal'] += int(r.time_spent_seconds or 0)

        participants.append({
            'rank': idx,
            'resultId': r.id,
            'studentId': s.id,
            'student_name': s.full_name,
            'fullName': s.full_name,
            'username': s.username,
            'grade': s.grade or '-',
            'avatarUrl': s.get_avatar_url(),
            'currentCoins': s.coins,
            'attemptNumber': attempt_num,
            'totalStudentAttempts': total_attempts,
            'score': r.score_percentage,
            'score_percentage': r.score_percentage,
            'correctCount': r.correct_answers,
            'correctAnswers': r.correct_answers,
            'totalCount': r.total_questions,
            'totalQuestions': r.total_questions,
            'timeSpentSeconds': r.time_spent_seconds,
            'timeStr': _msg(lang, f"{mins}m {secs:02d}s", f"{mins} мин {secs:02d} с"),
            'time_spent_display': _msg(lang, f"{mins} daq {secs:02d}s", f"{mins} мин {secs:02d} с"),
            'date': r.submitted_at.strftime('%d.%m.%Y %H:%M') if r.submitted_at else '-',
            'submitted_at': r.submitted_at.strftime('%d.%m.%Y %H:%M') if r.submitted_at else '-',
            'alreadyAwardedCoins': already_awarded,
            'suggestedAmount': suggested
        })

    class_comparison = []
    for cname, b in by_class_map.items():
        c_scores = b['scores']
        c_cnt = len(c_scores)
        c_pass = sum(1 for sc in c_scores if sc >= 60)
        class_comparison.append({
            'className': cname,
            'submissions': c_cnt,
            'uniqueStudents': len(b['studentIds']),
            'avgScore': round(sum(c_scores) / c_cnt) if c_cnt else 0,
            'minScore': min(c_scores) if c_scores else 0,
            'maxScore': max(c_scores) if c_scores else 0,
            'passCount': c_pass,
            'passRate': round((c_pass / c_cnt) * 100) if c_cnt else 0,
            'coinsAwarded': b['coinsAwarded'],
            'avgTimeSeconds': round(b['timeTotal'] / c_cnt) if c_cnt else 0,
        })
    class_comparison.sort(key=lambda x: (-x['avgScore'], x['className']))

    # Per-question accuracy for this test (overall + per class)
    t_questions = list(test.questions.prefetch_related('options').order_by('order', 'id'))
    answers_list = list(
        StudentAnswer.objects.filter(result__test=test)
        .select_related('result__student', 'question', 'selected_option')
    )
    ans_by_q = {}
    ans_by_class_q = {}
    for a in answers_list:
        ans_by_q.setdefault(a.question_id, []).append(a)
        st_grade = (a.result.student.grade or '').strip() if a.result and a.result.student else ''
        if st_grade:
            ans_by_class_q.setdefault(st_grade, {}).setdefault(a.question_id, []).append(a)

    question_stats = [_calc_question_stats_for_answers(q, ans_by_q.get(q.id, []), lang=lang) for q in t_questions]
    question_stats_by_class = {}
    for cls_name in by_class_map.keys():
        if cls_name == 'Belgilanmagan':
            continue
        cls_q_map = ans_by_class_q.get(cls_name, {})
        question_stats_by_class[cls_name] = [
            _calc_question_stats_for_answers(q, cls_q_map.get(q.id, []), lang=lang) for q in t_questions
        ]

    giver = request.user
    portal = request.GET.get('portal', '').strip().lower()
    enforce_for_portal = (portal == 'teacher') or (not is_admin_user(giver))

    reward_slots_used = (
        CoinTransaction.objects.filter(test_result__test=test, portal='test_bonus')
        .values('student_id')
        .distinct()
        .count()
    ) if (test.reward_top_count or 0) > 0 else 0

    return JsonResponse({
        'success': True,
        'test': {
            'id': test.id,
            'title': test.title,
            'grade': test.grade,
            'subject': test.subject,
            'language': test.language,
            'questionsCount': len(t_questions),
            'totalParticipants': len(participants),
            'uniqueStudents': unique_students,
            'avgScore': avg_score,
            'minScore': min_score,
            'maxScore': max_score,
            'passCount': pass_count,
            'passRate': pass_rate,
            'avgTimeSeconds': avg_time_seconds,
            'totalCoinsAwarded': total_coins_awarded,
            'rewardTopCount': int(test.reward_top_count or 0),
            'rewardCoinsAmount': int(test.reward_coins_amount or 0),
            'rewardMinScore': int(test.reward_min_score or 0),
            'rewardSlotsUsed': reward_slots_used,
            'distribution': distribution,
            'classComparison': class_comparison,
            'questionStats': question_stats,
            'questionStatsByClass': question_stats_by_class,
        },
        'participants': participants,
        'dailyCoinStatus': get_teacher_daily_coin_status(giver, enforce_for_portal=enforce_for_portal),
    })


@csrf_exempt
def api_teacher_test_distribute_coins(request, test_id):
    """Faqat Administrator tomonidan test qatnashchilariga coinlar taqsimlash (O'qituvchiga yopiq)"""
    lang = _req_lang(request)
    if request.method != 'POST':
        return JsonResponse({'error': _msg(lang, "Faqat POST so'rovi qabul qilinadi", "Принимаются только POST-запросы")}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({'error': _msg(lang, 'Tizimga kirish talab etiladi!', 'Требуется вход в систему!')}, status=401)
    if not is_admin_user(request.user):
        return JsonResponse({
            'error': _msg(
                lang,
                "Cheklov: O'qituvchi test natijalari uchun coin bera olmaydi. O'qituvchi faqat darsdagi faollik uchun coin berishi mumkin!",
                "Ограничение: учитель не может начислять койны за результаты тестов. Учитель может начислять койны только за активность на уроке!",
            )
        }, status=403)

    test = Test.objects.filter(id=test_id).first()
    if not test:
        return JsonResponse({'error': _msg(lang, 'Test topilmadi!', 'Тест не найден!')}, status=404)

    try:
        data = json.loads(request.body.decode('utf-8'))
        mode = data.get('mode')
        distributions = data.get('distributions', [])

        ordered_results = list(
            TestResult.objects.filter(test=test)
            .select_related('student')
            .order_by('-score_percentage', 'time_spent_seconds', '-submitted_at', 'id')
        )
        # Har bir o'quvchining eng yaxshi natijasi bo'yicha bir martadan kiritish (takroriy urinishda ikki marta to'lanmasligi uchun)
        unique_results = []
        seen_student_ids = set()
        for r in ordered_results:
            if r.student_id not in seen_student_ids:
                seen_student_ids.add(r.student_id)
                unique_results.append(r)

        # Smart distribution presets
        if mode == 'top3':
            distributions = []
            for idx, r in enumerate(unique_results[:3], 1):
                amt = 50 if idx == 1 else (30 if idx == 2 else 20)
                emoji = "🥇" if idx == 1 else ("🥈" if idx == 2 else "🥉")
                distributions.append({
                    'studentId': r.student_id,
                    'amount': amt,
                    'reason': _msg(lang, f"\"{test.title}\" testida {idx}-o'rin {emoji}", f"{idx}-е место в тесте «{test.title}» {emoji}"),
                    'resultId': r.id
                })
        elif mode == 'top_n':
            top_n = max(1, int(data.get('topCount') or data.get('topN') or 3))
            amt = int(data.get('amount') or 20)
            min_score = max(0, int(data.get('minScore') or 0))
            custom_reason = (data.get('reason') or '').strip()
            eligible = [r for r in unique_results if int(r.score_percentage or 0) >= min_score][:top_n]
            distributions = []
            for idx, r in enumerate(eligible, 1):
                distributions.append({
                    'studentId': r.student_id,
                    'amount': amt,
                    'reason': custom_reason or _msg(
                        lang,
                        f"\"{test.title}\" testida faol Top-{top_n} ishtirok (#{idx}-o'rin, {r.score_percentage}%) 🌟",
                        f"Активное участие Топ-{top_n} в тесте «{test.title}» (#{idx}-е место, {r.score_percentage}%) 🌟",
                    ),
                    'resultId': r.id
                })
        elif mode == 'high_scorers':
            min_score = int(data.get('minScore') or 70)
            amt = int(data.get('amount') or 20)
            distributions = []
            for r in [res for res in unique_results if int(res.score_percentage or 0) >= min_score]:
                distributions.append({
                    'studentId': r.student_id,
                    'amount': amt,
                    'reason': _msg(lang, f"\"{test.title}\" testida {r.score_percentage}% a'lo natija uchun ⭐", f"За отличный результат {r.score_percentage}% в тесте «{test.title}» ⭐"),
                    'resultId': r.id
                })
        elif mode == 'all':
            amt = int(data.get('amount') or 10)
            distributions = []
            for r in unique_results:
                distributions.append({
                    'studentId': r.student_id,
                    'amount': amt,
                    'reason': _msg(lang, f"\"{test.title}\" testidagi faol ishtirok uchun 🎁", f"За активное участие в тесте «{test.title}» 🎁"),
                    'resultId': r.id
                })
        elif not distributions and data.get('studentId') and data.get('amount'):
            # Single award
            distributions = [{
                'studentId': data.get('studentId'),
                'amount': int(data.get('amount')),
                'reason': data.get('reason') or _msg(lang, f"\"{test.title}\" testidagi namunali natija uchun 💎", f"За образцовый результат в тесте «{test.title}» 💎"),
                'resultId': data.get('resultId')
            }]

        if not distributions or not isinstance(distributions, list):
            return JsonResponse({'error': _msg(lang, "Taqsimlash uchun o'quvchilar topilmadi yoki ro'yxat bo'sh!", "Ученики для начисления не найдены или список пуст!")}, status=400)

        actor = get_request_teacher_or_admin(request)
        giver = actor if (actor and getattr(actor, 'is_authenticated', False)) else (request.user if request.user.is_authenticated else actor)
        is_admin = is_admin_user(giver)

        # O'qituvchilar uchun kunlik limit tekshiruvi: har bir sinf uchun kuniga max 5 coin
        if not is_admin:
            daily_status = get_teacher_daily_coin_status(giver)
            per_cls_map = daily_status.get('perClassStatus', {})
            planned_by_grade = {}
            for item in distributions:
                st_id = item.get('studentId')
                amt = int(item.get('amount') or 0)
                if amt <= 0:
                    return JsonResponse({'error': _msg(lang, "Coin miqdori musbat bo'lishi shart!", "Количество койнов должно быть положительным!")}, status=400)
                if amt > DAILY_TEACHER_MAX_COINS:
                    return JsonResponse({
                        'error': _msg(
                            lang,
                            f"Kunlik limit: Har bir sinf uchun kuniga ko'pi bilan {DAILY_TEACHER_MAX_COINS} coin berish mumkin!",
                            f"Дневной лимит: максимум {DAILY_TEACHER_MAX_COINS} койнов в день для каждого класса!",
                        )
                    }, status=403)
                st = CustomUser.objects.filter(id=st_id, role='student').first()
                if st:
                    g = (st.grade or '').strip()
                    if not g:
                        return JsonResponse({'error': _msg(lang, "O'quvchining sinfi biriktirilmagan!", "У ученика не указан класс!")}, status=400)
                    planned_by_grade[g] = planned_by_grade.get(g, 0) + amt

            for g, g_planned in planned_by_grade.items():
                rem_for_g = per_cls_map.get(g, {}).get('coinsRemainingToday', DAILY_TEACHER_MAX_COINS)
                if g_planned > rem_for_g:
                    return JsonResponse({
                        'error': _msg(
                            lang,
                            f"'{g}' sinfi uchun kunlik limitdan oshib ketdi! Bugun yana ko'pi bilan {rem_for_g} coin berishingiz mumkin.",
                            f"Превышен дневной лимит для класса '{g}'! Сегодня можно начислить не более {rem_for_g} койнов.",
                        ),
                        'dailyCoinStatus': get_teacher_daily_coin_status(giver, grade=g)
                    }, status=403)

        awarded_count = 0
        total_coins_distributed = 0
        awarded_students = []

        with transaction.atomic():
            for item in distributions:
                student_id = item.get('studentId')
                amount = int(item.get('amount') or 0)
                reason = (item.get('reason') or _msg(lang, f"\"{test.title}\" testidagi muvaffaqiyat uchun", f"За успех в тесте «{test.title}»")).strip()
                result_id = item.get('resultId')

                if not student_id or amount <= 0:
                    continue

                student = CustomUser.objects.select_for_update().filter(id=student_id, role='student').first()
                if not student:
                    continue

                test_result = None
                if result_id:
                    test_result = TestResult.objects.filter(id=result_id).first()
                if not test_result:
                    test_result = TestResult.objects.filter(test=test, student=student).order_by('-score_percentage').first()

                student.coins = max(0, int(student.coins or 0) + amount)
                student.save(update_fields=['coins'])

                CoinTransaction.objects.create(
                    student=student,
                    given_by=giver,
                    amount=amount,
                    reason=reason,
                    test_result=test_result,
                    portal='admin_test_reward',
                )

                awarded_count += 1
                total_coins_distributed += amount
                awarded_students.append({
                    'id': student.id,
                    'fullName': student.full_name,
                    'amount': amount,
                    'totalCoins': student.coins
                })

        return JsonResponse({
            'success': True,
            'message': _msg(
                lang,
                f"{awarded_count} nafar o'quvchiga jami {total_coins_distributed} Diamond Coin muvaffaqiyatli taqsimlandi!",
                f"{awarded_count} ученикам успешно распределено всего {total_coins_distributed} Diamond Coin!",
            ),
            'awardedCount': awarded_count,
            'totalCoinsDistributed': total_coins_distributed,
            'awardedStudents': awarded_students,
            'dailyCoinStatus': get_teacher_daily_coin_status(giver),
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


def api_test_result_detail(request, result_id):
    """Bitta o'quvchi topshirig'ining to'liq tahlili (savollar va tanlangan javoblar)"""
    perm_err = check_teacher_permission(request)
    if perm_err:
        return perm_err
    lang = _req_lang(request)

    result = TestResult.objects.filter(id=result_id).select_related('student', 'test').first()
    if not result:
        return JsonResponse({'error': _msg(lang, 'Natija topilmadi', 'Результат не найден')}, status=404)

    if not is_admin_user(request.user) and result.test.teacher_id != request.user.id:
        return JsonResponse({'error': _msg(lang, "Sizga faqat o'zingizga biriktirilgan test natijalarini ko'rishga ruxsat berilgan!", "Вам разрешено просматривать результаты только назначенных вам тестов!")}, status=403)

    answers = StudentAnswer.objects.filter(result=result).select_related('question', 'selected_option')
    breakdown = []
    for a in answers:
        q = a.question
        corr = q.options.filter(is_correct=True).first()
        breakdown.append({
            'questionId': q.id,
            'questionText': q.text,
            'imageUrl': q.get_image_url(),
            'selectedText': a.selected_option.text if a.selected_option else _msg(lang, 'Tanlanmagan', 'Не выбран'),
            'correctText': corr.text if corr else '',
            'isCorrect': a.is_correct,
            'explanation': getattr(q, 'explanation', '')
        })

    mins = result.time_spent_seconds // 60
    secs = result.time_spent_seconds % 60
    time_spent_display = _msg(lang, f"{mins} daqiqa {secs:02d} soniya", f"{mins} мин {secs:02d} сек")

    coins_awarded = sum(tx.amount for tx in CoinTransaction.objects.filter(test_result=result))

    return JsonResponse({
        'success': True,
        'result': {
            'id': result.id,
            'studentName': result.student.full_name,
            'studentUsername': result.student.username,
            'studentGrade': result.student.grade or '-',
            'studentCoins': result.student.coins,
            'studentId': result.student.id,
            'testId': result.test.id,
            'testTitle': result.test.title,
            'score': result.score_percentage,
            'scorePercentage': result.score_percentage,
            'correctAnswers': result.correct_answers,
            'totalQuestions': result.total_questions,
            'timeSpentDisplay': time_spent_display,
            'submittedAt': result.submitted_at.strftime('%d.%m.%Y %H:%M') if result.submitted_at else '-',
            'coinsAwarded': coins_awarded,
            'breakdown': breakdown
        }
    })


def api_teacher_class_students(request):
    """O'qituvchi dars jarayonida sinf o'quvchilariga tezkor coin berishi uchun ro'yxat"""
    perm_err = check_teacher_permission(request)
    if perm_err:
        return perm_err

    grade = request.GET.get('grade', '').strip()
    search = request.GET.get('search', '').strip()

    qs = CustomUser.objects.filter(role='student')
    if grade and grade != 'all' and grade != 'Barchasi':
        qs = qs.filter(grade=grade)

    if search:
        qs = qs.filter(Q(full_name__icontains=search) | Q(username__icontains=search))

    qs = qs.order_by('grade', 'full_name')

    students = []
    for s in qs:
        res_qs = s.results.all()
        tests_passed = res_qs.count()
        avg_score = round(res_qs.aggregate(avg=Avg('score_percentage'))['avg'] or 0) if tests_passed > 0 else 0
        students.append({
            'id': s.id,
            'fullName': s.full_name,
            'full_name': s.full_name,
            'username': s.username,
            'grade': s.grade or '-',
            'phone': s.phone or '-',
            'coins': s.coins,
            'testsPassed': tests_passed,
            'avgScore': avg_score,
            'avatarUrl': s.get_avatar_url()
        })

    giver = request.user
    portal = request.GET.get('portal', '').strip().lower()
    enforce_for_portal = (portal == 'teacher') or (not is_admin_user(giver))

    return JsonResponse({
        'success': True,
        'count': len(students),
        'students': students,
        'classesMeta': get_active_classes_meta(),
        'dailyCoinStatus': get_teacher_daily_coin_status(giver, enforce_for_portal=enforce_for_portal, grade=grade),
    })


def api_teacher_coin_history(request):
    """O'qituvchi tomonidan berilgan barcha coinlar tarixi (Dars jarayonidagi va testlar bo'yicha)"""
    actor, auth_err = _resolve_authenticated_teacher_actor(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)

    grade = request.GET.get('grade', '').strip()
    search = request.GET.get('search', '').strip()
    portal = request.GET.get('portal', '').strip().lower()

    if actor == '__admin_only__':
        qs = CoinTransaction.objects.filter(given_by__role='admin')
    elif is_admin_user(actor):
        qs = CoinTransaction.objects.all()
    else:
        qs = CoinTransaction.objects.filter(given_by=actor)

    if grade and grade != 'all' and grade != 'Barchasi':
        qs = qs.filter(student__grade=grade)

    if search:
        qs = qs.filter(Q(student__full_name__icontains=search) | Q(reason__icontains=search))

    qs = qs.select_related('student', 'given_by', 'test_result__test').order_by('-created_at')[:100]

    giver = request.user
    actor_is_admin = is_admin_user(request.user)
    enforce_for_portal = (portal == 'teacher') or (not actor_is_admin)

    history = []
    for tx in qs:
        reason_str = tx.reason or ''
        is_non_lesson_reason = bool(NON_LESSON_COIN_REASON_RE.search(reason_str))
        is_classroom = (tx.test_result is None) and (not is_non_lesson_reason)
        test_title = tx.test_result.test.title if tx.test_result and tx.test_result.test else None
        if is_classroom and int(tx.amount or 0) < 0:
            category_label = _msg(lang, "Coin olish / Jarima 🔻", "Снятие койнов / Штраф 🔻")
            short_badge = _msg(lang, "🔻 Coin olish", "🔻 Снятие")
        elif is_classroom:
            category_label = _msg(lang, "Darsdagi faollik 📚", "Активность на уроке 📚")
            short_badge = _msg(lang, "📚 Dars faolligi", "📚 Активность на уроке")
        elif test_title:
            category_label = _msg(lang, f"Test: {test_title} 📝", f"Тест: {test_title} 📝")
            short_badge = _msg(lang, "📝 Test", "📝 Тест")
        elif 'olimpiad' in reason_str.lower() or 'олимпиад' in reason_str.lower():
            category_label = _msg(lang, "Olimpiada 🏆", "Олимпиада 🏆")
            short_badge = _msg(lang, "🏆 Olimpiada", "🏆 Олимпиада")
        else:
            category_label = _msg(lang, "Boshqa holat 📋", "Другое 📋")
            short_badge = _msg(lang, "📋 Boshqa", "📋 Другое")
        history.append({
            'id': tx.id,
            'studentId': tx.student.id,
            'studentName': tx.student.full_name,
            'student_name': tx.student.full_name,
            'grade': tx.student.grade or '-',
            'avatarUrl': tx.student.get_avatar_url(),
            'amount': tx.amount,
            'reason': tx.reason,
            'isClassroom': is_classroom,
            'testTitle': test_title,
            'category': category_label,
            'categoryBadge': short_badge,
            'givenBy': tx.given_by.full_name if tx.given_by else _msg(lang, 'Tizim', 'Система'),
            'date': tx.created_at.strftime('%d.%m.%Y %H:%M'),
            'created_at': tx.created_at.strftime('%d.%m.%Y %H:%M'),
            'canEdit': is_classroom if enforce_for_portal else True,
            'canDelete': False  # O'qituvchilar o'chira olmaydi!
        })

    return JsonResponse({
        'success': True,
        'count': len(history),
        'history': history,
        'dailyCoinStatus': get_teacher_daily_coin_status(giver, enforce_for_portal=enforce_for_portal, grade=grade),
    })


@csrf_exempt
def api_teacher_coin_edit(request, tx_id):
    """O'qituvchi o'zi bergan coini tahrirlashi (edit) mumkin, lekin o'chira olmaydi"""
    lang = _req_lang(request)
    if request.method != 'POST':
        return JsonResponse({'error': _msg(lang, "Faqat POST so'rovi qabul qilinadi", "Принимаются только POST-запросы")}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({'error': _msg(lang, 'Tizimga kirish talab etiladi!', 'Требуется вход в систему!')}, status=401)

    perm_err = check_teacher_permission(request)
    if perm_err:
        return perm_err

    tx = CoinTransaction.objects.filter(id=tx_id).select_related('student', 'given_by').first()
    if not tx:
        return JsonResponse({'error': _msg(lang, 'Coin tranzaksiyasi topilmadi!', 'Транзакция койнов не найдена!')}, status=404)

    giver = request.user
    is_admin = is_admin_user(giver)

    try:
        data = json.loads(request.body.decode('utf-8'))
        portal = (data.get('portal') or '').strip().lower()
        enforce_teacher_rules = (not is_admin) or (portal == 'teacher')
        is_admin_preview = is_admin and (portal == 'teacher')

        # Agar teacher qoidalari faol bo'lsa, faqat dars faolligi tranzaksiyasini tahrirlashi mumkin
        if enforce_teacher_rules:
            if tx.test_result is not None or NON_LESSON_COIN_REASON_RE.search(tx.reason or ''):
                return JsonResponse({
                    'error': _msg(
                        lang,
                        "Cheklov: O'qituvchi faqat darsdagi faollik coinlarini tahrirlashi mumkin! Test yoki boshqa turdagi coinlarni tahrirlash taqiqlangan.",
                        "Ограничение: учитель может редактировать только койны за активность на уроке! Редактирование койнов за тесты или другие события запрещено.",
                    )
                }, status=403)
            if (not is_admin) and tx.given_by and giver and tx.given_by.id != giver.id:
                return JsonResponse({'error': _msg(lang, "Siz faqat o'zingiz bergan coin tranzaksiyalarini tahrirlashingiz mumkin!", "Вы можете редактировать только свои транзакции койнов!")}, status=403)

        new_amount = int(data.get('amount', 0))
        new_reason = (data.get('reason') or '').strip()

        if new_amount == 0:
            return JsonResponse({'error': _msg(lang, "Coin miqdori 0 bo'lishi mumkin emas!", "Количество койнов не может быть 0!")}, status=400)
        if not new_reason:
            return JsonResponse({'error': _msg(lang, 'Sabab yoki izoh kiritilishi shart!', 'Необходимо указать причину или комментарий!')}, status=400)
        if enforce_teacher_rules:
            reason_err = validate_teacher_lesson_activity_reason(new_reason, lang=lang)
            if reason_err:
                return JsonResponse({'error': reason_err}, status=403)

        old_amount = int(tx.amount or 0)
        diff = new_amount - old_amount

        target_class = (tx.student.grade or '').strip() if tx.student else ''
        if enforce_teacher_rules:
            if old_amount < 0:
                if new_amount >= 0 or new_amount < -DAILY_TEACHER_MAX_COINS:
                    return JsonResponse({
                        'error': _msg(
                            lang,
                            f"Coin olish tranzaksiyasini -1 dan -{DAILY_TEACHER_MAX_COINS} gacha tahrirlash mumkin!",
                            f"Транзакцию снятия койнов можно редактировать от -1 до -{DAILY_TEACHER_MAX_COINS}!",
                        )
                    }, status=403)
            else:
                if new_amount <= 0 or new_amount > DAILY_TEACHER_MAX_COINS:
                    return JsonResponse({
                        'error': _msg(
                            lang,
                            f"O'qituvchi beradigan coin miqdori 1 dan {DAILY_TEACHER_MAX_COINS} gacha bo'lishi shart!",
                            f"Количество койнов, начисляемых учителем, должно быть от 1 до {DAILY_TEACHER_MAX_COINS}!",
                        )
                    }, status=403)
                if diff > 0:
                    tx_local_date = timezone.localtime(tx.created_at).date() if tx.created_at else None
                    if tx_local_date != timezone.localdate():
                        return JsonResponse({'error': _msg(lang, "O'tgan kunlardagi coin miqdorini oshirish mumkin emas!", "Нельзя увеличивать количество койнов за прошлые дни!")}, status=403)
                    daily_status = get_teacher_daily_coin_status(giver, enforce_for_portal=True, grade=target_class)
                    if diff > daily_status['coinsRemainingToday']:
                        cls_disp = target_class or _msg(lang, 'Tanlangan', 'Выбранного')
                        return JsonResponse({
                            'error': _msg(
                                lang,
                                f"'{cls_disp}' sinfi uchun kunlik {DAILY_TEACHER_MAX_COINS} coin limitidan oshib ketish mumkin emas!",
                                f"Для класса '{cls_disp}' нельзя превысить дневной лимит в {DAILY_TEACHER_MAX_COINS} койнов!",
                            )
                        }, status=403)
                    st_totals = get_teacher_students_today_coin_totals(
                        giver, [tx.student_id], is_admin_preview=is_admin_preview, exclude_tx_id=tx.id
                    )
                    if st_totals.get(tx.student_id, 0) + new_amount > DAILY_TEACHER_MAX_COINS:
                        return JsonResponse({
                            'error': _msg(
                                lang,
                                f"Limit: Bir o'quvchiga kuniga {DAILY_TEACHER_MAX_COINS} coindan ortiq berib bo'lmaydi!",
                                f"Лимит: одному ученику нельзя начислить более {DAILY_TEACHER_MAX_COINS} койнов в день!",
                            )
                        }, status=403)

        # O'quvchi balansini yangilash
        with transaction.atomic():
            student = CustomUser.objects.select_for_update().get(id=tx.student_id)
            current_coins = int(student.coins or 0)
            if enforce_teacher_rules and diff < 0 and current_coins + diff < 0:
                return JsonResponse({
                    'error': _msg(
                        lang,
                        f"{student.full_name} hisobida yetarli coin yo'q (Mavjud: {current_coins} 💎)!",
                        f"На балансе ученика {student.full_name} недостаточно койнов (Доступно: {current_coins} 💎)!",
                    )
                }, status=400)
            student.coins = max(0, current_coins + diff)
            student.save(update_fields=['coins'])

            tx.amount = new_amount
            tx.reason = new_reason
            tx.save(update_fields=['amount', 'reason'])

        return JsonResponse({
            'success': True,
            'message': _msg(
                lang,
                f"{student.full_name} uchun coin miqdori muvaffaqiyatli tahrirlandi! (Eski: {old_amount:+d}, Yangi: {new_amount:+d}, Balansdagi farq: {diff:+d})",
                f"Количество койнов для {student.full_name} успешно изменено! (Было: {old_amount:+d}, Стало: {new_amount:+d}, Разница: {diff:+d})",
            ),
            'dailyCoinStatus': get_teacher_daily_coin_status(giver, enforce_for_portal=enforce_teacher_rules, grade=target_class),
            'tx': {
                'id': tx.id,
                'studentId': student.id,
                'studentName': student.full_name,
                'amount': tx.amount,
                'reason': tx.reason,
                'studentCoins': student.coins
            }
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_teacher_coin_delete(request, tx_id):
    """O'qituvchilarga berilgan coinlarni o'chirish qat'iyan taqiqlangan!"""
    lang = _req_lang(request)
    return JsonResponse({
        'error': _msg(
            lang,
            "Xavfsizlik qoidasi: O'qituvchilar berilgan coinlarni o'chirish huquqiga ega emas! Siz faqat miqdor yoki sababni tahrirlashingiz (edit) mumkin.",
            "Правило безопасности: учителя не имеют права удалять начисленные койны! Вы можете только отредактировать количество или причину.",
        )
    }, status=403)


# ================= 🔐 ADMIN TEST PERMISSION & SCHEDULE APIS =================

@csrf_exempt
def api_admin_student_tests_settings(request):
    """Admin panel: O'quvchilar bo'limi testlariga global ruxsat, vaqt oralig'i va ommaviy ruxsat boshqaruvi."""
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)

    settings_obj = SiteSetting.get_settings()

    if request.method == 'GET':
        now = timezone.now()
        all_tests = list(Test.objects.all())
        allowed_cnt = sum(1 for t in all_tests if bool(t.is_student_allowed))
        active_now_cnt = sum(
            1 for t in all_tests
            if _evaluate_test_student_access(t, now=now, site_settings=settings_obj, lang=lang)[0]
        )
        return JsonResponse({
            'success': True,
            'policy': serialize_student_tests_policy(site_settings=settings_obj, now=now, lang=lang),
            'stats': {
                'totalTests': len(all_tests),
                'allowedTests': allowed_cnt,
                'activeNowTests': active_now_cnt,
                'lockedTests': max(0, len(all_tests) - active_now_cnt),
            },
        })

    elif request.method in ('POST', 'PUT', 'PATCH'):
        try:
            data = json.loads(request.body.decode('utf-8')) if request.body else {}
        except Exception:
            data = {}

        updated_fields = []
        if 'enabled' in data or 'studentTestsEnabled' in data:
            raw_en = data.get('enabled') if 'enabled' in data else data.get('studentTestsEnabled')
            settings_obj.student_tests_enabled = _parse_bool_flag(raw_en, default=True)
            updated_fields.append('student_tests_enabled')

        if _parse_bool_flag(data.get('clearSchedule'), default=False):
            settings_obj.student_tests_start_time = None
            settings_obj.student_tests_end_time = None
            updated_fields.extend(['student_tests_start_time', 'student_tests_end_time'])
        else:
            if 'startTime' in data or 'start_time' in data or 'studentTestsStartTime' in data:
                raw_st = (
                    data.get('startTime') if 'startTime' in data
                    else (data.get('start_time') if 'start_time' in data else data.get('studentTestsStartTime'))
                )
                settings_obj.student_tests_start_time = parse_iso_datetime(raw_st)
                updated_fields.append('student_tests_start_time')
            if 'endTime' in data or 'end_time' in data or 'studentTestsEndTime' in data:
                raw_et = (
                    data.get('endTime') if 'endTime' in data
                    else (data.get('end_time') if 'end_time' in data else data.get('studentTestsEndTime'))
                )
                settings_obj.student_tests_end_time = parse_iso_datetime(raw_et)
                updated_fields.append('student_tests_end_time')

        if (
            settings_obj.student_tests_start_time
            and settings_obj.student_tests_end_time
            and settings_obj.student_tests_start_time >= settings_obj.student_tests_end_time
        ):
            return JsonResponse({
                'error': _msg(
                    lang,
                    "Umumiy test ruxsati boshlanish vaqti tugash vaqtidan oldin bo'lishi shart!",
                    "Время начала общего разрешения на тесты должно быть раньше времени окончания!",
                )
            }, status=400)

        if updated_fields:
            settings_obj.save(update_fields=list(dict.fromkeys(updated_fields)))

        action = (data.get('action') or '').strip().lower()
        bulk_updated_count = 0
        bulk_msg = ''
        if action in ('allow_all', 'lock_all', 'allow_filtered', 'lock_filtered'):
            allow_flag = action in ('allow_all', 'allow_filtered')
            qs = Test.objects.all()
            if action in ('allow_filtered', 'lock_filtered'):
                test_ids = data.get('testIds')
                if isinstance(test_ids, list) and len(test_ids) > 0:
                    clean_ids = []
                    for tid in test_ids:
                        try:
                            clean_ids.append(int(tid))
                        except (ValueError, TypeError):
                            continue
                    qs = qs.filter(id__in=clean_ids)
                else:
                    subject = (data.get('subject') or '').strip()
                    grade = (data.get('grade') or '').strip()
                    if subject and subject != 'all':
                        qs = qs.filter(subject=subject)
                    target_list = list(qs)
                    if grade and grade != 'all':
                        if grade == '__all_classes__':
                            target_ids = [t.id for t in target_list if parse_test_grades(t.grade)[0]]
                        else:
                            target_ids = [t.id for t in target_list if test_matches_grade(t.grade, grade)]
                        qs = Test.objects.filter(id__in=target_ids)

            bulk_updated_count = qs.update(is_student_allowed=allow_flag)
            bulk_msg = (
                _msg(
                    lang,
                    f"{bulk_updated_count} ta testga o'quvchilar uchun ruxsat berildi!",
                    f"Открыт доступ для учеников к {bulk_updated_count} тестам!",
                )
                if allow_flag
                else _msg(
                    lang,
                    f"{bulk_updated_count} ta test o'quvchilar uchun yopildi!",
                    f"Закрыт доступ для учеников к {bulk_updated_count} тестам!",
                )
            )

        now = timezone.now()
        policy = serialize_student_tests_policy(site_settings=settings_obj, now=now, lang=lang)
        all_tests = list(Test.objects.all())
        allowed_cnt = sum(1 for t in all_tests if bool(t.is_student_allowed))
        active_now_cnt = sum(
            1 for t in all_tests
            if _evaluate_test_student_access(t, now=now, site_settings=settings_obj, lang=lang)[0]
        )
        default_msg = (
            _msg(
                lang,
                "O'quvchilar bo'limi umumiy ruxsati va vaqt sozlamalari saqlandi!",
                "Общее разрешение и расписание раздела учеников сохранены!",
            )
            if policy['portalOpen']
            else (
                policy['message']
                or _msg(lang, "O'quvchilar bo'limi sozlamalari yangilandi!", "Настройки раздела учеников обновлены!")
            )
        )
        return JsonResponse({
            'success': True,
            'message': bulk_msg or default_msg,
            'updatedCount': bulk_updated_count,
            'policy': policy,
            'stats': {
                'totalTests': len(all_tests),
                'allowedTests': allowed_cnt,
                'activeNowTests': active_now_cnt,
                'lockedTests': max(0, len(all_tests) - active_now_cnt),
            },
        })

    return JsonResponse({'error': _msg(lang, "Metod qo'llab-quvvatlanmaydi", "Метод не поддерживается")}, status=405)


@csrf_exempt
def api_admin_test_permission(request, test_id):
    """Admin panel: Bitta test uchun o'quvchilarga ruxsat berish/yopish va ixtiyoriy vaqt oralig'ini saqlash."""
    auth_err = check_admin_permission(request)
    if auth_err:
        return auth_err
    lang = _req_lang(request)

    if request.method not in ('POST', 'PUT', 'PATCH'):
        return JsonResponse({'error': _msg(lang, "Metod qo'llab-quvvatlanmaydi", "Метод не поддерживается")}, status=405)

    test = Test.objects.filter(id=test_id).first()
    if not test:
        return JsonResponse({'error': _msg(lang, 'Test topilmadi!', 'Тест не найден!')}, status=404)

    try:
        data = json.loads(request.body.decode('utf-8')) if request.body else {}
    except Exception:
        data = {}

    if 'isStudentAllowed' in data or 'is_student_allowed' in data or 'allowed' in data:
        raw_val = (
            data.get('isStudentAllowed') if 'isStudentAllowed' in data
            else (data.get('is_student_allowed') if 'is_student_allowed' in data else data.get('allowed'))
        )
        test.is_student_allowed = _parse_bool_flag(raw_val, default=not bool(test.is_student_allowed))
    else:
        test.is_student_allowed = not bool(test.is_student_allowed)

    if _parse_bool_flag(data.get('clearSchedule'), default=False):
        test.start_time = None
        test.end_time = None
    else:
        if 'startTime' in data or 'start_time' in data:
            raw_st = data.get('startTime') if 'startTime' in data else data.get('start_time')
            test.start_time = parse_iso_datetime(raw_st)
        if 'endTime' in data or 'end_time' in data:
            raw_et = data.get('endTime') if 'endTime' in data else data.get('end_time')
            test.end_time = parse_iso_datetime(raw_et)

    if test.start_time and test.end_time and test.start_time >= test.end_time:
        return JsonResponse({
            'error': _msg(
                lang,
                "Testning boshlanish vaqti tugash vaqtidan oldin bo'lishi shart!",
                "Время начала теста должно быть раньше времени окончания!",
            )
        }, status=400)

    test.save()
    now = timezone.now()
    allowed_now, lock_reason, lock_message, access_meta = _evaluate_test_student_access(test, now=now, lang=lang)

    if test.is_student_allowed:
        if allowed_now:
            msg = _msg(
                lang,
                f"\"{test.title}\" testiga o'quvchilar uchun ruxsat berildi!",
                f"Доступ учеников к тесту «{test.title}» открыт!",
            )
        else:
            msg = _msg(
                lang,
                f"\"{test.title}\" ruxsat bayrog'i yoqildi. Eslatma: {lock_message}",
                f"Разрешение для «{test.title}» включено. Примечание: {lock_message}",
            )
    else:
        msg = _msg(
            lang,
            f"\"{test.title}\" testi o'quvchilar uchun yopildi!",
            f"Тест «{test.title}» закрыт для учеников!",
        )

    return JsonResponse({
        'success': True,
        'message': msg,
        'testId': test.id,
        'isStudentAllowed': bool(test.is_student_allowed),
        'isActive': bool(allowed_now),
        'isUpcoming': access_meta['isUpcoming'],
        'isExpired': access_meta['isExpired'],
        'lockReason': lock_reason,
        'lockMessage': lock_message,
        'startTime': _fmt_local_dt(test.start_time),
        'endTime': _fmt_local_dt(test.end_time),
        'startTimeIso': _fmt_local_iso(test.start_time),
        'endTimeIso': _fmt_local_iso(test.end_time),
    })





