'use client';

import { useState } from 'react';

interface ContinueButtonProps {
  taskId: string;
}

export function ContinueButton({ taskId }: ContinueButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleContinue = async () => {
    setIsLoading(true);
    setStatus('idle');

    try {
      const res = await fetch('/api/tts/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });

      const data = await res.json();
      if (data.code !== 0) {
        throw new Error(data.message || 'Failed to continue task');
      }

      setStatus('success');
      // Reload the page to reflect the updated status
      window.location.reload();
    } catch (err) {
      console.error('Continue task failed:', err);
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'success') {
    return (
      <span className="text-green-600 text-xs">
        Resumed!
      </span>
    );
  }

  return (
    <button
      onClick={handleContinue}
      disabled={isLoading}
      className="text-primary hover:text-primary/80 cursor-pointer text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? 'Resuming...' : 'Continue'}
    </button>
  );
}
