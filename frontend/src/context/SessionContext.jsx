import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const SessionContext = createContext(null);

const MAX_SESSIONS = 5;

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
        // Filter out duplicates and invalid entries
        const uniqueSessions = parsed.filter((session, index, self) =>
          session && session.id && 
          index === self.findIndex(s => s.id === session.id)
        );
        
        if (uniqueSessions.length > 0) {
          setSessions(uniqueSessions);
          const lastActiveId = localStorage.getItem('vibe-resume-active-session');
          const sessionToLoad = uniqueSessions.find(s => s.id === lastActiveId) || uniqueSessions[0];
          setCurrentSessionId(sessionToLoad.id);
          // Save cleaned sessions
          localStorage.setItem('vibe-resume-sessions', JSON.stringify(uniqueSessions));
        } else {
          initNewSession();
        }
      } catch (e) {
        initNewSession();
      }
    } else {
      initNewSession();
    }
    
    function initNewSession() {
      const newSession = {
        id: 'session-' + Date.now(),
        name: 'Chat 1',
        createdAt: Date.now(),
        messages: [],
        latex: '',
        checkpoints: []
      };
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

  const getCurrentSession = useCallback(() => {
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

    const newSession = {
      id: 'session-' + Date.now(),
      name: `Chat ${nextNum}`,
      createdAt: Date.now(),
      messages: [],
      latex: '',
      checkpoints: []
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionId(newSession.id);
    return newSession;
  }, [sessions]);

  const switchSession = useCallback((sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
    }
  }, [sessions]);

  const updateCurrentSession = useCallback((updates) => {
    setSessions(prev => prev.map(s => 
      s.id === currentSessionId ? { ...s, ...updates } : s
    ));
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
    currentSession: getCurrentSession(),
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

