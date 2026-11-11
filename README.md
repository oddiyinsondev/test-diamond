# test-diamond

**Diamond School** — maktab testlari, dars faolligi, reyting va Diamond Coin tizimini boshqaruvchi ikki tilli (**O'zbekcha / Русский**) web-platforma (Django + React + Vite).

## Asosiy imkoniyatlar

- **Ikki tilli interfeys (UZ / RU):** Bosh sahifa, Admin paneli, O'qituvchi portali, O'quvchi kabineti hamda API javoblari `UZ` va `RU` tillarida ishlaydi.
- **Admin paneli (`/admin-panel/`):** O'qituvchilar, o'quvchilar, sinflar (`UZ` va `RU` yo'nalishlari), testlar va savollar konstruktori, o'quvchi testlariga ruxsat/jadval nazorati, Diamond Coin taqsimoti va analitik diagrammalar.
- **O'qituvchi portali (`/teacher/`):** Biriktirilgan fan testlari va ruxsat holati, sinflar kesimidagi statistika va zaif savollar tahlili, natijalar jurnali hamda har bir sinf uchun kunlik 5 coin limiti bilan dars faolligi rag'batlantiruvi.
- **O'quvchi kabineti (`/student/`):** Admin ruxsati bilan ochiladigan testlar, taymerli test topshirish oynasi, natijalar tahlili va sinf reytingi.

## Ishga tushirish

```bash
# 1. Backend kutubxonalari va migratsiyalar
pip install -r requirements.txt
pip install django-cors-headers
python manage.py migrate

# 2. Frontend build (zarurat bo'lganda)
npm install --prefix frontend
npm run build --prefix frontend

# 3. Serverni ishga tushirish
python manage.py runserver 127.0.0.1:8000
```
