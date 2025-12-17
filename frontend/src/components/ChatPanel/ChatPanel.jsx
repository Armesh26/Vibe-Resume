import { useState, useRef, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { 
  Sparkles, 
  Trash2, 
  Upload, 
  Send, 
  Square, 
  RotateCcw,
  Paperclip,
  X
} from 'lucide-react';
import './ChatPanel.css';

export default function ChatPanel({ onSendMessage, onRestore, isLoading, onStop }) {
  const { currentSession, updateCurrentSession, isPending } = useSession();
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const messages = currentSession?.messages || [];

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
          <Trash2 size={16} />
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
        <div className="file-upload">
          <label className={`upload-btn ${selectedFile ? 'has-file' : ''}`}>
            <Upload size={16} />
            <span>{selectedFile ? selectedFile.name : 'Upload PDF/Image'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
              onChange={handleFileSelect}
              hidden
            />
          </label>
          {selectedFile && (
            <button className="clear-file-btn" onClick={clearFile}>
              <X size={14} />
            </button>
          )}
        </div>

        <form className="input-form" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your resume..."
            rows={1}
            disabled={isLoading}
          />
          {isLoading ? (
            <button type="button" className="stop-btn" onClick={onStop}>
              <Square size={16} />
            </button>
          ) : (
            <button type="submit" className="send-btn">
              <Send size={16} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

