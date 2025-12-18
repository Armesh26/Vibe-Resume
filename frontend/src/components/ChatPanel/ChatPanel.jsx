import { useState, useRef, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { 
  Sparkles, 
  Trash2, 
  Paperclip, 
  Send, 
  Square, 
  RotateCcw,
  X,
  Smile,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import IconPicker from '../IconPicker/IconPicker';
import './ChatPanel.css';

export default function ChatPanel({ onSendMessage, onRestore, onStop }) {
  const { currentSession, currentSessionId, updateCurrentSession, isPending } = useSession();
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const textareaRef = useRef(null);

  const messages = currentSession?.messages || [];
  const isLoading = isPending(currentSessionId);

  // Load session images on mount
  useEffect(() => {
    if (currentSessionId) {
      fetchSessionImages();
    }
  }, [currentSessionId]);

  const fetchSessionImages = async () => {
    try {
      const response = await fetch(`/session-images/${currentSessionId}`);
      const data = await response.json();
      if (data.success) {
        setUploadedImages(data.images);
      }
    } catch (error) {
      console.error('Failed to fetch session images:', error);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please select an image file (PNG, JPG, GIF, WebP)');
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('sessionId', currentSessionId);

      const response = await fetch('/upload-image', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setUploadedImages(prev => [...prev, data.filename]);
      } else {
        alert(data.error || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleDeleteImage = async (filename) => {
    try {
      const response = await fetch('/delete-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId, filename })
      });

      const data = await response.json();
      if (data.success) {
        setUploadedImages(prev => prev.filter(img => img !== filename));
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const [selectedIcons, setSelectedIcons] = useState([]);

  const handleIconSelect = (icon) => {
    // Add icon to selected icons list (avoid duplicates)
    if (!selectedIcons.find(i => i.id === icon.id)) {
      setSelectedIcons(prev => [...prev, icon]);
    }
    setShowIconPicker(false);
  };

  const handleRemoveIcon = (iconId) => {
    setSelectedIcons(prev => prev.filter(i => i.id !== iconId));
  };

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
    if (!textValue.trim() && !selectedFile && selectedIcons.length === 0 && uploadedImages.length === 0) return;

    // Build message with element context
    let messageWithContext = textValue.trim();
    
    // Add icons context if any selected
    if (selectedIcons.length > 0) {
      const iconsList = selectedIcons.map(i => i.latex).join(', ');
      messageWithContext += `\n[Include these icons in the resume: ${iconsList}]`;
    }
    
    // Add images context if any uploaded
    if (uploadedImages.length > 0) {
      const imagesList = uploadedImages.join(', ');
      messageWithContext += `\n[Include these images in the resume: ${imagesList}]`;
    }

    onSendMessage(messageWithContext, selectedFile);
    setInput('');
    if (textareaRef.current) textareaRef.current.value = '';
    setSelectedFile(null);
    setSelectedIcons([]); // Clear selected icons after sending
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

        {messages.map((msg, index) => {
          // Clean up context markers from user messages for display
          const displayContent = msg.type === 'user' 
            ? msg.content.replace(/\n\[Include these (icons|images) in the resume:.*?\]/g, '').trim()
            : msg.content;
          
          return (
          <div key={index} className={`message ${msg.type}`}>
            {msg.attachment && (
              <div className="attachment-badge">
                <Paperclip size={12} />
                {msg.attachment}
              </div>
            )}
            <div className="message-content">{displayContent}</div>
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
        );
        })}

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
        {/* Elements Preview (Icons + Images) */}
        {(selectedIcons.length > 0 || uploadedImages.length > 0) && (
          <div className="elements-preview">
            <span className="elements-label">Elements:</span>
            {/* Selected Icons */}
            {selectedIcons.map(icon => {
              const IconComponent = icon.icon;
              return (
                <div key={icon.id} className="element-item icon-element">
                  <IconComponent size={16} />
                  <button 
                    className="remove-element-btn"
                    onClick={() => handleRemoveIcon(icon.id)}
                    title="Remove icon"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
            {/* Uploaded Images */}
            {uploadedImages.map(filename => (
              <div key={filename} className="element-item image-element">
                <img 
                  src={`/session-images/${currentSessionId}/${filename}`} 
                  alt={filename}
                  title={filename}
                />
                <button 
                  className="remove-element-btn"
                  onClick={() => handleDeleteImage(filename)}
                  title="Remove image"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {selectedFile && (
          <div className="selected-file">
            <Paperclip size={14} />
            <span>{selectedFile.name}</span>
            <button className="clear-file-btn" onClick={clearFile}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Toolbar for icons and images */}
        <div className="chat-toolbar">
          <button 
            type="button"
            className="toolbar-btn"
            onClick={() => setShowIconPicker(true)}
            title="Insert Icon"
          >
            <Smile size={16} />
            <span>Icons</span>
          </button>
          <label 
            className={`toolbar-btn ${isUploadingImage ? 'uploading' : ''}`}
            title="Upload Image for Resume"
          >
            <ImageIcon size={16} />
            <span>{isUploadingImage ? 'Uploading...' : 'Image'}</span>
            <input
              ref={imageInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.webp"
              onChange={handleImageUpload}
              hidden
              disabled={isUploadingImage}
            />
          </label>
        </div>

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

      {/* Icon Picker Modal */}
      <IconPicker
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelect={handleIconSelect}
      />
    </div>
  );
}

