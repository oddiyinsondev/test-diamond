import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  danger = false,
  onConfirm,
  onCancel,
}) {
  const { tr } = useAuth();
  if (!isOpen) return null;

  const resolvedTitle = title || tr('Tasdiqlash', 'Подтверждение');
  const resolvedConfirmText = confirmText || tr('Ha, tasdiqlayman', 'Да, подтверждаю');
  const resolvedCancelText = cancelText || tr('Bekor qilish', 'Отмена');

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content" style={{ maxWidth: '440px', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: danger ? 'rgba(239, 68, 68, 0.15)' : 'rgba(41, 183, 225, 0.15)',
              color: danger ? '#f87171' : '#29B7E1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
            }}>
              <i className={danger ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-question'}></i>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>{resolvedTitle}</h3>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onCancel}
            style={{ borderRadius: '50%', width: '30px', height: '30px', padding: 0 }}
          >
            &times;
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', color: '#CBD5E1', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {message}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
            {resolvedCancelText}
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger btn-sm' : 'btn-primary-diamond'}
            style={danger ? { padding: '8px 18px', fontWeight: 700 } : { padding: '8px 18px', fontSize: '0.85rem' }}
            onClick={onConfirm}
          >
            {resolvedConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
