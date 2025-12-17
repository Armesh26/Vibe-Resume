import { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { oneDark } from '@codemirror/theme-one-dark';
import { useSession } from '../../context/SessionContext';
import { Code, Play, Trash2 } from 'lucide-react';
import './LatexEditor.css';

export default function LatexEditor({ onCompile, isCompiling }) {
  const { currentSession, updateCurrentSession } = useSession();
  
  const latex = currentSession?.latex || '';

  const handleChange = useCallback((value) => {
    updateCurrentSession({ latex: value });
  }, [updateCurrentSession]);

  const handleClear = () => {
    updateCurrentSession({ latex: '' });
  };

  return (
    <div className="latex-editor">
      <div className="editor-header">
        <div className="editor-title">
          <Code size={16} />
          LaTeX Code
        </div>
      </div>

      <div className="editor-content">
        <CodeMirror
          value={latex}
          height="100%"
          theme={oneDark}
          extensions={[StreamLanguage.define(stex)]}
          onChange={handleChange}
          placeholder="LaTeX code will appear here..."
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            foldGutter: true,
            autocompletion: true,
          }}
        />
      </div>

      <div className="editor-actions">
        <button 
          className="compile-btn"
          onClick={onCompile}
          disabled={isCompiling || !latex.trim()}
        >
          <Play size={16} />
          {isCompiling ? 'Compiling...' : 'Compile'}
        </button>
        <button 
          className="clear-btn"
          onClick={handleClear}
          disabled={!latex.trim()}
        >
          <Trash2 size={16} />
          Clear
        </button>
      </div>
    </div>
  );
}

