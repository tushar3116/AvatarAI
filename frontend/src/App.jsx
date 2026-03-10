import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Wifi, WifiOff, Settings, Radio, Database,
  ChevronLeft, ChevronRight, Sparkles
} from 'lucide-react';
import FileUpload from './components/FileUpload';
import AvatarFrame from './components/AvatarFrame';
import Transcript from './components/Transcript';
import SpeakButton from './components/SpeakButton';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioRecorder } from './hooks/useAudioRecorder';

export default function App() {
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const ws = useWebSocket();
  const recorder = useAudioRecorder();

  // Fetch collections on mount
  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/v1/collections');
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections || []);
      }
    } catch {
      // Backend might not be running yet
    }
  };

  // Handle file ingestion
  const handleFileIngested = useCallback((collectionName) => {
    fetchCollections();
    setSelectedCollection(collectionName);
    ws.connect(collectionName);
  }, [ws]);

  // Handle collection selection
  const handleSelectCollection = useCallback((name) => {
    setSelectedCollection(name);
    ws.connect(name);
  }, [ws]);

  // Handle recording start — also sends interrupt
  const handleStartRecording = useCallback(async () => {
    // Send stop signal to interrupt any in-flight processing
    ws.sendStop();
    await recorder.startRecording();
  }, [ws, recorder]);

  // Handle recording stop — sends audio to backend
  const handleStopRecording = useCallback(async () => {
    const audioBlob = await recorder.stopRecording();
    if (audioBlob && audioBlob.size > 0) {
      ws.sendAudio(audioBlob);
    }
  }, [ws, recorder]);

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      {/* ═══ Top Bar ═══ */}
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white/90 tracking-tight">
              AI Avatar <span className="gradient-text">Command Center</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className={`status-badge ${ws.isConnected ? 'success' : selectedCollection ? 'processing' : 'error'}`}>
            {ws.isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {ws.isConnected ? 'Connected' : selectedCollection ? 'Reconnecting...' : 'Upload to Start'}
          </div>

          {/* Collection selector */}
          {collections.length > 0 && (
            <select
              value={selectedCollection || ''}
              onChange={(e) => handleSelectCollection(e.target.value)}
              className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white/70 outline-none focus:border-indigo-500/50 cursor-pointer"
            >
              <option value="" disabled>Select Knowledge Base</option>
              {collections.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          )}

          <div className="text-[10px] text-white/20 hidden md:block">
            {ws.status}
          </div>
        </div>
      </header>

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── Left Panel: Knowledge Base ─── */}
        <aside className={`border-r border-white/5 transition-all duration-300 shrink-0 ${
          leftPanelOpen ? 'w-72' : 'w-0'
        } overflow-hidden`}>
          <div className="w-72 h-full">
            <FileUpload
              onFileIngested={handleFileIngested}
              collections={collections}
            />
          </div>
        </aside>

        {/* Left Panel Toggle */}
        <button
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          className="w-5 shrink-0 flex items-center justify-center hover:bg-white/5 transition-colors border-r border-white/5"
        >
          {leftPanelOpen ? <ChevronLeft className="w-3 h-3 text-white/20" /> : <ChevronRight className="w-3 h-3 text-white/20" />}
        </button>

        {/* ─── Center: Avatar + Controls ─── */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Avatar Area */}
          <div className="flex-1 p-4 flex items-center justify-center">
            <div className="w-full h-full max-w-2xl max-h-[500px]">
              <AvatarFrame
                isProcessing={ws.isProcessing}
                isSpeaking={recorder.isRecording}
                latestAudio={ws.latestAudio}
              />
            </div>
          </div>

          {/* Controls Bar */}
          <div className="h-24 border-t border-white/5 flex items-center justify-center px-6">
            <SpeakButton
              isRecording={recorder.isRecording}
              audioLevel={recorder.audioLevel}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              isConnected={ws.isConnected}
              isProcessing={ws.isProcessing}
            />
          </div>
        </main>

        {/* Right Panel Toggle */}
        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className="w-5 shrink-0 flex items-center justify-center hover:bg-white/5 transition-colors border-l border-white/5"
        >
          {rightPanelOpen ? <ChevronRight className="w-3 h-3 text-white/20" /> : <ChevronLeft className="w-3 h-3 text-white/20" />}
        </button>

        {/* ─── Right Panel: Transcript ─── */}
        <aside className={`border-l border-white/5 transition-all duration-300 shrink-0 ${
          rightPanelOpen ? 'w-80' : 'w-0'
        } overflow-hidden`}>
          <div className="w-80 h-full">
            <Transcript
              messages={ws.transcript}
              onClear={ws.clearTranscript}
            />
          </div>
        </aside>
      </div>

      {/* ═══ Bottom Status Bar ═══ */}
      <footer className="h-7 border-t border-white/5 flex items-center justify-between px-4 text-[10px] text-white/20 shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Database className="w-2.5 h-2.5" />
            {collections.length} collection{collections.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Radio className="w-2.5 h-2.5" />
            WebSocket {ws.isConnected ? 'active' : 'inactive'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Zap className="w-2.5 h-2.5" />
          GPT-4o + Whisper + ElevenLabs
        </div>
      </footer>
    </div>
  );
}
