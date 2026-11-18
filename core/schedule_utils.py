import csv
import io
import re
from datetime import datetime, time, timedelta

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from django.utils import timezone

from .models import LessonSchedule, SchoolClass, SiteSetting


DAY_LABELS = {
    0: ('Dushanba', 'Понедельник'),
    1: ('Seshanba', 'Вторник'),
    2: ('Chorshanba', 'Среда'),
    3: ('Payshanba', 'Четверг'),
    4: ('Juma', 'Пятница'),
    5: ('Shanba', 'Суббота'),
    6: ('Yakshanba', 'Воскресенье'),
}

DAY_ALIASES = {
    'понедельник': 0, 'пн': 0, 'dushanba': 0, 'душанба': 0, 'monday': 0, 'mon': 0,
    'вторник': 1, 'вт': 1, 'seshanba': 1, 'сешанба': 1, 'tuesday': 1, 'tue': 1,
    'среда': 2, 'ср': 2, 'chorshanba': 2, 'чоршанба': 2, 'wednesday': 2, 'wed': 2,
    'четверг': 3, 'чт': 3, 'payshanba': 3, 'пайшанба': 3, 'thursday': 3, 'thu': 3,
    'пятница': 4, 'пт': 4, 'juma': 4, 'жума': 4, 'friday': 4, 'fri': 4,
    'суббота': 5, 'сб': 5, 'shanba': 5, 'шанба': 5, 'saturday': 5, 'sat': 5,
    'воскресенье': 6, 'вс': 6, 'yakshanba': 6, 'якшанба': 6, 'sunday': 6, 'sun': 6,
}

# Canonical key -> (display UZ, display RU, list of normalized aliases/substrings)
SUBJECT_CANONICAL_RULES = [
    (
        'matematika',
        'Matematika',
        'Математика',
        [
            'математика', 'matematika', 'oliy matematika', 'высшая математика',
            'algebra', 'алгебра', 'geometriya', 'геометрия', 'math', 'mathematics',
        ],
    ),
    (
        'ingliz_tili',
        'Ingliz tili',
        'Английский язык',
        [
            'английский язык', 'английский', 'англ. язык', 'англ язык', 'англ.яз', 'англ яз', 'англ.', 'англ',
            'инглиз тили', 'инглиз', 'ingliz tili', 'ingliz', 'english', 'ielts', 'sat',
        ],
    ),
    (
        'informatika',
        'Informatika',
        'Информатика',
        [
            'информатика', 'informatika', 'axborot texnologiyalari', 'computer science', 'it',
        ],
    ),
    (
        'fizika',
        'Fizika',
        'Физика',
        ['физика', 'fizika', 'physics', 'robototexnika', 'робототехника'],
    ),
    (
        'kimyo',
        'Kimyo',
        'Химия',
        ['химия', 'кимё', 'kimyo', 'chemistry'],
    ),
    (
        'biologiya',
        'Biologiya',
        'Биология',
        ['биология', 'biologiya', 'biology'],
    ),
    (
        'tarix',
        'Tarix',
        'История',
        ['история', 'тарих', 'tarix', 'history'],
    ),
    (
        'rus_tili',
        'Rus tili',
        'Русский язык',
        ['русский язык', 'русский', 'рус тили', 'rus tili', 'russian'],
    ),
    (
        'ona_tili',
        'Ona tili',
        'Узбекский / Родной язык',
        [
            'она тили', 'ona tili', 'узбекский язык', 'узбекский', 'узб тили',
            "o'zbek tili", 'ozbek tili', 'ўзбек тили', 'давлат тили', 'davlat tili', 'uzbek',
        ],
    ),
    (
        'adabiyot',
        'Adabiyot',
        'Литература',
        ['литература', 'адабиёт', 'adabiyot', 'literature'],
    ),
    (
        'geografiya',
        'Geografiya',
        'География',
        ['география', 'geografiya', 'geography'],
    ),
    (
        'huquq',
        'Huquq',
        'Правоведение',
        ['правоведение', 'право', 'ҳуқуқ', 'хукук', 'huquq'],
    ),
    (
        'iqtisod',
        'Iqtisod',
        'Экономика',
        ['экономика', 'иқтисод', 'иктисод', 'iqtisod'],
    ),
    (
        'science',
        'Science',
        'Science',
        ['science', 'табиий фанлар', 'tabiiy fanlar', 'tabiiy fan'],
    ),
    (
        'mental_arifmetika',
        'Mental arifmetika',
        'Ментальная арифметика',
        ['ментальная арифметика', 'ментальная ариф', 'ментал арифметика', 'mental arifmetika', 'mental arif'],
    ),
    (
        'tasviriy_sanat',
        "Tasviriy san'at (IZO)",
        'ИЗО',
        ['изо', "tasviriy san'at", 'tasviriy sanat', 'rasm', 'рисование'],
    ),
    (
        'texnologiya',
        'Texnologiya',
        'Технология',
        ['технология', 'texnologiya', 'mehnat', 'труд'],
    ),
    (
        'musiqa',
        'Musiqa',
        'Музыка',
        ['музыка', 'мусиқа', 'мусика', 'musiqa', 'music'],
    ),
    (
        'jismoniy_tarbiya',
        'Jismoniy tarbiya',
        'Физкультура / Физзарядка',
        ['физзарядка', 'физкультура', 'физическая культура', 'жисмоний тарбия', 'jismoniy tarbiya', 'sport'],
    ),
    (
        'mantiq',
        'Mantiq',
        'Логика',
        ['логика', 'мантиқ', 'мантик', 'mantiq', 'logic'],
    ),
    (
        'tarbiya',
        'Tarbiya',
        'Воспитание',
        ['воспитание', 'тарбия', 'tarbiya'],
    ),
    (
        'oqish_savodxonligi',
        "O'qish savodxonligi",
        'Читательская грамотность',
        ['читательская грамотность', 'чтение', 'букварь', 'письмо', 'обучение грамоте', 'развитие речи'],
    ),
    (
        'atrofimizdagi_olam',
        'Atrofimizdagi olam',
        'Окружающий мир',
        ['окружающий нас мир', 'окружающий мир', 'atrofimizdagi olam'],
    ),
    (
        'konstruktsiyalash',
        'Konstruksiyalash',
        'Конструирование',
        ['конструирование', 'konstruksiyalash'],
    ),
]

CYR_TO_LAT_LETTER = {
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'К': 'K', 'М': 'M', 'О': 'O', 'С': 'C',
    'а': 'A', 'б': 'B', 'в': 'V', 'г': 'G', 'д': 'D', 'е': 'E', 'к': 'K', 'м': 'M', 'о': 'O', 'с': 'C',
}


def _msg(lang, uz_text, ru_text):
    return ru_text if lang == 'ru' else uz_text


def day_label_for_lang(day_idx, lang='uz'):
    uz, ru = DAY_LABELS.get(int(day_idx), (str(day_idx), str(day_idx)))
    return ru if lang == 'ru' else uz


def parse_day_of_week(raw_value):
    if raw_value is None:
        return None
    text = str(raw_value).strip().lower()
    if not text:
        return None
    text = re.sub(r'[\.\,\:\;\-\s]+', ' ', text).strip()
    if text in DAY_ALIASES:
        return DAY_ALIASES[text]
    first_tok = text.split(' ')[0]
    if first_tok in DAY_ALIASES:
        return DAY_ALIASES[first_tok]
    for alias, day_idx in DAY_ALIASES.items():
        if len(alias) >= 4 and alias in text:
            return day_idx
    return None


def parse_time_range(raw_value):
    """
    Parse lesson period string like:
      '1. 09:00–09:45' -> (1, time(9, 0), time(9, 45), None)
      '6. 14:50–14:35' -> (6, time(13, 50), time(14, 35), '14:50–14:35 -> 13:50–14:35')
    Returns tuple (lesson_num, start_time, end_time, auto_fix_note) or None if not a time range.
    """
    if raw_value is None:
        return None
    text = str(raw_value).strip()
    if not text:
        return None

    m = re.search(
        r'(?:(?P<num>\d+)\s*[\.\)\-:]?\s*)?(?P<sh>\d{1,2})[:\.](?P<sm>\d{2})\s*[–—\-]\s*(?P<eh>\d{1,2})[:\.](?P<em>\d{2})',
        text,
    )
    if not m:
        return None

    lesson_num = int(m.group('num')) if m.group('num') else 0
    sh, sm = int(m.group('sh')), int(m.group('sm'))
    eh, em = int(m.group('eh')), int(m.group('em'))
    if not (0 <= sh <= 23 and 0 <= sm <= 59 and 0 <= eh <= 23 and 0 <= em <= 59):
        return None

    start_dt = datetime(2026, 1, 1, sh, sm)
    end_dt = datetime(2026, 1, 1, eh, em)
    fix_note = None

    if start_dt >= end_dt:
        # Common Excel typo: e.g. 14:50–14:35 instead of 13:50–14:35
        candidate = start_dt - timedelta(hours=1)
        diff_mins = int((end_dt - candidate).total_seconds() // 60)
        if 20 <= diff_mins <= 90:
            fix_note = f"{sh:02d}:{sm:02d}–{eh:02d}:{em:02d} -> {candidate.strftime('%H:%M')}–{end_dt.strftime('%H:%M')}"
            start_dt = candidate
        else:
            # Fallback: swap start & end
            fix_note = f"{sh:02d}:{sm:02d}–{eh:02d}:{em:02d} -> {end_dt.strftime('%H:%M')}–{start_dt.strftime('%H:%M')}"
            start_dt, end_dt = end_dt, start_dt

    return (lesson_num, start_dt.time(), end_dt.time(), fix_note)


def _clean_subject_fragment(fragment):
    text = str(fragment or '').strip()
    # Strip parenthetical tags like (РЕП), (РЕП.), (IELTS / SAT), (qo'shimcha)
    no_parens = re.sub(r'\([^)]*\)', ' ', text)
    no_parens = no_parens.replace('’', "'").replace('‘', "'").replace('`', "'").replace('ʼ', "'")
    no_parens = re.sub(r'\s+', ' ', no_parens).strip(' .,-–—')
    return no_parens


def _match_fragment_to_key(fragment):
    clean = _clean_subject_fragment(fragment).lower()
    if not clean:
        return None, ''
    # Exact alias match first
    for key, disp_uz, _disp_ru, aliases in SUBJECT_CANONICAL_RULES:
        for alias in aliases:
            if clean == alias.lower():
                return key, disp_uz
    # Word-boundary / prefix alias match (check longer aliases first so 'ментальная арифметика' beats 'арифметика')
    best = None
    for key, disp_uz, _disp_ru, aliases in SUBJECT_CANONICAL_RULES:
        for alias in aliases:
            al = alias.lower()
            if len(al) <= 2:
                if re.search(rf'(?:^|\W){re.escape(al)}(?:$|\W)', clean):
                    if best is None or len(al) > best[0]:
                        best = (len(al), key, disp_uz)
            else:
                if al in clean:
                    if best is None or len(al) > best[0]:
                        best = (len(al), key, disp_uz)
    if best:
        return best[1], best[2]

    # Fallback normalized key from cleaned text
    fallback_key = re.sub(r'[^a-zа-яёўқғҳ0-9]+', '_', clean).strip('_')
    return fallback_key or None, _clean_subject_fragment(fragment)


def extract_subject_keys(raw_subject):
    """Extract set of canonical subject keys from a lesson cell or teacher's subject field."""
    if not raw_subject:
        return set()
    text = str(raw_subject).strip()
    if not text:
        return set()

    keys = set()
    # Split combined subjects on '/', '&', ',', ' va ', ' и '
    # First remove parenthetical tags so '(IELTS / SAT)' doesn't split into fake subjects
    no_parens = re.sub(r'\([^)]*\)', ' ', text)
    parts = re.split(r'\s*(?:/|&|,|\bva\b|\bи\b)\s*', no_parens, flags=re.IGNORECASE)
    for part in parts:
        key, _ = _match_fragment_to_key(part)
        if key:
            keys.add(key)

    if not keys:
        key, _ = _match_fragment_to_key(text)
        if key:
            keys.add(key)
    return keys


def canonicalize_subject(raw_subject):
    """Return human-readable canonical UZ subject name(s) from a raw Excel cell."""
    if not raw_subject:
        return ''
    text = str(raw_subject).strip()
    no_parens = re.sub(r'\([^)]*\)', ' ', text)
    parts = re.split(r'\s*/\s*', no_parens)
    labels = []
    for part in parts:
        _, label = _match_fragment_to_key(part)
        if label and label not in labels:
            labels.append(label)
    return ' / '.join(labels) if labels else text


def teacher_matches_lesson(teacher, lesson):
    """Check whether a teacher is assigned to (or teaches the subject of) a LessonSchedule entry."""
    if not teacher or not lesson:
        return False
    if lesson.teacher_id:
        return lesson.teacher_id == teacher.id
    teacher_keys = extract_subject_keys(getattr(teacher, 'subject', '') or '')
    if not teacher_keys:
        return False
    lesson_keys = extract_subject_keys(lesson.raw_subject or lesson.subject)
    return bool(teacher_keys & lesson_keys)


def _extract_class_signature(raw_name):
    """Parse grade number (0..12), section letter, and language hint from a class header."""
    text = str(raw_name or '').strip()
    if not text or len(text) > 32:
        return None
    # Never treat academic year strings like '2026-2027' or long titles as a class
    if re.search(r'\b(?:19|20)\d{2}\b', text):
        return None
    low = text.lower()
    if re.search(r'(расписан|учебн|jadval|ish\s+reja|урок|время|dars|vaqt)', low):
        return None

    lang_hint = None
    if re.search(r'(рус|rus|\bru\b)', low):
        lang_hint = 'ru'
    elif re.search(r'(узб|uzb|\buz\b|o\'zb|ozb)', low):
        lang_hint = 'uz'

    m = re.match(
        r'^\s*(\d{1,2})\s*(?:[-–—]?\s*([A-Za-zА-Яа-яЁё])(?=$|\s|\(|[-–—])|\s*(?:класс|sinf)(?=$|\s|\())',
        text,
        flags=re.IGNORECASE,
    )
    if not m:
        return None
    grade_num = int(m.group(1))
    if not (0 <= grade_num <= 12):
        return None
    letter_raw = m.group(2) or ''
    if re.search(r'\d+\s*(класс|sinf)', low):
        letter_raw = ''
    letter = CYR_TO_LAT_LETTER.get(letter_raw, letter_raw.upper()) if letter_raw else ''
    return (grade_num, letter, lang_hint)


def resolve_class_name(raw_header, school_classes=None):
    """
    Match an Excel class column header (e.g. '8-А (узб.)', '1-А', '9-А (рус.)')
    against existing SchoolClass records.
    Returns (resolved_class_name, matched_school_class_or_None).
    """
    raw = str(raw_header or '').strip()
    if not raw:
        return '', None

    classes = list(school_classes) if school_classes is not None else list(SchoolClass.objects.filter(is_active=True))

    # 1. Exact case-insensitive match
    for sc in classes:
        if sc.name.strip().lower() == raw.lower():
            return sc.name, sc

    sig = _extract_class_signature(raw)
    if sig:
        grade_num, letter, lang_hint = sig
        candidates = []
        for sc in classes:
            sc_sig = _extract_class_signature(sc.name)
            sc_grade = sc.grade_level if sc.grade_level is not None else (sc_sig[0] if sc_sig else None)
            sc_letter = sc_sig[1] if sc_sig else ''
            sc_lang = sc.language or (sc_sig[2] if sc_sig else None)
            if sc_grade != grade_num:
                continue
            if letter and sc_letter and letter != sc_letter:
                continue
            if lang_hint and sc_lang and lang_hint != sc_lang:
                continue
            candidates.append(sc)

        if len(candidates) == 1:
            return candidates[0].name, candidates[0]
        if len(candidates) > 1 and lang_hint:
            for c in candidates:
                if c.language == lang_hint:
                    return c.name, c
        if len(candidates) > 1:
            # Prefer Russian if raw header has Cyrillic letter and no explicit uz hint
            has_cyr = bool(re.search(r'[А-Яа-яЁё]', raw))
            if has_cyr and not lang_hint:
                ru_cands = [c for c in candidates if c.language == 'ru']
                if len(ru_cands) == 1:
                    return ru_cands[0].name, ru_cands[0]
            return candidates[0].name, candidates[0]

        # Normalize fallback name cleanly when class isn't in SchoolClass yet
        if letter:
            suffix = '-RUS' if lang_hint == 'ru' else ('-UZ' if lang_hint == 'uz' else '')
            return f"{grade_num}-{letter}{suffix}", None
        return raw, None

    return raw, None


def _normalize_class_compare_key(name):
    sig = _extract_class_signature(name)
    if sig:
        return sig
    return str(name or '').strip().lower()


def class_names_match(lesson_class_name, target_class_name, lesson_school_class_name=None):
    if not target_class_name:
        return False
    t_clean = str(target_class_name).strip().lower()
    for candidate in (lesson_class_name, lesson_school_class_name):
        if candidate and str(candidate).strip().lower() == t_clean:
            return True
    t_sig = _extract_class_signature(target_class_name)
    if not t_sig:
        return False
    for candidate in (lesson_class_name, lesson_school_class_name):
        if not candidate:
            continue
        c_sig = _extract_class_signature(candidate)
        if not c_sig:
            continue
        if c_sig[0] == t_sig[0] and (not c_sig[1] or not t_sig[1] or c_sig[1] == t_sig[1]):
            if c_sig[2] == t_sig[2] or c_sig[2] is None or t_sig[2] is None:
                return True
    return False


def _read_rows_from_uploaded_file(uploaded_file):
    """Read 2D grid of cell strings from .xlsx or .csv UploadedFile (handling merged Excel cells)."""
    filename = (getattr(uploaded_file, 'name', '') or '').lower()
    raw_bytes = uploaded_file.read()

    if filename.endswith('.xlsx') or filename.endswith('.xlsm'):
        wb = openpyxl.load_workbook(io.BytesIO(raw_bytes), data_only=True)
        ws = wb.active
        # Propagate vertical merges (e.g. merged Day column or multi-hour lesson cells),
        # and small 2-column merges, but NEVER propagate wide horizontal title banners (>=3 cols)
        merged_values = {}
        for m_range in ws.merged_cells.ranges:
            col_span = (m_range.max_col - m_range.min_col) + 1
            if col_span >= 3:
                continue
            top_left_val = ws.cell(m_range.min_row, m_range.min_col).value
            for r in range(m_range.min_row, m_range.max_row + 1):
                for c in range(m_range.min_col, m_range.max_col + 1):
                    merged_values[(r, c)] = top_left_val

        rows = []
        max_row = ws.max_row or 0
        max_col = ws.max_column or 0
        for r in range(1, max_row + 1):
            row_vals = []
            for c in range(1, max_col + 1):
                val = ws.cell(r, c).value
                if val is None and (r, c) in merged_values:
                    val = merged_values[(r, c)]
                row_vals.append('' if val is None else str(val).strip())
            rows.append(row_vals)
        return rows

    if filename.endswith('.csv') or filename.endswith('.txt') or not filename.endswith('.xls'):
        decoded = None
        for enc in ('utf-8-sig', 'utf-8', 'cp1251', 'latin-1'):
            try:
                decoded = raw_bytes.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        if decoded is None:
            raise ValueError("Fayl kodirovkasini o'qib bo'lmadi (UTF-8 yoki Excel .xlsx yuklang)!")
        # Detect delimiter (comma or semicolon)
        sample = decoded[:2048]
        delimiter = ';' if sample.count(';') > sample.count(',') else ','
        reader = csv.reader(io.StringIO(decoded), delimiter=delimiter)
        return [[cell.strip() for cell in row] for row in reader]

    raise ValueError("Faqat .xlsx (Excel) yoki .csv fayllari qo'llab-quvvatlanadi!")


def parse_schedule_file(uploaded_file, school_classes=None):
    """
    Parse school timetable Excel/CSV file.
    Supports both:
      1) Matrix timetable (Day | Lesson/Time | Class 1 | Class 2 | ...)
      2) Flat list table (Day | Start/Time | Class | Subject)
    Returns dict with keys: title, entries, classes, autoFixedTimes, warnings.
    """
    rows = _read_rows_from_uploaded_file(uploaded_file)
    if not rows:
        raise ValueError("Yuklangan fayl bo'sh!")

    classes_list = list(school_classes) if school_classes is not None else list(SchoolClass.objects.filter(is_active=True))

    # Extract title from top rows (before header)
    title = ''
    header_row_idx = None
    time_col_idx = None
    day_col_idx = 0

    for idx, row in enumerate(rows[:15]):
        non_empty = [(ci, cell) for ci, cell in enumerate(row) if cell]
        if not non_empty:
            continue
        if len(non_empty) == 1 and not title:
            title = non_empty[0][1]
            continue

        # Check if this is the matrix header row (contains 'урок'/'время'/'dars'/'vaqt' or >=3 distinct class-like headers)
        found_time_hdr = None
        distinct_class_headers = set()
        for ci, cell in enumerate(row):
            low = cell.lower()
            if re.search(r'(урок|время|dars|vaqt|soat|time)', low) and found_time_hdr is None:
                found_time_hdr = ci
            elif _extract_class_signature(cell) is not None:
                distinct_class_headers.add(cell.strip().lower())

        if (found_time_hdr is not None and len(distinct_class_headers) >= 1) or len(distinct_class_headers) >= 3:
            header_row_idx = idx
            time_col_idx = found_time_hdr if found_time_hdr is not None else 1
            day_col_idx = 0 if time_col_idx > 0 else 0
            break

    entries = []
    auto_fixed_times = []
    warnings = []
    seen_classes = []

    if header_row_idx is not None:
        header_row = rows[header_row_idx]
        class_columns = []
        for ci in range(time_col_idx + 1, len(header_row)):
            raw_cls = header_row[ci].strip()
            if not raw_cls:
                continue
            resolved_name, sc_obj = resolve_class_name(raw_cls, classes_list)
            class_columns.append((ci, raw_cls, resolved_name, sc_obj))
            if resolved_name not in [c['className'] for c in seen_classes]:
                seen_classes.append({
                    'className': resolved_name,
                    'rawClassName': raw_cls,
                    'matched': sc_obj is not None,
                })

        if not class_columns:
            raise ValueError("Jadval sarlavhasida sinf ustunlari topilmadi!")

        current_day = None
        lesson_seq = 0
        for r_idx in range(header_row_idx + 1, len(rows)):
            row = rows[r_idx]
            if not any(cell for cell in row):
                continue

            # Check day cell (usually col 0, or any col before time_col_idx)
            day_val = None
            for dc in range(0, max(1, time_col_idx)):
                if dc < len(row) and row[dc]:
                    day_val = parse_day_of_week(row[dc])
                    if day_val is not None:
                        break
            if day_val is not None:
                if day_val != current_day:
                    lesson_seq = 0
                current_day = day_val

            if current_day is None:
                continue

            time_cell = row[time_col_idx] if time_col_idx < len(row) else ''
            parsed_time = parse_time_range(time_cell)
            if not parsed_time:
                continue

            lesson_num, start_t, end_t, fix_note = parsed_time
            lesson_seq += 1
            if not lesson_num:
                lesson_num = lesson_seq

            if fix_note and fix_note not in auto_fixed_times:
                auto_fixed_times.append(fix_note)

            for ci, raw_cls, resolved_name, sc_obj in class_columns:
                if ci >= len(row):
                    continue
                raw_subj = row[ci].strip()
                if not raw_subj or raw_subj in ('-', '—', '–'):
                    continue
                canon_subj = canonicalize_subject(raw_subj)
                entries.append({
                    'day_of_week': current_day,
                    'lesson_number': lesson_num,
                    'start_time': start_t,
                    'end_time': end_t,
                    'school_class': sc_obj,
                    'class_name': resolved_name,
                    'raw_class_name': raw_cls,
                    'subject': canon_subj,
                    'raw_subject': raw_subj,
                    'academic_year': title,
                })
    else:
        # Fallback: Flat table format (columns: Kun | Vaqt | Sinf | Fan)
        for row in rows:
            if len(row) < 4:
                continue
            d_idx = parse_day_of_week(row[0])
            parsed_time = parse_time_range(row[1])
            if d_idx is None or not parsed_time:
                continue
            lesson_num, start_t, end_t, fix_note = parsed_time
            if fix_note and fix_note not in auto_fixed_times:
                auto_fixed_times.append(fix_note)
            raw_cls = row[2].strip()
            raw_subj = row[3].strip()
            if not raw_cls or not raw_subj:
                continue
            resolved_name, sc_obj = resolve_class_name(raw_cls, classes_list)
            if resolved_name not in [c['className'] for c in seen_classes]:
                seen_classes.append({
                    'className': resolved_name,
                    'rawClassName': raw_cls,
                    'matched': sc_obj is not None,
                })
            entries.append({
                'day_of_week': d_idx,
                'lesson_number': lesson_num or 1,
                'start_time': start_t,
                'end_time': end_t,
                'school_class': sc_obj,
                'class_name': resolved_name,
                'raw_class_name': raw_cls,
                'subject': canonicalize_subject(raw_subj),
                'raw_subject': raw_subj,
                'academic_year': title,
            })

    if not entries:
        raise ValueError(
            "Jadval ichidan birorta ham dars topilmadi! Excel faylda hafta kuni (Dushanba/Понедельник), "
            "dars vaqti (masalan: 1. 09:00–09:45) va sinf ustunlari mavjudligini tekshiring."
        )

    unmatched = [c['rawClassName'] for c in seen_classes if not c['matched']]
    if unmatched:
        warnings.append(f"Bazadagi sinflarga to'g'ridan-to'g'ri ulanmagan ustunlar: {', '.join(unmatched)}")

    return {
        'title': title,
        'entries': entries,
        'classes': seen_classes,
        'autoFixedTimes': auto_fixed_times,
        'warnings': warnings,
    }


def serialize_lesson_slot(slot, lang='uz'):
    return {
        'id': slot.id,
        'dayOfWeek': slot.day_of_week,
        'dayLabel': day_label_for_lang(slot.day_of_week, lang=lang),
        'lessonNumber': slot.lesson_number,
        'startTime': slot.start_time.strftime('%H:%M'),
        'endTime': slot.end_time.strftime('%H:%M'),
        'timeRange': f"{slot.start_time.strftime('%H:%M')}–{slot.end_time.strftime('%H:%M')}",
        'className': slot.school_class.name if slot.school_class else slot.class_name,
        'rawClassName': slot.raw_class_name or slot.class_name,
        'schoolClassId': slot.school_class_id,
        'subject': slot.subject,
        'rawSubject': slot.raw_subject or slot.subject,
        'teacherId': slot.teacher_id,
        'teacherName': slot.teacher.full_name if slot.teacher else '',
    }


def evaluate_teacher_lesson_schedule_access(teacher, target_class=None, now=None, lang='uz'):
    """
    Evaluate whether `teacher` is currently allowed to award/deduct/edit coins
    according to the uploaded weekly LessonSchedule.
    - If no schedule exists in DB or SiteSetting.lesson_schedule_enforced is False -> unrestricted (`enforced: False, allowed: True`).
    - Otherwise, teacher is ONLY allowed during their scheduled lesson time AND for the class(es)
      scheduled for their subject at the current weekday & time.
    """
    site_settings = SiteSetting.get_settings()
    local_now = timezone.localtime(now or timezone.now())
    cur_weekday = local_now.weekday()
    cur_time = local_now.time()
    cur_time_str = local_now.strftime('%H:%M')
    cur_day_label = day_label_for_lang(cur_weekday, lang=lang)

    has_schedule = LessonSchedule.objects.exists()
    enforced = bool(site_settings.lesson_schedule_enforced) and has_schedule

    if not enforced:
        return {
            'hasSchedule': has_schedule,
            'enforced': False,
            'allowed': True,
            'currentDay': cur_weekday,
            'currentDayLabel': cur_day_label,
            'currentTime': cur_time_str,
            'teacherSubject': getattr(teacher, 'subject', '') or '',
            'activeClasses': [],
            'activeLessons': [],
            'todayLessons': [],
            'nextLesson': None,
            'message': '',
        }

    all_slots = list(LessonSchedule.objects.select_related('school_class', 'teacher').all())
    teacher_slots = [slot for slot in all_slots if teacher_matches_lesson(teacher, slot)]

    active_slots = [
        slot for slot in teacher_slots
        if slot.day_of_week == cur_weekday and slot.start_time <= cur_time <= slot.end_time
    ]
    today_slots = [
        slot for slot in teacher_slots
        if slot.day_of_week == cur_weekday
    ]
    today_slots.sort(key=lambda s: (s.start_time, s.lesson_number, s.class_name))

    # Find next upcoming lesson for this teacher
    next_slot = None
    later_today = [s for s in today_slots if s.start_time > cur_time]
    if later_today:
        next_slot = later_today[0]
    else:
        for offset in range(1, 8):
            next_day = (cur_weekday + offset) % 7
            day_slots = [s for s in teacher_slots if s.day_of_week == next_day]
            if day_slots:
                day_slots.sort(key=lambda s: (s.start_time, s.lesson_number))
                next_slot = day_slots[0]
                break

    active_classes = []
    for s in active_slots:
        cname = s.school_class.name if s.school_class else s.class_name
        if cname not in active_classes:
            active_classes.append(cname)

    subj_display = (getattr(teacher, 'subject', '') or '').strip() or _msg(lang, 'faningiz', 'вашего предмета')

    if target_class:
        allowed = any(
            class_names_match(s.class_name, target_class, s.school_class.name if s.school_class else None)
            for s in active_slots
        )
    else:
        allowed = len(active_slots) > 0

    message = ''
    if not allowed:
        if not teacher_slots:
            message = _msg(
                lang,
                f"Dars jadvali cheklovi: Yuklangan ish rejasida sizning faningiz ({subj_display}) bo'yicha darslar topilmadi!",
                f"Ограничение расписания: в загруженном расписании не найдены уроки по вашему предмету ({subj_display})!",
            )
        elif target_class and active_classes:
            active_str = ', '.join(active_classes)
            slot_time = f"{active_slots[0].start_time.strftime('%H:%M')}–{active_slots[0].end_time.strftime('%H:%M')}"
            message = _msg(
                lang,
                f"Dars jadvali cheklovi: Hozir ({cur_time_str}) '{target_class}' sinfida sizning ({subj_display}) darsingiz emas! "
                f"Hozirgi ({slot_time}) darsingiz sinflari: {active_str}.",
                f"Ограничение расписания: сейчас ({cur_time_str}) в классе '{target_class}' нет вашего урока ({subj_display})! "
                f"Сейчас ({slot_time}) ваш урок идёт в классах: {active_str}.",
            )
        else:
            next_hint_uz = ''
            next_hint_ru = ''
            if next_slot:
                n_day_uz = day_label_for_lang(next_slot.day_of_week, 'uz')
                n_day_ru = day_label_for_lang(next_slot.day_of_week, 'ru')
                n_time = f"{next_slot.start_time.strftime('%H:%M')}–{next_slot.end_time.strftime('%H:%M')}"
                n_cls_list = sorted({
                    (s.school_class.name if s.school_class else s.class_name)
                    for s in teacher_slots
                    if s.day_of_week == next_slot.day_of_week and s.start_time == next_slot.start_time
                })
                n_cls_str = ', '.join(n_cls_list)
                next_hint_uz = f" Keyingi darsingiz: {n_day_uz} {n_time} ({n_cls_str})."
                next_hint_ru = f" Следующий урок: {n_day_ru} {n_time} ({n_cls_str})."
            message = _msg(
                lang,
                f"Dars jadvali cheklovi: Hozir ({cur_day_label}, {cur_time_str}) sizning ({subj_display}) darsingiz vaqti emas! "
                f"Coin berish va olib tashlash faqat o'z darsingiz vaqtida ochiladi.{next_hint_uz}",
                f"Ограничение расписания: сейчас ({cur_day_label}, {cur_time_str}) не время вашего урока ({subj_display})! "
                f"Начислять и снимать койны можно только во время своего урока.{next_hint_ru}",
            )
    else:
        if active_slots:
            slot_time = f"{active_slots[0].start_time.strftime('%H:%M')}–{active_slots[0].end_time.strftime('%H:%M')}"
            active_str = ', '.join(active_classes)
            message = _msg(
                lang,
                f"Hozir sizning ({subj_display}) darsingiz faol ({slot_time}): {active_str}",
                f"Сейчас идёт ваш урок ({subj_display}, {slot_time}): {active_str}",
            )

    # Group today's lessons by time slot for cleaner UI display
    grouped_today = []
    seen_time_groups = {}
    for s in today_slots:
        t_key = (s.start_time, s.end_time, s.lesson_number)
        cname = s.school_class.name if s.school_class else s.class_name
        is_live = s.start_time <= cur_time <= s.end_time
        if t_key not in seen_time_groups:
            item = {
                'lessonNumber': s.lesson_number,
                'startTime': s.start_time.strftime('%H:%M'),
                'endTime': s.end_time.strftime('%H:%M'),
                'timeRange': f"{s.start_time.strftime('%H:%M')}–{s.end_time.strftime('%H:%M')}",
                'subject': s.subject,
                'rawSubject': s.raw_subject or s.subject,
                'classes': [cname],
                'isLive': is_live,
            }
            seen_time_groups[t_key] = item
            grouped_today.append(item)
        else:
            if cname not in seen_time_groups[t_key]['classes']:
                seen_time_groups[t_key]['classes'].append(cname)

    return {
        'hasSchedule': True,
        'enforced': True,
        'allowed': allowed,
        'currentDay': cur_weekday,
        'currentDayLabel': cur_day_label,
        'currentTime': cur_time_str,
        'teacherSubject': getattr(teacher, 'subject', '') or '',
        'activeClasses': active_classes,
        'activeLessons': [serialize_lesson_slot(s, lang=lang) for s in active_slots],
        'todayLessons': grouped_today,
        'nextLesson': serialize_lesson_slot(next_slot, lang=lang) if next_slot else None,
        'message': message,
    }


def build_schedule_template_workbook():
    """Generate a downloadable .xlsx timetable template populated with current active SchoolClasses."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Dars Jadvali'

    classes = list(SchoolClass.objects.filter(is_active=True).order_by('grade_level', 'language', 'name'))
    class_headers = [c.name for c in classes] or ['5-A-UZ', '6-A-RUS', '8-A-UZ', '9-A-UZ', '9-A-RUS']

    # Row 1: Title
    ws.cell(1, 2, 'Diamond School — Haftalik Dars Jadvali (Ish Reja)').font = Font(bold=True, size=13, color='0F172A')

    # Row 3: Header
    headers = ['Kun', 'Урок / время'] + class_headers
    header_fill = PatternFill(start_color='0284C7', end_color='0284C7', fill_type='solid')
    header_font = Font(bold=True, color='FFFFFF')
    for ci, h in enumerate(headers, 1):
        cell = ws.cell(3, ci, h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center', vertical='center')

    sample_periods = [
        '1. 09:00–09:45',
        '2. 10:05–10:50',
        '3. 10:55–11:40',
        '4. 11:45–12:30',
        '5. 13:00–13:45',
        '6. 13:50–14:35',
    ]
    sample_subjects = ['Matematika', 'Ingliz tili', 'Informatika', 'Fizika', 'Kimyo', 'Tarix']
    days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница']

    row_cursor = 4
    day_fill = PatternFill(start_color='E0F2FE', end_color='E0F2FE', fill_type='solid')
    for d_idx, day_name in enumerate(days):
        for p_idx, period_str in enumerate(sample_periods):
            if p_idx == 0:
                c_day = ws.cell(row_cursor, 1, day_name)
                c_day.font = Font(bold=True)
                c_day.fill = day_fill
            ws.cell(row_cursor, 2, period_str)
            for c_idx in range(len(class_headers)):
                subj = sample_subjects[(d_idx + p_idx + c_idx) % len(sample_subjects)]
                ws.cell(row_cursor, 3 + c_idx, subj)
            row_cursor += 1
        row_cursor += 1  # blank separator row between days

    ws.column_dimensions['A'].width = 16
    ws.column_dimensions['B'].width = 18
    for ci in range(3, len(headers) + 1):
        col_letter = openpyxl.utils.get_column_letter(ci)
        ws.column_dimensions[col_letter].width = 18

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf
