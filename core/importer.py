import re
import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

def process_math_node(node):
    """Word OMML formula teglarini (m:oMath, m:f, m:rad, etc.) LaTeX ko'rinishiga o'giradi"""
    sub = []
    for n in node.iterchildren():
        ntag = n.tag.split('}')[-1]
        if ntag == 'f':
            num_el = n.find('{http://schemas.openxmlformats.org/officeDocument/2006/math}num')
            den_el = n.find('{http://schemas.openxmlformats.org/officeDocument/2006/math}den')
            num_t = process_math_node(num_el) if num_el is not None else ''
            den_t = process_math_node(den_el) if den_el is not None else ''
            sub.append(f"\\frac{{{num_t.strip()}}}{{{den_t.strip()}}}")
        elif ntag == 'rad':
            deg_el = n.find('{http://schemas.openxmlformats.org/officeDocument/2006/math}deg')
            e_el = n.find('{http://schemas.openxmlformats.org/officeDocument/2006/math}e')
            e_t = process_math_node(e_el) if e_el is not None else ''
            deg_t = process_math_node(deg_el) if deg_el is not None else ''
            if deg_t.strip():
                sub.append(f"\\sqrt[{deg_t.strip()}]{{{e_t.strip()}}}")
            else:
                sub.append(f"\\sqrt{{{e_t.strip()}}}")
        elif ntag == 'sSup':
            e_el = n.find('{http://schemas.openxmlformats.org/officeDocument/2006/math}e')
            sup_el = n.find('{http://schemas.openxmlformats.org/officeDocument/2006/math}sup')
            e_t = process_math_node(e_el) if e_el is not None else ''
            sup_t = process_math_node(sup_el) if sup_el is not None else ''
            sub.append(f"{e_t}^{{{sup_t}}}")
        elif ntag == 'sSub':
            e_el = n.find('{http://schemas.openxmlformats.org/officeDocument/2006/math}e')
            sub_el = n.find('{http://schemas.openxmlformats.org/officeDocument/2006/math}sub')
            e_t = process_math_node(e_el) if e_el is not None else ''
            sub_t = process_math_node(sub_el) if sub_el is not None else ''
            sub.append(f"{e_t}_{{{sub_t}}}")
        elif ntag == 'r':
            t = n.find('{http://schemas.openxmlformats.org/officeDocument/2006/math}t')
            if t is not None and t.text:
                sub.append(t.text)
            else:
                sub.append(''.join(n.itertext()))
        else:
            sub.append(process_math_node(n))
    return ''.join(sub)


def extract_docx_paragraph_text(p):
    """Word paragrafidan oddiy matn va barcha formulalarni (OMML) to'liq chiqarib oladi"""
    parts = []
    for child in p._element.iterchildren():
        tag = child.tag.split('}')[-1]
        if tag == 'r':
            t = child.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t')
            if t is not None and t.text:
                parts.append(t.text)
            else:
                parts.append(''.join(child.itertext()))
        elif tag in ['oMath', 'oMathPara']:
            parts.append(process_math_node(child))
        elif tag == 'hyperlink':
            for sub_child in child.iterchildren():
                if sub_child.tag.endswith('r'):
                    t = sub_child.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t')
                    if t is not None and t.text:
                        parts.append(t.text)
        else:
            math_elems = child.findall('.//{http://schemas.openxmlformats.org/officeDocument/2006/math}oMath')
            if math_elems:
                for me in math_elems:
                    parts.append(process_math_node(me))
            else:
                parts.append(''.join(child.itertext()))
    return ''.join(parts).strip()


def extract_docx_cell_text(cell):
    """Word jadval katakchasidan matn va formulalarni to'liq chiqarib oladi"""
    p_texts = [extract_docx_paragraph_text(p) for p in cell.paragraphs]
    return ' '.join(t for t in p_texts if t).strip()


def normalize_math_text(text):
    """Matndagi ildiz (sqrt, √) va kasrlarni standart formatga keltiradi"""
    if not text:
        return ""
    text = str(text).strip()
    # sqrt(x) -> \sqrt{x}
    text = re.sub(r'\\?sqrt\s*\(([^)]+)\)', r'\\sqrt{\1}', text)
    # Unicode √
    text = re.sub(r'√\s*\(([^)]+)\)', r'\\sqrt{\1}', text)
    text = re.sub(r'√\s*([0-9a-zA-Z]+)', r'\\sqrt{\1}', text)
    # Oddiy kasrlarni \frac formatiga o'tkazish (masalan: 5/3 -> \frac{5}{3})
    text = re.sub(r'(^|[\s+\-*=:(])(\d+)\/(\d+)(?=[\s+\-*=:,)]|$)', r'\1\\frac{\2}{\3}', text)
    return text


def parse_questions_from_file(file_obj, filename=''):
    """
    Excel (.xlsx, .xls) yoki Word (.docx) fayllaridan savollarni avtomatik ajratib oladi.
    Format:
    [
        {
            'question': 'Savol matni',
            'options': ['Variant A', 'Variant B', 'Variant C', 'Variant D'],
            'correctIndex': 0, # 0=A, 1=B, 2=C, 3=D
            'imageUrl': ''
        }, ...
    ]
    """
    fn = filename.lower()
    if fn.endswith('.xlsx') or fn.endswith('.xls'):
        return parse_excel_questions(file_obj)
    elif fn.endswith('.docx') or fn.endswith('.doc'):
        return parse_word_questions(file_obj)
    else:
        # Fayl kengaytmasi bo'yicha aniqlanmasa ikkala usulni sinab ko'rish
        try:
            return parse_excel_questions(file_obj)
        except Exception:
            try:
                file_obj.seek(0)
                return parse_word_questions(file_obj)
            except Exception:
                raise ValueError("Fayl formati qo'llab-quvvatlanmaydi! Faqat .xlsx (Excel) yoki .docx (Word) fayllarni yuklang.")


def parse_excel_questions(file_obj):
    """Excel (.xlsx) faylidan savollarni o'qish (6 yoki 7 ustunli format)"""
    try:
        wb = openpyxl.load_workbook(file_obj, data_only=True)
    except Exception as e:
        raise ValueError(f"Excel faylini ochishda xatolik: {e}")

    ws = wb.active
    for sname in wb.sheetnames:
        low = sname.lower()
        if 'savol' in low or 'test' in low or 'вопрос' in low:
            ws = wb[sname]
            break

    questions = []
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return questions

    start_idx = 0
    q_col = 0
    opt_start = 1
    ans_col = 5

    # Birinchi qator sarlavha (header) ekanligini tekshirish
    first_row = [str(c).strip().lower() if c is not None else '' for c in rows[0]]
    first_row_str = ' '.join(first_row)
    if any(k in first_row_str for k in ['savol', 'question', 'вопрос', 'variant', 'javob', 'otvet', 'ans', '№', 't/r']):
        start_idx = 1
        if first_row and any(first_row[0].startswith(p) for p in ['№', 't/r', 'no', 'num', 'id', 'raqam']):
            q_col = 1
            opt_start = 2
            ans_col = 6
        elif len(first_row) >= 2 and any(k in first_row[1] for k in ['savol', 'question', 'вопрос']):
            q_col = 1
            opt_start = 2
            ans_col = 6

    for row_idx, r in enumerate(rows[start_idx:], start=start_idx + 1):
        if not r or len(r) <= opt_start:
            continue

        q_val = r[q_col] if q_col < len(r) else None
        if q_val is None or str(q_val).strip() == '':
            continue

        q_text = str(q_val).strip()
        q_text = re.sub(r'^\d+[\.\)]\s*', '', q_text)
        q_text = normalize_math_text(q_text)

        opts = [str(r[i]).strip() if (i < len(r) and r[i] is not None) else '' for i in range(opt_start, opt_start + 4)]

        # To'g'ri javobni aniqlash
        correct_idx = 0
        if ans_col < len(r) and r[ans_col] is not None:
            ans_str = str(r[ans_col]).strip().upper()
            ans_map = {
                'A': 0, 'А': 0, '1': 0, 'A)': 0, 'А)': 0, 'A.': 0, 'А.': 0,
                'B': 1, 'В': 1, '2': 1, 'B)': 1, 'В)': 1, 'B.': 1, 'В.': 1,
                'C': 2, 'С': 2, '3': 2, 'C)': 2, 'С)': 2, 'C.': 2, 'С.': 2,
                'D': 3, 'Д': 3, '4': 3, 'D)': 3, 'Д)': 3, 'D.': 3, 'Д.': 3,
            }
            if ans_str in ans_map:
                correct_idx = ans_map[ans_str]
            else:
                for idx, opt in enumerate(opts):
                    if opt and (opt.upper() == ans_str or ans_str in opt.upper()):
                        correct_idx = idx
                        break

        # Har bir variant oldidagi A) B) larni tozalash va formulalarni normallashtirish
        cleaned_opts = []
        for opt in opts:
            cleaned = re.sub(r'^[*+]?\s*[A-Fa-fА-Да-д0-9][\.\)]\s*', '', opt)
            cleaned = normalize_math_text(cleaned)
            cleaned_opts.append(cleaned)

        if q_text and any(cleaned_opts):
            while len(cleaned_opts) < 4:
                cleaned_opts.append('')
            questions.append({
                'question': q_text,
                'options': cleaned_opts[:4],
                'correctIndex': correct_idx,
                'imageUrl': ''
            })

    return questions


def parse_word_questions(file_obj):
    """Word (.docx) faylidan savollarni o'qish (Jadvallar, Matnli paragraflar va Formulalar)"""
    try:
        doc = Document(file_obj)
    except Exception as e:
        raise ValueError(f"Word (.docx) faylini ochishda xatolik: {e}")

    questions = []
    seen_questions = set()

    # 1. Jadvallarni tekshirish (agar jadval ko'rinishida tuzilgan bo'lsa)
    if doc.tables:
        for table in doc.tables:
            rows = table.rows
            if not rows:
                continue

            start_r = 0
            first_cells_raw = [extract_docx_cell_text(c).lower() for c in rows[0].cells]
            hdr = ' '.join(first_cells_raw)
            if any(k in hdr for k in ['savol', 'вопрос', 'variant', 'javob', 'question', '№']):
                start_r = 1

            first_cells = first_cells_raw
            q_col = 0
            opt_start = 1
            ans_col = 5
            if len(first_cells) >= 7 and any(first_cells[0].startswith(p) for p in ['№', 't/r', 'no']):
                q_col = 1
                opt_start = 2
                ans_col = 6

            for row in rows[start_r:]:
                cells = [extract_docx_cell_text(c) for c in row.cells]
                if len(cells) > opt_start and cells[q_col]:
                    q_text = re.sub(r'^\d+[\.\)]\s*', '', cells[q_col])
                    q_text = normalize_math_text(q_text)
                    if not q_text or q_text.lower() in seen_questions:
                        continue

                    opts = [normalize_math_text(re.sub(r'^[A-Da-d][\.\)]\s*', '', cells[i])) if i < len(cells) else '' for i in range(opt_start, opt_start + 4)]
                    correct_idx = 0
                    if ans_col < len(cells) and cells[ans_col]:
                        ans = cells[ans_col].upper()
                        if 'A' in ans or '1' in ans: correct_idx = 0
                        elif 'B' in ans or '2' in ans: correct_idx = 1
                        elif 'C' in ans or '3' in ans: correct_idx = 2
                        elif 'D' in ans or '4' in ans: correct_idx = 3

                    while len(opts) < 4:
                        opts.append('')

                    seen_questions.add(q_text.lower())
                    questions.append({
                        'question': q_text,
                        'options': opts[:4],
                        'correctIndex': correct_idx,
                        'imageUrl': ''
                    })

    # 2. Oddiy matnli paragraflar orqali o'qish (Formulalarni ham to'liq qo'llab-quvvatlaydi)
    paras = [normalize_math_text(extract_docx_paragraph_text(p)) for p in doc.paragraphs if extract_docx_paragraph_text(p)]
    current_q = None

    q_start_pattern = re.compile(r'^(?:#?\s*)?(\d+)[\.\)]\s*(.+)$')
    opt_pattern = re.compile(r'^([*+]?)\s*([A-Fa-fА-Да-д0-9])[\.\)]\s*(.+)$')
    ans_pattern = re.compile(r'^(?:javob|ответ|to[\'\`\’]g[\'\`\’]ri javob|correct answer|ans)\s*[:=\-]?\s*([*+]?[A-Fa-fА-Да-д0-9])', re.IGNORECASE)

    for line in paras:
        q_match = q_start_pattern.match(line)
        if q_match:
            if current_q and current_q.get('question') and any(current_q.get('options', [])):
                while len(current_q['options']) < 4:
                    current_q['options'].append('')
                if current_q['question'].lower() not in seen_questions:
                    seen_questions.add(current_q['question'].lower())
                    questions.append(current_q)

            current_q = {
                'question': q_match.group(2).strip(),
                'options': [],
                'correctIndex': 0,
                'imageUrl': ''
            }
            continue

        opt_match = opt_pattern.match(line)
        if opt_match and current_q:
            is_marker = bool(opt_match.group(1))
            opt_letter = opt_match.group(2).upper()
            opt_text = opt_match.group(3).strip()

            if is_marker:
                current_q['correctIndex'] = len(current_q['options'])

            current_q['options'].append(opt_text)
            continue

        ans_match = ans_pattern.match(line)
        if ans_match and current_q:
            letter = ans_match.group(1).lstrip('*+').upper()
            letter_map = {
                'A': 0, 'А': 0, '1': 0,
                'B': 1, 'В': 1, '2': 1,
                'C': 2, 'С': 2, '3': 2,
                'D': 3, 'Д': 3, '4': 3,
                'E': 4, 'Е': 4, '5': 4,
                'F': 5, '6': 5,
            }
            if letter in letter_map:
                current_q['correctIndex'] = letter_map[letter]
            continue

        if current_q and not current_q['options']:
            current_q['question'] += ' ' + line

    if current_q and current_q.get('question') and any(current_q.get('options', [])):
        while len(current_q['options']) < 4:
            current_q['options'].append('')
        if current_q['question'].lower() not in seen_questions:
            questions.append(current_q)

    return questions


def generate_sample_excel():
    """O'qituvchilar yuklab olishi uchun to'liq va bezatilgan namuna Excel fayli yaratish"""
    wb = openpyxl.Workbook()

    # 1-VARAQ: Savollar Ro'yxati
    ws = wb.active
    ws.title = "Savollar Ro'yxati"

    header_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")

    row_zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    row_white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    headers = [
        "№",
        "Savol matni (Savol mazmuni)",
        "Variant A",
        "Variant B",
        "Variant C",
        "Variant D",
        "To'g'ri javob (A, B, C yoki D)"
    ]
    ws.append(headers)

    sample_questions = [
        (1, "O'zbekiston Respublikasi poytaxti qaysi shahar?", "Samarqand", "Buxoro", "Toshkent", "Xiva", "C"),
        (2, "Hisoblang: 5/3 + 4/3 yig'indisi nechaga teng?", "3", "9/6", "1", "7/3", "A"),
        (3, "Ildiz osti ifodani hisoblang: \\sqrt{64} - \\sqrt{25}", "3", "4", "5", "8", "A"),
        (4, "Kompyuterning asosiy tezkor xotirasi qanday ataladi?", "RAM", "HDD", "Monitor", "Videokarta", "A"),
        (5, "O'zbekiston Respublikasi Davlat mustaqilligi qachon e'lon qilingan?", "1990-yil 1-sentyabr", "1991-yil 31-avgust", "1992-yil 8-dekabr", "1993-yil 1-oktyabr", "B"),
        (6, "Suvning kimyoviy formulasi qaysi?", "CO2", "H2O", "NaCl", "O2", "B"),
        (7, "Quyosh sistemasidagi eng katta sayyora qaysi?", "Mars", "Yupiter", "Venera", "Saturn", "B"),
        (8, "Kasrni hisoblang: \\frac{7}{2} - \\frac{1}{2}", "2", "3", "4", "5/2", "B"),
        (9, "Yorug'lik tezligi vakuumda taxminan qanchaga teng?", "300 000 km/s", "150 000 km/s", "30 000 km/s", "1 000 000 km/s", "A"),
        (10, "Choose the correct past tense: 'She ____ to school yesterday.'", "go", "went", "gone", "goes", "B")
    ]

    for item in sample_questions:
        ws.append(list(item))

    # Formatlash (Formatting)
    ws.row_dimensions[1].height = 28
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    for row_idx in range(2, len(sample_questions) + 2):
        ws.row_dimensions[row_idx].height = 22
        current_fill = row_white_fill if row_idx % 2 == 0 else row_zebra_fill
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.fill = current_fill
            cell.border = thin_border
            cell.font = Font(name="Segoe UI", size=10)
            if col_idx in [1, 7]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    col_widths = [6, 52, 22, 22, 22, 22, 28]
    for i, w in enumerate(col_widths, 1):
        col_letter = get_column_letter(i)
        ws.column_dimensions[col_letter].width = w

    # 2-VARAQ: Qo'llanma
    ws_guide = wb.create_sheet(title="Qo'llanma (Instruksiya)")
    ws_guide.column_dimensions['A'].width = 8
    ws_guide.column_dimensions['B'].width = 95

    ws_guide.append(["", "DIAMOND SCHOOL — EXCEL TEST YUKLASH QOIDALARI"])
    ws_guide.cell(row=1, column=2).font = Font(name="Segoe UI", size=14, bold=True, color="0284C7")

    instructions = [
        "1. 'Savollar Ro'yxati' varag'idagi namunalarga qarab o'z savollaringizni kiriting.",
        "2. Har bir savol uchun savol matni va 4 ta javob varianti (A, B, C, D) kiritilishi shart.",
        "3. 'To'g'ri javob' ustuniga A, B, C yoki D harfini yozishingiz lozim.",
        "4. MATEMATIK FORMULALAR: Kasrlarni 5/3 yoki \\frac{5}{3} deb, ildizlarni \\sqrt{16} yoki √16 deb yozishingiz mumkin. O'quvchilar portalida ular avtomatik surat va maxraj ustun ko'rinishida ko'rinadi!",
        "5. Savolga rasm qo'shmoqchi bo'lsangiz, savolni bu yerda matn holida yuklab olib, o'qituvchi portalida 'Savolga rasm biriktirish' tugmasi orqali rasm yuklaysiz.",
        "6. Faylni kompyuteringizda saqlang va O'qituvchi Portalida 'Excel / Word dan yuklash' tugmasi orqali yuklang."
    ]

    for idx, inst in enumerate(instructions, start=3):
        ws_guide.cell(row=idx, column=2, value=inst).font = Font(name="Segoe UI", size=10)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()


def generate_sample_word():
    """O'qituvchilar yuklab olishi uchun to'liq va chiroyli namuna Word (.docx) fayli yaratish"""
    doc = Document()

    # Sarlavha
    title = doc.add_paragraph()
    r_title = title.add_run("DIAMOND SCHOOL — TEST SAVOLLARI NAMUNASI")
    r_title.bold = True
    r_title.font.size = Pt(16)
    r_title.font.color.rgb = RGBColor(2, 132, 199)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    sub = doc.add_paragraph()
    r_sub = sub.add_run("O'qituvchilar uchun test savollarini tayyorlash va platformaga yuklash namunasi")
    r_sub.italic = True
    r_sub.font.size = Pt(10)
    r_sub.font.color.rgb = RGBColor(100, 116, 139)
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph("")

    # Formula bo'yicha maxsus eslatma
    p_info = doc.add_paragraph()
    r_info = p_info.add_run("Matematik formulalar eslatmasi: Word dasturidagi tenglama formulalari (Alt + =), kasrlar (\\frac{5}{3} yoki 5/3) hamda ildizlar (\\sqrt{16} yoki √16) tizim tomonidan avtomatik tanib olinadi va o'quvchilarga vertikal ustun ko'rinishida ko'rsatiladi.")
    r_info.font.size = Pt(9.5)
    r_info.font.color.rgb = RGBColor(3, 105, 161)

    doc.add_paragraph("")

    # 1-USUL: Oddiy matnli ro'yxat
    h1 = doc.add_heading("1-USUL: Oddiy ro'yxat ko'rinishida yozish (Eng oson usul):", level=2)
    p_desc = doc.add_paragraph(
        "Savollarni quyidagi tartibda yozing. To'g'ri javobni 'Javob: C' deb ko'rsatishingiz yoki variant oldiga yulduzcha (*) qo'yishingiz mumkin:"
    )
    p_desc.runs[0].font.size = Pt(9.5)

    sample_text_questions = [
        ("1. O'zbekiston Respublikasi poytaxti qaysi shahar?", ["A) Samarqand", "B) Buxoro", "C) Toshkent", "D) Xiva"], "Javob: C"),
        ("2. Hisoblang: \\frac{5}{3} + \\frac{4}{3} ifodaning qiymati nechaga teng?", ["*A) 3", "B) 9/6", "C) 1", "D) \\frac{5}{4}"], ""),
        ("3. Ildiz osti ifodani hisoblang: \\sqrt{144} - \\sqrt{25}", ["A) 5", "*B) 7", "C) 12", "D) 9"], "Javob: B"),
        ("4. Kompyuterning asosiy tezkor xotirasi qanday ataladi?", ["*A) RAM", "B) HDD", "C) Monitor", "D) Videokarta"], ""),
        ("5. O'zbekiston Respublikasi Davlat mustaqilligi qachon e'lon qilingan?", ["A) 1990-yil 1-sentyabr", "B) 1991-yil 31-avgust", "C) 1992-yil 8-dekabr", "D) 1993-yil 1-oktyabr"], "Javob: B"),
        ("6. Suvning kimyoviy formulasi qaysi?", ["A) CO2", "B) H2O", "C) NaCl", "D) O2"], "Javob: B"),
        ("7. Quyosh sistemasidagi eng katta sayyora qaysi?", ["A) Mars", "*B) Yupiter", "C) Venera", "D) Saturn"], ""),
        ("8. Kasrni soddalashtiring: \\frac{10}{4}", ["A) 2", "*B) \\frac{5}{2}", "C) 3", "D) 5/4"], ""),
        ("9. Choose the correct past tense: 'She ____ to school yesterday.'", ["A) go", "B) went", "C) gone", "D) goes"], "Javob: B"),
        ("10. Укажите столицу Российской Федерации:", ["A) Санкт-Петербург", "B) Казань", "C) Москва", "D) Новосибирск"], "Javob: C")
    ]

    for q_text, opts, ans in sample_text_questions:
        p_q = doc.add_paragraph()
        r = p_q.add_run(q_text)
        r.bold = True
        r.font.size = Pt(10.5)

        for opt in opts:
            p_opt = doc.add_paragraph(opt)
            p_opt.paragraph_format.left_indent = Inches(0.25)
            p_opt.paragraph_format.space_after = Pt(2)

        if ans:
            p_ans = doc.add_paragraph()
            r_ans = p_ans.add_run(ans)
            r_ans.bold = True
            r_ans.font.color.rgb = RGBColor(16, 185, 129)
            p_ans.paragraph_format.left_indent = Inches(0.25)

        doc.add_paragraph("")

    # 2-USUL: Jadval ko'rinishida yozish
    doc.add_heading("2-USUL: Jadval ko'rinishida yozish (Table formati):", level=2)
    p_t_desc = doc.add_paragraph("Savollarni Word jadvali ko'rinishida ham tayyorlashingiz mumkin:")
    p_t_desc.runs[0].font.size = Pt(9.5)

    table_data = [
        ["№", "Savol matni", "A varianti", "B varianti", "C varianti", "D varianti", "To'g'ri javob"],
        ["1", "Nyutonning ikkinchi qonuni formulasi qaysi?", "F = m*a", "E = m*c^2", "A = F*s", "P = U*I", "A"],
        ["2", "Hisoblang: \\frac{8}{3} - 1", "\\frac{5}{3}", "\\frac{2}{3}", "2", "\\frac{7}{3}", "A"],
        ["3", "Ildizni hisoblang: \\sqrt{81}", "7", "8", "9", "10", "C"]
    ]

    table = doc.add_table(rows=len(table_data), cols=7)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = 'Table Grid'

    for row_idx, row_values in enumerate(table_data):
        row = table.rows[row_idx]
        for col_idx, val in enumerate(row_values):
            cell = row.cells[col_idx]
            cell.text = val
            p = cell.paragraphs[0]
            if row_idx == 0:
                p.runs[0].bold = True
                p.runs[0].font.size = Pt(9)
                p.runs[0].font.color.rgb = RGBColor(2, 132, 199)
            else:
                p.runs[0].font.size = Pt(8.5)

    doc.add_paragraph("")
    doc.add_paragraph("Eslatma: Tayyorlagan faylingizni o'qituvchi portalida 'Excel / Word dan yuklash' tugmasi orqali tizimga yuklang.")

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.getvalue()
