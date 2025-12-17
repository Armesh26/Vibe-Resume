import { useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { MessageSquare, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import './Sidebar.css';

export default function Sidebar() {
  const { 
    sessions, 
    currentSessionId, 
    maxSessions,
    createNewSession, 
    switchSession, 
    deleteSession,
    isPending 
  } = useSession();
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('vibe-resume-sidebar-collapsed') === 'true';
  });
  const [animationKey, setAnimationKey] = useState(0);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const newCollapsed = !prev;
      localStorage.setItem('vibe-resume-sidebar-collapsed', newCollapsed);
      // Trigger re-animation when opening
      if (!newCollapsed) {
        setAnimationKey(k => k + 1);
      }
      return newCollapsed;
    });
  };

  const handleNewChat = () => {
    if (sessions.length >= maxSessions) {
      return;
    }
    createNewSession();
  };

  const handleDelete = (e, sessionId) => {
    e.stopPropagation();
    deleteSession(sessionId);
  };

  return (
    <div 
      className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}
      style={{ width: isCollapsed ? '0' : '260px' }}
    >
      <div className="sidebar-content" key={animationKey}>
        <div className="sidebar-header">
          <h2>CHATS</h2>
        </div>

        <div className="sessions-list">
          {sessions.map((session, index) => (
            <div
              key={session.id}
              className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
              onClick={() => switchSession(session.id)}
              style={{ animationDelay: `${0.05 + index * 0.05}s` }}
            >
              <MessageSquare size={16} />
              <span className="session-name">{session.name}</span>
              {isPending(session.id) && (
                <span className="pending-dot" />
              )}
              <button 
                className="delete-btn"
                onClick={(e) => handleDelete(e, session.id)}
                title="Delete chat"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <button 
          className={`new-chat-btn ${sessions.length >= maxSessions ? 'disabled' : ''}`}
          onClick={handleNewChat}
          disabled={sessions.length >= maxSessions}
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      <button 
        className={`toggle-btn ${isCollapsed ? 'collapsed' : ''}`}
        onClick={toggleCollapse}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </div>
  );
}

