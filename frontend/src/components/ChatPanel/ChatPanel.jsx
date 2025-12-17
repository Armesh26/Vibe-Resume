import { useState, useRef, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { 
  Sparkles, 
  Trash2, 
  Paperclip, 
  Send, 
  Square, 
  RotateCcw,
  X
} from 'lucide-react';
import './ChatPanel.css';

export default function ChatPanel({ onSendMessage, onRestore, onStop }) {
  const { currentSession, currentSessionId, updateCurrentSession, isPending } = useSession();
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const messages = currentSession?.messages || [];
  const isLoading = isPending(currentSessionId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Get value from DOM directly as fallback for browser automation
    const textValue = textareaRef.current?.value || input;
    if (!textValue.trim() && !selectedFile) return;

    onSendMessage(textValue.trim(), selectedFile);
    setInput('');
    if (textareaRef.current) textareaRef.current.value = '';
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      if (validTypes.includes(file.type)) {
        setSelectedFile(file);
      }
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Clear this chat history?')) {
      updateCurrentSession({ messages: [], checkpoints: [] });
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-title">
          <Sparkles size={16} />
          AI Assistant
        </div>
        <button className="clear-chat-btn" onClick={handleClearChat} title="Clear chat">
          <Trash2 size={18} />
        </button>
      </div>

      <div className="chat-messages">
        <div className="message system">
          Upload a resume, paste a LinkedIn/Twitter URL, or describe your experience
        </div>

        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.type}`}>
            {msg.attachment && (
              <div className="attachment-badge">
                <Paperclip size={12} />
                {msg.attachment}
              </div>
            )}
            <div className="message-content">{msg.content}</div>
            {msg.checkpoint && (
              <button 
                className="restore-btn"
                onClick={() => onRestore(msg.checkpoint)}
                title="Restore to before this change"
              >
                <RotateCcw size={14} />
                Restore
              </button>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {selectedFile && (
          <div className="selected-file">
            <Paperclip size={14} />
            <span>{selectedFile.name}</span>
            <button className="clear-file-btn" onClick={clearFile}>
              <X size={14} />
            </button>
          </div>
        )}

        <form 
          className={`input-form ${isDragging ? 'dragging' : ''}`} 
          onSubmit={handleSubmit}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isDragging ? "Drop file here..." : "Describe your resume or drop a file..."}
            rows={1}
            disabled={isLoading}
          />
          
          <div className="input-buttons">
            <label className={`icon-btn attach-btn ${selectedFile ? 'has-file' : ''}`} title="Attach PDF or image">
              <Paperclip size={18} />
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                onChange={handleFileSelect}
                hidden
              />
            </label>
            
            <button 
              type="button" 
              className={`icon-btn stop-btn ${isLoading ? 'visible' : ''}`}
              onClick={onStop} 
              title="Stop"
            >
              <Square size={18} />
            </button>
            <button 
              type="submit" 
              className={`icon-btn send-btn ${!isLoading ? 'visible' : ''}`}
              title="Send"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

