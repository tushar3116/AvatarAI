import { useState, useRef, useCallback, useEffect } from 'react';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/v1/ws`;

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [status, setStatus] = useState('Disconnected');
  const [isProcessing, setIsProcessing] = useState(false);
  const [latestAudio, setLatestAudio] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback((collectionName) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setStatus('Connected');
      // Send session start
      ws.send(JSON.stringify({
        type: 'session_start',
        collection_name: collectionName,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'transcript':
            setTranscript(prev => [...prev, { role: 'user', text: msg.data, timestamp: Date.now() }]);
            setIsProcessing(true);
            break;

          case 'agent_reply':
            setTranscript(prev => [...prev, { role: 'ai', text: msg.data, timestamp: Date.now() }]);
            break;

          case 'audio_response':
            if (msg.audio_base64) {
              const audioBytes = Uint8Array.from(atob(msg.audio_base64), c => c.charCodeAt(0));
              const blob = new Blob([audioBytes], { type: 'audio/mp3' });
              const url = URL.createObjectURL(blob);
              setLatestAudio(url);
            }
            setIsProcessing(false);
            break;

          case 'status':
            setStatus(msg.data);
            break;

          case 'error':
            setStatus(`Error: ${msg.data}`);
            setIsProcessing(false);
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('WS message parse error:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setStatus('Disconnected');
      // Auto-reconnect after 3s
      reconnectTimer.current = setTimeout(() => {
        if (collectionName) connect(collectionName);
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      setStatus('Connection error');
    };
  }, []);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendAudio = useCallback((audioBlob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      audioBlob.arrayBuffer().then(buffer => {
        wsRef.current.send(buffer);
      });
    }
  }, []);

  const sendStop = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      setIsProcessing(false);
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    transcript,
    status,
    isProcessing,
    latestAudio,
    connect,
    disconnect,
    sendAudio,
    sendStop,
    clearTranscript,
  };
}
