import { Eye, EyeOff, Download, Sun, Moon, Zap, Sparkles } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import './Header.css';

export default function Header({ showEditor, onToggleEditor, onDownload, canDownload, proMode, onToggleProMode }) {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <header className="header">
      <div className="logo">
        <img 
          src={theme === 'dark' ? '/darklogo.jpg' : '/lightlogo.png'} 
          alt="Vibe-Resume" 
          className="logo-image"
        />
      </div>

      <div className="header-actions">
        {/* Mode Toggle Switch */}
        <div className="mode-toggle" onClick={onToggleProMode} title={proMode ? 'PRO mode (slower, higher quality)' : 'Fast mode (quick responses)'}>
          <div className={`mode-switch ${proMode ? 'pro' : 'fast'}`}>
            <div className="mode-option fast">
              <Zap size={12} />
              <span>Fast</span>
            </div>
            <div className="mode-option pro">
              <Sparkles size={12} />
              <span>PRO</span>
            </div>
            <div className="mode-slider" />
          </div>
        </div>
        
        <button 
          className="icon-btn theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        
        <button 
          className={`icon-btn toggle-editor-btn ${showEditor ? 'active' : ''}`}
          onClick={onToggleEditor}
          title={showEditor ? 'Hide LaTeX' : 'Show LaTeX'}
        >
          {showEditor ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
        
        <button 
          className={`icon-btn download-btn ${!canDownload ? 'disabled' : ''}`}
          onClick={onDownload}
          disabled={!canDownload}
          title={canDownload ? "Download PDF" : "Generate a resume first"}
        >
          <Download size={18} />
        </button>
      </div>
    </header>
  );
}

