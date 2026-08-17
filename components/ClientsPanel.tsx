'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserIcon, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, guessGenderFromName } from '@/lib/utils';
import { Client } from '@/types';
import ClientCard from './ClientCard';

interface ClientsPanelProps {
  isDarkMode: boolean;
  clients: Client[];
}

const ITEMS_PER_PAGE = 6;

export default function ClientsPanel({ isDarkMode, clients }: ClientsPanelProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 40);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredClients = React.useMemo(() => {
    return clients.filter(client => {
      const name = (client.name || '').toLowerCase();
      const email = (client.email || '').toLowerCase();
      const phone = (client.phone || '').toLowerCase();
      const licenseId = (client.licenseId || '').toLowerCase();
      const passportId = (client.passportId || '').toLowerCase();
      const query = debouncedSearchQuery.toLowerCase();

      return name.includes(query) ||
             email.includes(query) ||
             phone.includes(query) ||
             licenseId.includes(query) ||
             passportId.includes(query);
    }).map(client => ({
      ...client,
      gender: client.gender || guessGenderFromName(client.name || '')
    }));
  }, [clients, debouncedSearchQuery]);

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedClients = filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  return (
    <div className={cn(
      "flex-1 md:ml-[266px] h-screen transition-colors duration-500 pt-4 md:pr-4 md:pb-4 md:pl-0 flex flex-col overflow-y-auto no-scrollbar",
      isDarkMode ? "bg-[#1E1B1A]" : "bg-white"
    )}>
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className={cn(
              "text-2xl font-black tracking-tight",
              isDarkMode ? "text-white" : "text-gray-900"
            )}>CLIENTS</h1>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              {filteredClients.length} CLIENTS REGISTERED
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="SEARCH CLIENTS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "pl-10 pr-4 py-2 rounded-xl text-[10px] font-black tracking-widest outline-none border-2 transition-all w-full sm:w-64",
                  isDarkMode 
                    ? "bg-[#1A1614] border-white/5 text-white focus:border-orange-500" 
                    : "bg-gray-50 border-gray-100 text-gray-900 focus:border-orange-500"
                )}
              />
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={cn(
                    "p-2 rounded-xl border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                    isDarkMode ? "border-white/5 hover:bg-white/5 text-white" : "border-[#F2EFE9] bg-white/50 text-[#0E0C0B]"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {(() => {
                    let startPage = 1;
                    let endPage = totalPages;
                    if (totalPages > 5) {
                      startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                      endPage = startPage + 4;
                    }
                    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "w-8 h-8 rounded-xl font-black text-[10px] transition-all cursor-pointer",
                          currentPage === pageNum
                            ? "bg-[#FF5C35] text-white shadow-lg shadow-[#FF5C35]/20"
                            : (isDarkMode ? "text-gray-400 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100")
                        )}
                      >
                        {pageNum}
                      </button>
                    ));
                  })()}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={cn(
                    "p-2 rounded-xl border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                    isDarkMode ? "border-white/5 hover:bg-white/5 text-white" : "border-[#F2EFE9] bg-white/50 text-[#0E0C0B]"
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage + searchQuery}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {paginatedClients.map((client, index) => (
              <ClientCard 
                key={client.id}
                client={client}
                index={index}
                isDarkMode={isDarkMode}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredClients.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center mb-4",
              isDarkMode ? "bg-white/5" : "bg-gray-100"
            )}>
              <UserIcon className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className={cn(
              "text-lg font-black uppercase tracking-tight",
              isDarkMode ? "text-white" : "text-gray-900"
            )}>
              No Clients Found
            </h3>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">
              Try adjusting your search query
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
