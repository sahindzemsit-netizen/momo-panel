import React from 'react';

interface WhyIconProps {
  className?: string;
}

export default function WhyIcon({ className = "w-10 h-10" }: WhyIconProps) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg 
        viewBox="0 0 120 110" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        {/* The Speech Bubble with tail */}
        <path 
          d="M20,10 H100 C110,10 115,15 115,25 V60 C115,70 110,75 100,75 H50 L30,95 V75 H20 C10,75 5,70 5,60 V25 C5,15 10,10 20,10 Z" 
          fill="white"
          stroke="black"
          strokeWidth="6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Text "Why" */}
        <text 
          x="18" 
          y="52" 
          fill="black" 
          style={{ 
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 900,
            fontSize: '32px',
            letterSpacing: '-0.03em'
          }}
        >
          Why
        </text>

        {/* Question Mark */}
        <text 
          x="75" 
          y="102" 
          fill="#FF3B30" 
          style={{ 
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 900,
            fontSize: '68px'
          }}
          className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.2)]"
        >
          ?
        </text>
      </svg>
    </div>
  );
}
