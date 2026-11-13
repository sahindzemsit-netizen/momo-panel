import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#FDFCF0] p-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Not Found</h2>
      <p className="text-gray-600 mb-6">Could not find requested resource</p>
      <Link
        href="/"
        className="px-4 py-2 bg-[#0E0C0B] text-white rounded-md hover:bg-opacity-90 transition-all"
      >
        Return Home
      </Link>
    </div>
  );
}
