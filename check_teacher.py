with open('frontend/src/pages/TeacherPortal.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'activeTab ===' in line or 'tab ===' in line or 'Dars Faolligi' in line or 'Yangi Test Yaratish' in line:
        print(f'{i+1}: {line.strip()[:100]}')

