import { useState, useEffect, useRef } from 'react';

type ConfirmModalProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onCancel }: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { confirmRef.current?.focus(); }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onConfirm, onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog-title">{title}</div>
        <div className="modal-dialog-message">{message}</div>
        <div className="modal-dialog-actions">
          <button className="modal-dialog-btn modal-dialog-btn--cancel" onClick={onCancel}>{cancelLabel}</button>
          <button ref={confirmRef} className={`modal-dialog-btn ${danger ? 'modal-dialog-btn--danger' : 'modal-dialog-btn--confirm'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

type InputModalProps = {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export function InputModal({ title, placeholder = '', defaultValue = '', confirmLabel = 'Create', onConfirm, onCancel }: InputModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog-title">{title}</div>
        <input
          ref={inputRef}
          className="modal-dialog-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        />
        <div className="modal-dialog-actions">
          <button className="modal-dialog-btn modal-dialog-btn--cancel" onClick={onCancel}>Cancel</button>
          <button className="modal-dialog-btn modal-dialog-btn--confirm" onClick={handleSubmit}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
