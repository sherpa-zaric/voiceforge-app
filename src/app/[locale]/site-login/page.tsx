'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SiteLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/tts';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/site-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(from);
        router.refresh();
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('Failed to verify password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            Voice<span className="text-primary">Forge</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This site is currently in development. Enter password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter site password"
              autoFocus
              className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-4 py-3 focus:outline-none"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Verifying...' : 'Enter Site'}
          </button>
        </form>
      </div>
    </div>
  );
}
