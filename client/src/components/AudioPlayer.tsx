import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface AudioPlayerProps {
  src: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
  /** Jump to a specific time in seconds */
  seekTo?: number;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Downsample audio buffer to N bars for waveform display */
function generateWaveformData(audioBuffer: AudioBuffer, bars: number): number[] {
  const rawData = audioBuffer.getChannelData(0);
  const samplesPerBar = Math.floor(rawData.length / bars);
  const waveform: number[] = [];

  for (let i = 0; i < bars; i++) {
    let sum = 0;
    const start = i * samplesPerBar;
    for (let j = 0; j < samplesPerBar; j++) {
      sum += Math.abs(rawData[start + j] || 0);
    }
    waveform.push(sum / samplesPerBar);
  }

  // Normalize to 0-1
  const max = Math.max(...waveform, 0.001);
  return waveform.map(v => v / max);
}

function Waveform({
  data,
  progress,
  duration,
  onSeek,
  isLoading,
  compact,
}: {
  data: number[];
  progress: number;
  duration: number;
  onSeek: (time: number) => void;
  isLoading: boolean;
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barCount = data.length;
  const height = compact ? 40 : 56;
  const barWidth = 2;
  const gap = 1.5;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    onSeek(fraction * duration);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return; // Only while dragging
    handleClick(e);
  };

  return (
    <div
      ref={containerRef}
      className="relative cursor-pointer group select-none"
      style={{ height }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
    >
      {/* Waveform bars */}
      <svg
        width="100%"
        height={height}
        preserveAspectRatio="none"
        viewBox={`0 0 ${barCount * (barWidth + gap)} ${height}`}
        className="block"
      >
        {data.map((amplitude, i) => {
          const barHeight = Math.max(2, amplitude * (height - 4));
          const x = i * (barWidth + gap);
          const y = (height - barHeight) / 2;
          const barProgress = i / barCount;
          const isPlayed = barProgress <= progress / 100;

          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={1}
              className={`transition-colors duration-75 ${
                isPlayed
                  ? "fill-primary"
                  : "fill-muted-foreground/25 group-hover:fill-muted-foreground/40"
              }`}
            />
          );
        })}
      </svg>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded">
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="w-1 bg-primary/60 rounded-full animate-pulse"
                style={{
                  height: 12 + Math.random() * 16,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AudioPlayer({ src, title, subtitle, compact = false, className = "", seekTo }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [waveformLoading, setWaveformLoading] = useState(true);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Generate placeholder waveform for initial display
  const placeholderWaveform = useMemo(() => {
    const bars = compact ? 60 : 120;
    return Array.from({ length: bars }, (_, i) => {
      // Create a natural-looking fake waveform with some randomness
      const base = 0.3 + 0.4 * Math.sin(i * 0.08) * Math.sin(i * 0.03);
      return Math.max(0.05, Math.min(1, base + (Math.random() * 0.3 - 0.15)));
    });
  }, [compact]);

  // Decode audio and generate waveform data
  useEffect(() => {
    if (!src) return;
    let cancelled = false;

    const loadWaveform = async () => {
      setWaveformLoading(true);
      try {
        const response = await fetch(src);
        if (cancelled) return;
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        if (cancelled) return;

        const bars = compact ? 60 : 120;
        const data = generateWaveformData(audioBuffer, bars);
        setWaveformData(data);
      } catch (err) {
        console.warn("[AudioPlayer] Waveform generation failed:", err);
        // Keep placeholder waveform on error
      } finally {
        if (!cancelled) setWaveformLoading(false);
      }
    };

    loadWaveform();
    return () => { cancelled = true; };
  }, [src, compact]);

  // Update time display via requestAnimationFrame for smooth progress
  const updateTime = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updateTime);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updateTime);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, updateTime]);

  // Handle seekTo prop changes
  useEffect(() => {
    if (seekTo !== undefined && audioRef.current && duration > 0) {
      audioRef.current.currentTime = seekTo;
      setCurrentTime(seekTo);
    }
  }, [seekTo, duration]);

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {
        setError("Unable to play audio");
      });
    }
  };

  const handleSeek = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleSliderSeek = (value: number[]) => {
    handleSeek(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0];
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayWaveform = waveformData.length > 0 ? waveformData : placeholderWaveform;

  if (error) {
    return (
      <div className={`rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive ${className}`}>
        Unable to load audio: {error}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm ${className}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
            setIsLoading(false);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setError("Failed to load audio file");
          setIsLoading(false);
        }}
        onCanPlay={() => setIsLoading(false)}
      />

      <div className={compact ? "p-3" : "p-4"}>
        {/* Title bar */}
        {(title || subtitle) && !compact && (
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Volume2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              {title && <p className="truncate text-sm font-medium">{title}</p>}
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
        )}

        {/* Waveform visualization */}
        <div className="mb-2">
          <Waveform
            data={displayWaveform}
            progress={progress}
            duration={duration}
            onSeek={handleSeek}
            isLoading={isLoading && waveformLoading}
            compact={compact}
          />
        </div>

        {/* Time display */}
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{isLoading ? "Loading..." : formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => skip(-10)}
              disabled={isLoading}
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="default"
              size="icon"
              className={`${compact ? "h-9 w-9" : "h-10 w-10"} rounded-full`}
              onClick={togglePlay}
              disabled={isLoading}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => skip(10)}
              disabled={isLoading}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Volume control */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleMute}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            {!compact && (
              <Slider
                value={[isMuted ? 0 : volume]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
