'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Volume2, VolumeX, Radio, ScanBarcode } from 'lucide-react';
import { sound } from '@/lib/sound';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actionButton?: React.ReactNode;
}

export function Header({ title, subtitle, actionButton }: HeaderProps) {
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setIsMuted(sound.getMuted());
  }, []);

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  return (
    <header className="h-16 px-6 border-b border-neutral-800 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-base font-semibold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Server & DB Status badge */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Core Live</span>
        </div>

        {/* Audio feedback toggle */}
        <button
          onClick={handleToggleSound}
          title={isMuted ? 'Scanner Audio Muted (Click to Unmute)' : 'Scanner Audio Enabled'}
          className={`p-2 rounded-lg border transition text-xs flex items-center gap-1.5 ${
            isMuted
              ? 'border-neutral-800 text-neutral-500 hover:text-neutral-300 bg-neutral-900'
              : 'border-blue-900/60 bg-blue-950/40 text-blue-400 hover:bg-blue-950/70'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          <span className="text-[11px] font-medium hidden md:inline">
            {isMuted ? 'Muted' : 'Audio Chime'}
          </span>
        </button>

        {actionButton}
      </div>
    </header>
  );
}
