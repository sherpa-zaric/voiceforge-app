'use client';

import type { DesignPreset as DesignPresetType } from '../types';

interface DesignPresetProps {
  presets: DesignPresetType[];
  onSelect: (description: string) => void;
}

export function DesignPresets({ presets, onSelect }: DesignPresetProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.description)}
          className="bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
          type="button"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
