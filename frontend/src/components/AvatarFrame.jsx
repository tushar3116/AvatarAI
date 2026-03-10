import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export default function AvatarFrame({ isProcessing, isSpeaking, latestAudio }) {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const animFrameRef = useRef(null);

  // Play audio when new response arrives
  useEffect(() => {
    if (latestAudio && audioRef.current) {
      audioRef.current.src = latestAudio;
      audioRef.current.muted = isMuted;
      audioRef.current.play().catch(err => console.error('Audio play error:', err));
    }
  }, [latestAudio]);

  // Avatar idle animation on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width = 400;
    const h = canvas.height = 400;
    let time = 0;

    const draw = () => {
      time += 0.02;
      ctx.clearRect(0, 0, w, h);

      // Background gradient
      const gradient = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
      gradient.addColorStop(0, '#1e1b4b');
      gradient.addColorStop(1, '#0a0a0f');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // Floating orbs (ambient)
      for (let i = 0; i < 5; i++) {
        const x = w/2 + Math.cos(time + i * 1.3) * (60 + i * 20);
        const y = h/2 + Math.sin(time * 0.7 + i * 1.5) * (40 + i * 15);
        const r = 3 + Math.sin(time + i) * 2;
        const orbGrad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        orbGrad.addColorStop(0, 'rgba(99, 102, 241, 0.6)');
        orbGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
        ctx.fillStyle = orbGrad;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Central avatar circle
      const breathe = 1 + Math.sin(time * 0.8) * 0.03;
      const avatarR = 80 * breathe;

      // Outer glow
      const glowGrad = ctx.createRadialGradient(w/2, h/2, avatarR * 0.8, w/2, h/2, avatarR * 1.8);
      glowGrad.addColorStop(0, isPlaying ? 'rgba(139, 92, 246, 0.15)' : 'rgba(99, 102, 241, 0.1)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(w/2, h/2, avatarR * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Avatar ring
      ctx.strokeStyle = isPlaying
        ? `rgba(139, 92, 246, ${0.5 + Math.sin(time * 3) * 0.3})`
        : `rgba(99, 102, 241, ${0.3 + Math.sin(time) * 0.15})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w/2, h/2, avatarR, 0, Math.PI * 2);
      ctx.stroke();

      // Inner circle
      const innerGrad = ctx.createRadialGradient(w/2, h/2 - 10, 0, w/2, h/2, avatarR);
      innerGrad.addColorStop(0, isPlaying ? '#4c1d95' : '#1e1b4b');
      innerGrad.addColorStop(1, '#0f0a2a');
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(w/2, h/2, avatarR - 3, 0, Math.PI * 2);
      ctx.fill();

      // Sound wave visualization when speaking
      if (isPlaying) {
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
        ctx.lineWidth = 1.5;
        for (let ring = 1; ring <= 3; ring++) {
          const ringR = avatarR + ring * 20 + Math.sin(time * 4 + ring) * 5;
          const alpha = 0.4 - ring * 0.1;
          ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
          ctx.beginPath();
          ctx.arc(w/2, h/2, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // AI text
      ctx.font = '600 18px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText('AI', w/2, h/2 + 6);

      // Status text
      ctx.font = '400 11px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      const statusText = isPlaying ? '● Speaking' : isProcessing ? '● Thinking...' : '● Ready';
      ctx.fillText(statusText, w/2, h/2 + 28);

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isProcessing, isPlaying]);

  const handleAudioPlay = () => setIsPlaying(true);
  const handleAudioEnd = () => setIsPlaying(false);
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) audioRef.current.muted = !isMuted;
  };

  return (
    <div className="avatar-frame w-full h-full relative flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      />

      {/* Mute toggle */}
      <button
        onClick={toggleMute}
        className="absolute bottom-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4 text-white/50" />
        ) : (
          <Volume2 className="w-4 h-4 text-white/50" />
        )}
      </button>

      {/* Processing indicator */}
      {isProcessing && !isPlaying && (
        <div className="absolute bottom-4 left-4">
          <div className="status-badge processing">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Processing
          </div>
        </div>
      )}

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onPlay={handleAudioPlay}
        onEnded={handleAudioEnd}
        onPause={handleAudioEnd}
      />
    </div>
  );
}
