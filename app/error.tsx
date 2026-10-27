'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#FDFCF0] p-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong!</h2>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-[#0E0C0B] text-white rounded-md hover:bg-opacity-90 transition-all"
      >
        Try again
      </button>
    </div>
  );
}
