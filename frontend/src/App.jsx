import { useState, useCallback, useRef, useEffect } from 'react';
import { SessionProvider, useSession } from './context/SessionContext';
import { ThemeProvider } from './context/ThemeContext';
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import LatexEditor from './components/LatexEditor/LatexEditor';
import PdfViewer from './components/PdfViewer/PdfViewer';
import ChatPanel from './components/ChatPanel/ChatPanel';
import './styles/globals.css';
import './App.css';

function AppContent() {
  const { 
    currentSession, 
    currentSessionId,
    updateCurrentSession, 
    setPending,
    sessions 
  } = useSession();
  
  const [showEditor, setShowEditor] = useState(true);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [targetLine, setTargetLine] = useState(null);
  const [proMode, setProMode] = useState(() => {
    return localStorage.getItem('vibe-resume-pro-mode') === 'true';
  });
  const abortControllerRef = useRef(null);

  const toggleProMode = () => {
    setProMode(prev => {
      localStorage.setItem('vibe-resume-pro-mode', !prev);
      return !prev;
    });
  };
  
  // Get pdfUrl from current session
  const pdfUrl = currentSession?.pdfUrl || null;
  
  // Panel sizes as percentages
  const [editorWidth, setEditorWidth] = useState(30);
  const [chatWidth, setChatWidth] = useState(25);
  const [isResizing, setIsResizing] = useState(false);
  const isDragging = useRef(null);
  const containerRef = useRef(null);

  // Resize handlers
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;
      const percentage = (mouseX / containerWidth) * 100;

      if (isDragging.current === 'editor') {
        const newWidth = Math.min(50, Math.max(15, percentage));
        setEditorWidth(newWidth);
      } else if (isDragging.current === 'chat') {
        const newWidth = Math.min(40, Math.max(15, 100 - percentage));
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = null;
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startEditorResize = useCallback((e) => {
    e.preventDefault();
    isDragging.current = 'editor';
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const startChatResize = useCallback((e) => {
    e.preventDefault();
    isDragging.current = 'chat';
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const compilePdf = useCallback(async (latexCode) => {
    // Use provided latex or fall back to current session latex
    // Check if latexCode is a string (not an event object from button click)
    const latex = (typeof latexCode === 'string') ? latexCode : currentSession?.latex;
    if (!latex?.trim()) return;

    setIsCompiling(true);
    try {
      const response = await fetch('/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          latex_code: latex,
          session_id: currentSessionId  // Pass session ID for image support
        })
      });

      const data = await response.json();
      if (data.success && data.pdf_url) {
        // Use the URL returned by the backend with cache-busting timestamp
        updateCurrentSession({ pdfUrl: `${data.pdf_url}?t=${Date.now()}` });
      } else {
        showToast(data.error || 'Compilation failed', 'error');
      }
    } catch (error) {
      showToast('Failed to compile PDF', 'error');
    } finally {
      setIsCompiling(false);
    }
  }, [currentSession?.latex, currentSessionId, updateCurrentSession]);

  const handleSendMessage = useCallback(async (message, file) => {
    const requestSessionId = currentSessionId;
    setPending(requestSessionId, true);
    setIsLoading(true);

    // Add user message
    const userMsg = {
      type: 'user',
      content: message || 'Create a resume from this file',
      attachment: file?.name || null,
      timestamp: Date.now()
    };
    
    const currentLatex = currentSession?.latex || '';
    const previousMessages = currentSession?.messages || [];
    const previousCheckpoints = currentSession?.checkpoints || [];
    
    updateCurrentSession({
      messages: [...previousMessages, userMsg]
    });

    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('message', message);
      formData.append('current_latex', currentLatex);
      formData.append('pro_mode', proMode ? 'true' : 'false');
      if (file) {
        formData.append('pdf', file);
      }

      const response = await fetch('/chat', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal
      });

      const data = await response.json();
      setPending(requestSessionId, false);

      // Check if user switched sessions
      if (requestSessionId !== currentSessionId) {
        // Save to original session
        const originalSession = sessions.find(s => s.id === requestSessionId);
        if (originalSession) {
          const updatedMessages = [...originalSession.messages];
          if (data.success) {
            updatedMessages.push({ 
              type: 'assistant', 
              content: '✓ Resume generated!', 
              timestamp: Date.now() 
            });
          } else {
            updatedMessages.push({ 
              type: 'assistant', 
              content: data.error, 
              timestamp: Date.now() 
            });
          }
          // Note: We can't directly update other sessions from here
          // This would need to be handled via context
        }
        showToast('Response saved to original chat', 'info');
        return;
      }

      if (data.success) {
        // Create checkpoint if there was previous latex
        let newCheckpoints = [...previousCheckpoints];
        let checkpoint = null;
        
        if (currentLatex.trim()) {
          checkpoint = { 
            id: previousCheckpoints.length + 1, 
            latex: currentLatex 
          };
          newCheckpoints.push(checkpoint);
        }

        // Update messages with checkpoint reference
        const updatedMessages = [...previousMessages, userMsg];
        if (checkpoint) {
          updatedMessages[updatedMessages.length - 1].checkpoint = checkpoint;
        }
        updatedMessages.push({ 
          type: 'assistant', 
          content: '✓ Generating PDF...', 
          timestamp: Date.now() 
        });

        updateCurrentSession({
          latex: data.latex_code,
          messages: updatedMessages,
          checkpoints: newCheckpoints
        });

        // Auto-compile with the new latex code directly
        compilePdf(data.latex_code);
      } else {
        updateCurrentSession({
          messages: [...previousMessages, userMsg, {
            type: 'assistant',
            content: data.error,
            timestamp: Date.now()
          }]
        });
      }
    } catch (error) {
      setPending(requestSessionId, false);
      if (error.name !== 'AbortError') {
        updateCurrentSession({
          messages: [...(currentSession?.messages || []), {
            type: 'assistant',
            content: `Error: ${error.message}`,
            timestamp: Date.now()
          }]
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [currentSession, currentSessionId, updateCurrentSession, setPending, sessions, compilePdf, proMode]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setPending(currentSessionId, false);
    }
  }, [currentSessionId, setPending]);

  const handleRestore = useCallback((checkpoint) => {
    if (!checkpoint?.latex?.trim()) {
      showToast('Cannot restore: checkpoint data is missing', 'error');
      return;
    }
    updateCurrentSession({ latex: checkpoint.latex });
    showToast('Restored to checkpoint', 'success');
    compilePdf(checkpoint.latex);
  }, [updateCurrentSession, compilePdf]);

  const handleDownload = useCallback(() => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = 'resume.pdf';
      link.click();
    }
  }, [pdfUrl]);

  const handleGoToSource = useCallback((line) => {
    // Ensure editor is visible
    if (!showEditor) {
      setShowEditor(true);
    }
    setTargetLine(line);
  }, [showEditor]);

  return (
    <div className="app">
      <Header 
        showEditor={showEditor}
        onToggleEditor={() => setShowEditor(!showEditor)}
        onDownload={handleDownload}
        canDownload={!!pdfUrl}
        proMode={proMode}
        onToggleProMode={toggleProMode}
      />

      <div className="main-content">
        <Sidebar />

        <div className={`panels ${isResizing ? 'is-resizing' : ''}`} ref={containerRef}>
          <div 
            className={`panel editor-wrapper ${showEditor ? '' : 'hidden'}`}
            style={{ width: showEditor ? `${editorWidth}%` : '0%' }}
          >
            <LatexEditor 
              key={currentSessionId}
              onCompile={compilePdf}
              isCompiling={isCompiling}
              targetLine={targetLine}
              onLineNavigated={() => setTargetLine(null)}
            />
          </div>
          <div 
            className={`resize-handle ${showEditor ? '' : 'hidden'}`}
            onMouseDown={startEditorResize}
          />

          <div 
            className="panel preview-wrapper"
            style={{ flex: 1 }}
          >
            <PdfViewer 
              key={currentSessionId}
              pdfUrl={pdfUrl}
              onDownload={handleDownload}
              onGoToSource={handleGoToSource}
            />
          </div>

          <div 
            className="resize-handle"
            onMouseDown={startChatResize}
          />

          <div 
            className="panel chat-wrapper"
            style={{ width: `${chatWidth}%` }}
          >
            <ChatPanel 
              key={currentSessionId}
              onSendMessage={handleSendMessage}
              onRestore={handleRestore}
              onStop={handleStop}
            />
          </div>
        </div>
      </div>
      </div>
  );
}

// Toast helper
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export default function App() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </ThemeProvider>
  );
}
