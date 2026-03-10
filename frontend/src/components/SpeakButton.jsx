import { useCallback, useEffect, useRef } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';

export default function SpeakButton({ isRecording, audioLevel, onStartRecording, onStopRecording, isConnected, isProcessing }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const levelRef = useRef(0);

  // Smooth audio level
  useEffect(() => {
    levelRef.current = audioLevel;
  }, [audioLevel]);

  // Waveform canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width = 280;
    const h = canvas.height = 48;
    let time = 0;

    const draw = () => {
      time += 0.05;
      ctx.clearRect(0, 0, w, h);

      if (isRecording) {
        const level = levelRef.current;
        const bars = 32;
        const barW = 4;
        const gap = (w - bars * barW) / (bars + 1);

        for (let i = 0; i < bars; i++) {
          const x = gap + i * (barW + gap);
          const intensity = Math.sin(time * 3 + i * 0.3) * 0.5 + 0.5;
          const barH = 4 + (h - 8) * intensity * Math.max(level, 0.15);

          const gradient = ctx.createLinearGradient(x, h/2 - barH/2, x, h/2 + barH/2);
          gradient.addColorStop(0, 'rgba(244, 63, 94, 0.8)');
          gradient.addColorStop(1, 'rgba(244, 63, 94, 0.3)');
          ctx.fillStyle = gradient;

          ctx.beginPath();
          ctx.roundRect(x, h/2 - barH/2, barW, barH, 2);
          ctx.fill();
        }
      } else if (isProcessing) {
        // Shimmer line when processing
        const x = (time * 40) % (w + 80) - 40;
        const gradient = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0)');
        gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.4)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, h/2 - 1, w, 2);
      } else {
        // Idle wave
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const y = h/2 + Math.sin(time + x * 0.03) * 3;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isRecording, isProcessing]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    if (isConnected && !isRecording) {
      onStartRecording();
    }
  }, [isConnected, isRecording, onStartRecording]);

  const handleMouseUp = useCallback((e) => {
    e.preventDefault();
    if (isRecording) {
      onStopRecording();
    }
  }, [isRecording, onStopRecording]);

  return (
    <div className="flex items-center gap-6">
      {/* Waveform */}
      <canvas
        ref={canvasRef}
        className="hidden sm:block"
        style={{ width: 280, height: 48 }}
      />

      {/* Speak Button */}
      <div className="relative">
        <button
          className={`speak-btn ${isRecording ? 'recording' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchEnd={handleMouseUp}
          disabled={!isConnected}
          style={{ opacity: isConnected ? 1 : 0.4 }}
        >
          {isRecording ? (
            <Square className="w-6 h-6" fill="white" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
          {(isRecording || isProcessing) && <span className="ring" />}
          {isRecording && <span className="ring" style={{ animationDelay: '0.5s' }} />}
        </button>
      </div>

      {/* Waveform (right side mirror) */}
      <div className="hidden sm:flex items-center gap-1">
        <p className="text-xs text-white/30">
          {!isConnected ? 'Not connected' :
           isRecording ? 'Release to send' :
           isProcessing ? 'AI is thinking...' :
           'Hold to speak'}
        </p>
      </div>
    </div>
  );
}
