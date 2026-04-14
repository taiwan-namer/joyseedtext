import React from 'react';

export const TrainIcon = ({ className = '', width = 160, height = 120 }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 160 120" 
    width={width} 
    height={height} 
    className={className}
  >
    {/* 軌道 */}
    <path d="M20 110 L140 110" stroke="#4A3B32" strokeWidth="4" strokeLinecap="round" />
    <path d="M30 105 L30 115 M50 105 L50 115 M70 105 L70 115 M90 105 L90 115 M110 105 L110 115 M130 105 L130 115" stroke="#4A3B32" strokeWidth="4" strokeLinecap="round" />

    {/* 煙霧 */}
    <path d="M80 40 C70 40 70 25 85 25 C85 15 105 15 110 25 C125 25 125 40 115 40 Z" fill="#FFFFFF" stroke="#4A3B32" strokeWidth="3" strokeLinejoin="round" />
    <circle cx="125" cy="20" r="5" fill="#FFFFFF" stroke="#4A3B32" strokeWidth="3" />
    <circle cx="70" cy="15" r="4" fill="#FFFFFF" stroke="#4A3B32" strokeWidth="3" />

    {/* 車廂主體 (黃色/木紋) */}
    <rect x="85" y="55" width="45" height="40" rx="4" fill="#F4C553" stroke="#4A3B32" strokeWidth="3" />
    <rect x="90" y="62" width="15" height="15" rx="2" fill="#E8F4F8" stroke="#4A3B32" strokeWidth="3" />
    <rect x="110" y="62" width="15" height="15" rx="2" fill="#E8F4F8" stroke="#4A3B32" strokeWidth="3" />
    <path d="M80 55 L135 55 L130 45 L85 45 Z" fill="#E26A50" stroke="#4A3B32" strokeWidth="3" strokeLinejoin="round" />

    {/* 鍋爐主體 (紅色) */}
    <path d="M40 95 L85 95 L85 60 L40 60 C30 60 30 95 40 95 Z" fill="#E26A50" stroke="#4A3B32" strokeWidth="3" strokeLinejoin="round" />
    
    {/* 煙囪 */}
    <path d="M55 60 L55 40 L45 40 L45 60 Z" fill="#E26A50" stroke="#4A3B32" strokeWidth="3" />
    <path d="M40 40 L60 40 L65 30 L35 30 Z" fill="#4A3B32" stroke="#4A3B32" strokeWidth="3" strokeLinejoin="round" />

    {/* 車頭微笑與細節 */}
    <circle cx="45" cy="75" r="2.5" fill="#4A3B32" />
    <circle cx="60" cy="75" r="2.5" fill="#4A3B32" />
    <path d="M45 85 Q52.5 90 60 85" fill="none" stroke="#4A3B32" strokeWidth="3" strokeLinecap="round" />

    {/* 排障器 (前方黃色護欄) */}
    <path d="M25 100 L40 100 L45 85 L35 85 Z" fill="#F4C553" stroke="#4A3B32" strokeWidth="3" strokeLinejoin="round" />
    
    {/* 車輪 */}
    <circle cx="55" cy="100" r="10" fill="#9CA3AF" stroke="#4A3B32" strokeWidth="3" />
    <circle cx="55" cy="100" r="3" fill="#4A3B32" />
    <circle cx="95" cy="100" r="10" fill="#9CA3AF" stroke="#4A3B32" strokeWidth="3" />
    <circle cx="95" cy="100" r="3" fill="#4A3B32" />
    <circle cx="120" cy="100" r="10" fill="#9CA3AF" stroke="#4A3B32" strokeWidth="3" />
    <circle cx="120" cy="100" r="3" fill="#4A3B32" />

    {/* 車輪連桿 */}
    <path d="M55 100 L120 100" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
    <path d="M55 100 L120 100" stroke="#4A3B32" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
