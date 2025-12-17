import { useCallback, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { oneDark } from '@codemirror/theme-one-dark';
import { useSession } from '../../context/SessionContext';
import { useTheme } from '../../context/ThemeContext';
import { Code, Play, Trash2 } from 'lucide-react';
import './LatexEditor.css';

export default function LatexEditor({ onCompile, isCompiling, targetLine, onLineNavigated }) {
  const { currentSession, updateCurrentSession } = useSession();
  const { theme } = useTheme();
  const editorRef = useRef(null);
  
  const latex = currentSession?.latex || '';

  const handleChange = useCallback((value) => {
    updateCurrentSession({ latex: value });
  }, [updateCurrentSession]);

  const handleClear = () => {
    updateCurrentSession({ latex: '' });
  };

  // Handle navigation to target line from PDF synctex
  useEffect(() => {
    if (targetLine !== null && editorRef.current?.view) {
      const view = editorRef.current.view;
      const doc = view.state.doc;
      
      // Ensure line is within bounds
      const lineNum = Math.min(Math.max(1, targetLine + 1), doc.lines);
      const line = doc.line(lineNum);
      
      // Scroll to line and select it
      view.dispatch({
        selection: { anchor: line.from, head: line.to },
        scrollIntoView: true
      });
      
      // Notify parent that navigation is complete
      if (onLineNavigated) {
        onLineNavigated();
      }
    }
  }, [targetLine, onLineNavigated]);

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
          ref={editorRef}
          value={latex}
          height="100%"
          theme={theme === 'dark' ? oneDark : 'light'}
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

