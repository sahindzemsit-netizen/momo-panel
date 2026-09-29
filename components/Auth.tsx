'use client';

import React from 'react';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import Image from 'next/image';
import { LogIn, LogOut, User, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppState } from '@/lib/context';

export function LoginButton({ className }: { className?: string }) {
  const [errorStatus, setErrorStatus] = React.useState<{ message: string; type: 'error' | 'warning' } | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const handleLogin = async () => {
    setErrorStatus(null);
    setIsPending(true);
    const provider = new GoogleAuthProvider();
    // Force account selection to avoid potential state issues with stuck sessions
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      // Explicitly using signInWithPopup to avoid mobile redirect state issues
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string; customData?: Record<string, unknown> };
      console.error("Login failed details:", error);
      
      // Specifically check for storage/cookie blocking which is common in mobile browsers or incognito
      const isCookieError = 
        error.code === 'auth/internal-error' || 
        error.code === 'auth/operation-not-supported-in-this-environment' ||
        error.code === 'auth/web-storage-unsupported' ||
        error.message?.toLowerCase().includes('storage') || 
        error.message?.toLowerCase().includes('cookie');

      // Check if it's the specific permission-denied error from blocking function
      // Custom errors from blocking functions often manifest as auth/internal-error 
      // but containing the specific message in the details or customData.
      const isPermissionDenied = 
        error.code === 'permission-denied' || 
        error.message?.toLowerCase().includes('permission-denied') ||
        error.message?.toLowerCase().includes('access denied') ||
        (error.code === 'auth/internal-error' && (
          error.message?.includes('Cloud function error') || 
          JSON.stringify(error).toLowerCase().includes('permission-denied')
        ));

      if (isPermissionDenied) {
        setErrorStatus({ 
          message: "Access Denied: You are not authorized to access this portal. Please contact an administrator.", 
          type: 'error' 
        });
      } else if (isCookieError) {
        setErrorStatus({ 
          message: "Browser Error: Cookies or local storage are being blocked. Please enable them and try again.", 
          type: 'warning' 
        });
      } else if (error.code === 'auth/popup-closed-by-user' || error.message?.includes('auth/popup-closed-by-user')) {
        // Just reset pending state, no error needed for user closing popup
        setErrorStatus(null);
      } else {
        setErrorStatus({ 
          message: `Login failed: ${error.message || 'Unknown error'}. Please try again.`, 
          type: 'error' 
        });
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full items-center">
      <button
        onClick={handleLogin}
        disabled={isPending}
        className={cn(
          "flex items-center gap-2 px-4 py-2 bg-[#FF5C35] hover:bg-[#FF7D5E] text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-[#FF5C35]/20 disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
      >
        {isPending ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <LogIn className="w-4 h-4" />
        )}
        <span>{isPending ? 'SIGNING IN...' : 'SIGN IN WITH GOOGLE'}</span>
      </button>

      {errorStatus && (
        <div className={cn(
          "p-4 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 w-full max-w-xs text-center border shadow-sm",
          errorStatus.type === 'error' 
            ? "bg-red-500/10 text-red-500 border-red-500/20" 
            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
        )}>
          {errorStatus.message}
        </div>
      )}
    </div>
  );
}

export function UserProfile({ isDarkMode }: { isDarkMode: boolean }) {
  const user = auth.currentUser;
  const { isAdmin } = useAppState();

  if (!user) return <LoginButton />;

  return (
    <div className={cn(
      "flex items-center gap-3 p-2 rounded-2xl border",
      isDarkMode ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"
    )}>
      {user.photoURL ? (
        <div className="relative w-8 h-8">
          <Image 
            src={user.photoURL} 
            alt={user.displayName || 'User'} 
            fill
            sizes="32px"
            className="rounded-full border border-[#FF5C35]/50 object-cover"
            priority
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full bg-[#FF5C35] flex items-center justify-center text-white font-bold">
          {user.displayName?.charAt(0) || <User className="w-4 h-4" />}
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <span className={cn(
          "text-[10px] font-bold truncate",
          isDarkMode ? "text-white" : "text-gray-900"
        )}>
          {user.displayName?.toUpperCase()}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-gray-500 font-bold truncate lowercase">
            {user.email}
          </span>
          {isAdmin && (
            <ShieldCheck className="w-2.5 h-2.5 text-[#FF5C35]" />
          )}
        </div>
      </div>
      <button 
        onClick={() => signOut(auth)}
        className="ml-auto p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors text-gray-500"
        title="Sign Out"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
