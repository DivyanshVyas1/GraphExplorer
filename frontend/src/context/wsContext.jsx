import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const WsContext = createContext(null);

const WS_URL = `ws://${window.location.host}/ws`;

export function WsProvider({ children }) {
  const wsRef = useRef(null);
  const pendingRef = useRef({});
  const reconnectTimer = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  const connect = useCallback(() => {
    // Pehle se open connection ho toh skip karo
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Pending reconnect timer cancel karo
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    setIsConnecting(true);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      // Agar ye wahi ws object hai jo abhi wsRef mein hai
      if (wsRef.current !== ws) return;
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      setIsConnecting(false);
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        const msgId = response?.header?.msgId;
        if (msgId && pendingRef.current[msgId]) {
          pendingRef.current[msgId](response);
          delete pendingRef.current[msgId];
        }
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    ws.onclose = () => {
      // Agar ye purana ws object hai (replaced ho gaya) toh ignore karo
      if (wsRef.current !== ws) return;
      setIsConnected(false);
      setIsConnecting(false);
      // Unexpected disconnect — 3s baad reconnect karo
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      // onerror ke baad onclose bhi fire hoga — wahan reconnect handle hai
      // Sirf tab log karo jab ye active connection hai
      if (wsRef.current === ws) {
        setIsConnected(false);
        setIsConnecting(false);
      }
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      // StrictMode cleanup:
      // wsRef.current ko null kar do — handlers check karenge ki ye active hai ya nahi
      const ws = wsRef.current;
      wsRef.current = null; // handlers ab "wsRef.current !== ws" check fail karenge
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (ws) {
        ws.onopen = null;   // sab handlers hata do
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, [connect]);

  const sendQuery = useCallback(({ space, gqls, msgType = 'batch_ngql' }) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const msgId = crypto.randomUUID();

      const message = {
        header: { msgId, version: '1.0' },
        body: {
          product: 'Studio',
          msgType,
          content: msgType === 'batch_ngql'
            ? { space, gqls: Array.isArray(gqls) ? gqls : [gqls] }
            : { space, gql: Array.isArray(gqls) ? gqls[0] : gqls },
        },
      };

      pendingRef.current[msgId] = resolve;

      setTimeout(() => {
        if (pendingRef.current[msgId]) {
          delete pendingRef.current[msgId];
          reject(new Error('Query timeout (30s)'));
        }
      }, 30000);

      wsRef.current.send(JSON.stringify(message));
    });
  }, []);

  // Send a get_schema request and resolve with { tags, edgeTypes }
  const sendSchema = useCallback((spaceName) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const msgId = crypto.randomUUID();
      const message = {
        header: { msgId, version: '1.0' },
        body: {
          product: 'Studio',
          msgType: 'get_schema',
          content: { space: spaceName },
        },
      };

      pendingRef.current[msgId] = (response) => {
        if (response.type === 'error') {
          reject(new Error(response.message || 'Schema fetch failed'));
        } else {
          resolve(response.payload || { tags: [], edgeTypes: [] });
        }
      };

      setTimeout(() => {
        if (pendingRef.current[msgId]) {
          delete pendingRef.current[msgId];
          reject(new Error('Schema timeout'));
        }
      }, 30000);

      wsRef.current.send(JSON.stringify(message));
    });
  }, []);

  return (
    <WsContext.Provider value={{ isConnected, isConnecting, sendQuery, sendSchema }}>
      {children}
    </WsContext.Provider>
  );
}

export function useWs() {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error('useWs must be used inside WsProvider');
  return ctx;
}
