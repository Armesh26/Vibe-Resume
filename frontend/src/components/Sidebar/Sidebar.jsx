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

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      localStorage.setItem('vibe-resume-sidebar-collapsed', !prev);
      return !prev;
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
    <>
      <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <h2>CHATS</h2>
          <button className="collapse-btn" onClick={toggleCollapse}>
            <ChevronLeft size={18} />
          </button>
        </div>

        <div className="sessions-list">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
              onClick={() => switchSession(session.id)}
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
        className={`expand-btn ${isCollapsed ? 'visible' : ''}`}
        onClick={toggleCollapse}
      >
        <ChevronRight size={18} />
      </button>
    </>
  );
}

