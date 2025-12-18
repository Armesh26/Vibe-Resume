import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

const SessionContext = createContext(null);

const MAX_SESSIONS = 5;

// Deep clone a session to prevent shared references
function cloneSession(session) {
  if (!session) return null;
  return {
    ...session,
    messages: session.messages ? [...session.messages.map(m => ({
      ...m,
      // Deep clone checkpoint if it exists
      checkpoint: m.checkpoint ? { ...m.checkpoint } : undefined
    }))] : [],
    checkpoints: session.checkpoints ? [...session.checkpoints.map(c => ({ ...c }))] : [],
  };
}

// Create a fresh new session
function createEmptySession(name = 'Chat 1') {
  return {
    id: 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    name,
    createdAt: Date.now(),
    messages: [],
    latex: '',
    checkpoints: [],
    pdfUrl: null
  };
}

export function SessionProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [pendingRequests, setPendingRequests] = useState({});

  // Initialize sessions from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem('vibe-resume-sessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        // Deep clone all sessions to prevent shared references
        const clonedSessions = parsed
          .filter(s => s && s.id)
          .map(s => cloneSession(s))
          .filter((session, index, self) =>
            index === self.findIndex(s => s.id === session.id)
          );
        
        if (clonedSessions.length > 0) {
          setSessions(clonedSessions);
          const lastActiveId = localStorage.getItem('vibe-resume-active-session');
          const sessionToLoad = clonedSessions.find(s => s.id === lastActiveId) || clonedSessions[0];
          setCurrentSessionId(sessionToLoad.id);
        } else {
          initNewSession();
        }
      } catch (e) {
        console.error('Failed to load sessions:', e);
        initNewSession();
      }
    } else {
      initNewSession();
    }
    
    function initNewSession() {
      const newSession = createEmptySession('Chat 1');
      setSessions([newSession]);
      setCurrentSessionId(newSession.id);
    }
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('vibe-resume-sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  // Save active session ID
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('vibe-resume-active-session', currentSessionId);
    }
  }, [currentSessionId]);

  // Get current session - memoized to prevent unnecessary recalculations
  const currentSession = useMemo(() => {
    return sessions.find(s => s.id === currentSessionId) || null;
  }, [sessions, currentSessionId]);

  const createNewSession = useCallback(() => {
    if (sessions.length >= MAX_SESSIONS) {
      return null;
    }

    // Find next available chat number
    const existingNumbers = sessions.map(s => {
      const match = s.name.match(/^Chat (\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });
    let nextNum = 1;
    while (existingNumbers.includes(nextNum)) nextNum++;

    const newSession = createEmptySession(`Chat ${nextNum}`);

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionId(newSession.id);
    return newSession;
  }, [sessions]);

  const switchSession = useCallback((sessionId) => {
    if (sessionId !== currentSessionId) {
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        setCurrentSessionId(sessionId);
      }
    }
  }, [sessions, currentSessionId]);

  const updateCurrentSession = useCallback((updates) => {
    if (!currentSessionId) return;
    
    setSessions(prev => prev.map(s => {
      if (s.id !== currentSessionId) return s;
      
      // Create a new session object with updated values
      const updated = { ...s };
      
      // Handle messages array - always create new array with deep cloned checkpoints
      if (updates.messages !== undefined) {
        updated.messages = [...updates.messages.map(m => ({
          ...m,
          checkpoint: m.checkpoint ? { ...m.checkpoint } : undefined
        }))];
      }
      
      // Handle checkpoints array - always create new array  
      if (updates.checkpoints !== undefined) {
        updated.checkpoints = [...updates.checkpoints.map(c => ({ ...c }))];
      }
      
      // Handle other properties
      if (updates.latex !== undefined) {
        updated.latex = updates.latex;
      }
      
      if (updates.pdfUrl !== undefined) {
        updated.pdfUrl = updates.pdfUrl;
      }
      
      return updated;
    }));
  }, [currentSessionId]);

  const deleteSession = useCallback((sessionId) => {
    if (sessions.length <= 1) return false;

    setSessions(prev => {
      const newSessions = prev.filter(s => s.id !== sessionId);
      if (sessionId === currentSessionId && newSessions.length > 0) {
        setCurrentSessionId(newSessions[0].id);
      }
      return newSessions;
    });
    return true;
  }, [sessions, currentSessionId]);

  const setPending = useCallback((sessionId, isPending) => {
    setPendingRequests(prev => {
      if (isPending) {
        return { ...prev, [sessionId]: true };
      } else {
        const { [sessionId]: _, ...rest } = prev;
        return rest;
      }
    });
  }, []);

  const isPending = useCallback((sessionId) => {
    return !!pendingRequests[sessionId || currentSessionId];
  }, [pendingRequests, currentSessionId]);

  const value = {
    sessions,
    currentSessionId,
    currentSession,
    pendingRequests,
    maxSessions: MAX_SESSIONS,
    createNewSession,
    switchSession,
    updateCurrentSession,
    deleteSession,
    setPending,
    isPending,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
