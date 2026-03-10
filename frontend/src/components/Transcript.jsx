import { useEffect, useRef } from 'react';
import { User, Bot, Trash2 } from 'lucide-react';

export default function Transcript({ messages, onClear }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (timestamp) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white/90 tracking-wide uppercase">Transcript</h2>
          <p className="text-xs text-white/40 mt-1">Live conversation log</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={onClear}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            title="Clear transcript"
          >
            <Trash2 className="w-3.5 h-3.5 text-white/30" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
            <Bot className="w-8 h-8 mb-3 text-indigo-400" />
            <p className="text-sm text-white/50">No messages yet</p>
            <p className="text-xs text-white/30 mt-1">Start a conversation by holding the speak button</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
              <div className={`flex gap-3 ${msg.role === 'user' ? '' : ''}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === 'user'
                    ? 'bg-emerald-500/15'
                    : 'bg-indigo-500/15'
                }`}>
                  {msg.role === 'user'
                    ? <User className="w-3.5 h-3.5 text-emerald-400" />
                    : <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium ${
                      msg.role === 'user' ? 'text-emerald-400/80' : 'text-indigo-400/80'
                    }`}>
                      {msg.role === 'user' ? 'You' : 'AI Avatar'}
                    </span>
                    <span className="text-[10px] text-white/20">{formatTime(msg.timestamp)}</span>
                  </div>
                  <p className="text-sm text-white/75 leading-relaxed">{msg.text}</p>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
