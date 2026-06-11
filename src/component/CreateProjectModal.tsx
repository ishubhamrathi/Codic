import type { ProjectType } from '../types/uml';
import { useState } from 'react';

type Props = {
  onSelect: (type: ProjectType, name: string) => void;
  onClose: () => void;
};

export function CreateProjectModal({ onSelect, onClose }: Props) {
  const [name, setName] = useState('');

  const handleSelect = (type: ProjectType) => {
    const trimmed = name.trim() || (type === 'uml' ? 'Untitled UML Project' : 'Untitled Drawing');
    onSelect(type, trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New File</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="File name (optional)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSelect('uml');
            }}
          />
          <div className="file-type-grid file-type-grid--3">
            <button className="file-type-card" onClick={() => handleSelect('uml')}>
              <div className="file-type-icon uml-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="4" y="4" width="10" height="10" rx="2" />
                  <rect x="18" y="18" width="10" height="10" rx="2" />
                  <path d="M9 14v4h4" strokeDasharray="3 2" />
                </svg>
              </div>
              <div className="file-type-label">UML Diagram</div>
              <div className="file-type-desc">Class diagrams, interfaces, and code generation</div>
            </button>
            <button className="file-type-card" onClick={() => handleSelect('freedraw')}>
              <div className="file-type-icon draw-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 26c2-4 4-8 8-10s6 2 8-2 2-8 4-12" />
                  <circle cx="6" cy="26" r="1.5" fill="currentColor" />
                  <circle cx="26" cy="2" r="1.5" fill="currentColor" />
                </svg>
              </div>
              <div className="file-type-label">Free Draw</div>
              <div className="file-type-desc">tldraw - whiteboard with pen tablet support</div>
            </button>
            <button className="file-type-card" onClick={() => handleSelect('excalidraw')}>
              <div className="file-type-icon excalidraw-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 24c3-5 6-9 10-10s8 3 10-2" strokeLinecap="round" />
                  <circle cx="8" cy="24" r="2" fill="currentColor" stroke="none" />
                  <circle cx="28" cy="12" r="2" fill="currentColor" stroke="none" />
                  <path d="M4 28h24" strokeDasharray="2 2" />
                </svg>
              </div>
              <div className="file-type-label">Excalidraw</div>
              <div className="file-type-desc">Hand-drawn style diagrams and sketches (MIT)</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
