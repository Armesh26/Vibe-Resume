import { Eye, EyeOff, Download } from 'lucide-react';
import './Header.css';

export default function Header({ showEditor, onToggleEditor, onDownload, canDownload }) {
  return (
    <header className="header">
      <div className="logo">
        <span className="logo-icon">✨</span>
        <span className="logo-text">Vibe-Resume</span>
      </div>

      <div className="header-actions">
        <button 
          className={`toggle-editor-btn ${showEditor ? 'active' : ''}`}
          onClick={onToggleEditor}
        >
          {showEditor ? <EyeOff size={16} /> : <Eye size={16} />}
          {showEditor ? 'Hide LaTeX' : 'Show LaTeX'}
        </button>
        
        {canDownload && (
          <button className="download-btn" onClick={onDownload}>
            <Download size={16} />
            Download
          </button>
        )}
      </div>
    </header>
  );
}

