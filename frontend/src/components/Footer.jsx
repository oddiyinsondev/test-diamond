import React from 'react';
import { useAuth } from '../context/AuthContext';
import { getMainSectionHref, resolvePortalMode } from '../utils/portalHost';

export default function Footer() {
  const { tr } = useAuth();
  const portalMode = resolvePortalMode();

  return (
    <footer className="footer-clean-wrap">
      <div className="container">
        <div className="footer-clean-grid">
          {/* Brand Col */}
          <div className="footer-col-brand">
            <h3>DIAMOND <span>SCHOOL</span></h3>
            <p>
              {tr(
                "Zamonaviy texnologiyalar va ilg'or pedagogika asosida o'quvchilarga eng yuksak darajada bilim, intizom va intellektual salohiyat ulashuvchi yetakchi maktab platformasi.",
                'Передовая школьная платформа, передающая ученикам знания высшего уровня, дисциплину и интеллектуальный потенциал на основе современных технологий и педагогики.'
              )}
            </p>
            <div style={{ marginTop: '1rem', color: '#29B7E1', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-award"></i>{' '}
              {tr(
                "Respublika va Xalqaro Standartlarga Mos Ta'lim",
                'Образование по республиканским и международным стандартам'
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-col">
            <h4>{tr("Bo'limlar", 'Навигация')}</h4>
            <ul>
              <li><a href={getMainSectionHref('#hero-section', { portalMode })}>{tr('Bosh sahifa', 'Главная')}</a></li>
              <li><a href={getMainSectionHref('#teachers-section', { portalMode })}>{tr('Bizning ustozlar', 'Учителя')}</a></li>
              <li><a href={getMainSectionHref('#talented-section', { portalMode })}>{tr("Iqtidorli o'quvchilar", 'Таланты')}</a></li>
              <li><a href={getMainSectionHref('#contact-section', { portalMode })}>{tr('Qabulga yozilish', 'Контакты')}</a></li>
            </ul>
          </div>

          {/* Programs */}
          <div className="footer-col">
            <h4>{tr("Ta'lim yo'nalishlari", 'Направления')}</h4>
            <ul>
              <li><a href={getMainSectionHref('#why-section', { portalMode })}>{tr('Aniq fanlar va Matematika', 'Точные науки и математика')}</a></li>
              <li><a href={getMainSectionHref('#why-section', { portalMode })}>{tr('IT & Zamonaviy dasturlash', 'IT и современное программирование')}</a></li>
              <li><a href={getMainSectionHref('#why-section', { portalMode })}>{tr('Xorijiy tillar (IELTS & SAT)', 'Иностранные языки (IELTS и SAT)')}</a></li>
              <li><a href={getMainSectionHref('#talented-section', { portalMode })}>{tr('Olimpiada va tanlovlar', 'Олимпиады и конкурсы')}</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="footer-col">
            <h4>{tr("Bog'lanish", 'Контакты')}</h4>
            <div style={{ fontSize: '0.86rem', color: '#CBD5E1', marginBottom: '8px' }}>
              <i className="fa-solid fa-phone-volume" style={{ color: '#29B7E1', marginRight: '8px' }}></i>
              <a href={getMainSectionHref('#contact-section', { portalMode })} style={{ color: '#29B7E1', textDecoration: 'none', fontWeight: 700 }}>
                {tr("Qayta qo'ng'iroq buyurtma qilish", 'Заказать обратный звонок (15 мин)')}
              </a>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#94A3B8', marginBottom: '8px', lineHeight: 1.5 }}>
              <i className="fa-solid fa-location-dot" style={{ color: '#29B7E1', marginRight: '8px' }}></i>
              {tr(
                'Toshkent sh., Yunusobod t., Amir Temur shohi, 120',
                'г. Ташкент, Юнусабадский р-н, пр. Амира Темура, 120'
              )}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#94A3B8' }}>
              <i className="fa-solid fa-clock" style={{ color: '#29B7E1', marginRight: '8px' }}></i>
              {tr('Dush - Shan, 08:30 - 18:00', 'Пн - Сб, 08:30 - 18:00')}
            </div>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div>
            &copy; 2026 Diamond School. {tr('Barcha huquqlar himoyalangan.', 'Все права защищены.')}
          </div>
          <div style={{ color: '#94A3B8' }}>
            {tr('Powered by', 'Платформа')}{' '}
            <strong style={{ color: '#29B7E1' }}>SmartTest React System</strong>
          </div>
        </div>
      </div>
    </footer>
  );
}
