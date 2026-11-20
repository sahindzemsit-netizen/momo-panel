'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { cn, formatWhatsAppLink } from '@/lib/utils';

interface WhatsAppButtonProps {
  phone: string;
  country?: string;
  className?: string;
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({ phone, country, className }) => {
  if (!phone) return null;

  const link = formatWhatsAppLink(phone, country);

  return (
    <a
      href={link}
      target="whatsapp_web"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 mt-0.5 group",
        className
      )}
      title={`Contact ${phone} via WhatsApp`}
    >
      <MessageCircle className="w-3 h-3 fill-emerald-500/10" />
      <span className="truncate max-w-[120px]">{phone}</span>
    </a>
  );
};

export default WhatsAppButton;
