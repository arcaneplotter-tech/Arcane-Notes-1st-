import React from 'react';
import { 
  AlertTriangle, Lightbulb, AlertCircle, BookOpen, CheckSquare, 
  Info, Calculator, MessageSquare, ArrowRight, Clock, Star, ClipboardList, Check, Brain,
  Plus, X, Image as ImageIcon, Type, Move, AlignLeft, AlignCenter, AlignRight, Square, Maximize2, Settings, GripVertical
} from 'lucide-react';

interface GameIconProps {
  name: string;
  theme?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const GameIcon: React.FC<GameIconProps> = ({ name, theme, className, style }) => {
  if (theme === 'minecraft') {
    switch (name) {
      case 'AlertTriangle':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M7 2h2v2H7V2zm0 3h2v6H7V5zm0 7h2v2H7v-2z" />
            <path fillRule="evenodd" d="M1 14V2h14v12H1zM0 1v14h16V1H0z" clipRule="evenodd" opacity="0.2" />
          </svg>
        );
      case 'Lightbulb':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M6 2h4v2H6V2zm-1 3h6v4H5V5zm1 5h4v2H6v-2zm1 3h2v1H7v-1z" />
          </svg>
        );
      case 'BookOpen':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M2 2h6v12H2V2zm7 0h6v12H9V2z" opacity="0.8" />
            <path d="M3 4h4v1H3V4zm0 2h4v1H3V6zm0 2h4v1H3V8zm7-4h4v1h-4V4zm0 2h4v1h-4V6zm0 2h4v1h-4V8z" fill="white" />
          </svg>
        );
      case 'Star':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M7 1h2v2H7V1zm3 2h2v2h-2V3zm2 3h2v4h-2V6zm-2 5h2v2h-2v-2zm-3 2h2v2H7v-2zm-3-2h2v2H4v-2zm-2-5h2v4H2V6zm2-3h2v2H4V3z" />
            <rect x="6" y="6" width="4" height="4" />
          </svg>
        );
      case 'Info':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M7 3h2v2H7V3zm0 4h2v6H7V7z" />
            <path fillRule="evenodd" d="M2 2v12h12V2H2zM0 0v16h16V0H0z" clipRule="evenodd" opacity="0.2" />
          </svg>
        );
      case 'Calculator':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M3 2h10v12H3V2zm2 2h6v2H5V4zm0 4h1v1H5V8zm2 0h1v1H7V8zm2 0h1v1H9V8zm-4 2h1v1H5v-1zm2 0h1v1H7v-1zm2 0h1v1H9v-1zm-4 2h1v1H5v-1zm2 0h1v1H7v-1zm2 0h1v1H9v-1z" />
          </svg>
        );
      case 'AlertCircle':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M7 2h2v2H7V2zm0 3h2v6H7V5zm0 7h2v2H7v-2z" />
            <path fillRule="evenodd" d="M1 14V2h14v12H1zM0 1v14h16V1H0z" clipRule="evenodd" opacity="0.4" />
          </svg>
        );
      case 'MessageSquare':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M2 2h12v10H8l-4 4v-4H2V2zm2 2h8v1H4V4zm0 2h8v1H4V6zm0 2h5v1H4V8z" />
          </svg>
        );
      case 'Brain':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M4 4h8v8H4V4zm2 2h4v4H6V6z" opacity="0.8" />
            <path d="M2 6h2v4H2V6zm10 0h2v4h-2V6zM6 2h4v2H6V2zm0 10h4v2H6v-2z" />
          </svg>
        );
      case 'ArrowRight':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M2 7h8V5l4 3-4 3V9H2V7z" />
          </svg>
        );
      case 'Clock':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M6 1h4v1H6V1zM3 3h10v10H3V3zm4 2h2v4H7V5z" />
          </svg>
        );
      case 'ClipboardList':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M6 1h4v2H6V1zM4 3h8v11H4V3zm2 3h4v1H6V6zm0 2h4v1H6V8zm0 2h4v1H6v-1z" />
          </svg>
        );
      case 'Check':
      case 'CheckSquare':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M13 3l1 1-8 8-4-4 1-1 3 3 7-7z" />
          </svg>
        );
      case 'Plus':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M7 2h2v5h5v2H9v5H7V9H2V7h5V2z" />
          </svg>
        );
      case 'X':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M4 2h2v2H4V2zm2 2h2v2H6V4zm2 2h2v2H8V6zm2 2h2v2h-2V8zm-2 2h2v2H8v-2zm-2 2h2v2H6v-2zm-2-2h2v2H4v-2zm-2-2h2v2H2V8zm2-2h2v2H4V6z" />
          </svg>
        );
      case 'Settings':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M7 1h2v2H7V1zm3 1h2v2h-2V2zM5 2h1v1H5V2zm6 11h1v1h-1v-1zM4 11h1v1H4v-1zm1 2h1v1H5v-1zm6-11h1v1h-1V2zM2 5h1v1H2V5zm12 0h1v1h-1V5zM2 10h1v1H2v-1zm12 0h1v1h-1v-1zM7 13h2v2H7v-2zm-3-2h1v1H4v-1zm8 0h1v1h-1v-1z" />
            <rect x="6" y="6" width="4" height="4" />
          </svg>
        );
      case 'GripVertical':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M5 2h2v2H5V2zm4 0h2v2H9V2zM5 6h2v2H5V6zm4 0h2v2H9V6zm-4 4h2v2H5v-2zm4 0h2v2H9v-2z" />
          </svg>
        );
      case 'Move':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M7 1h2v14H7V1zM1 7h14v2H1V7z" />
          </svg>
        );
      case 'ImageIcon':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="5" cy="5" r="1.5" />
            <path d="M2 12l3-3 2 2 4-4 3 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      case 'Type':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M2 2h12v2H9v10H7V4H2V2z" />
          </svg>
        );
      case 'AlignLeft':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M2 2h12v2H2V2zm0 4h8v2H2V6zm0 4h12v2H2v-2zm0 4h8v2H2v-2z" />
          </svg>
        );
      case 'AlignCenter':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M2 2h12v2H2V2zm2 4h8v2H4V6zm-2 4h12v2H2v-2zm2 4h8v2H4v-2z" />
          </svg>
        );
      case 'AlignRight':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M2 2h12v2H2V2zm4 4h8v2H6V6zm-4 4h12v2H2v-2zm4 4h8v2H6v-2z" />
          </svg>
        );
      case 'Square':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        );
      case 'Maximize2':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M10 1h5v5h-2V3h-3V1zM1 10h2v3h3v2H1v-5zm12 3h-3v2h5v-5h-2v3zM3 1v2h3V1H1v5h2V3z" />
          </svg>
        );
      default:
        break;
    }
  }

  if (theme === 'undertale') {
    switch (name) {
      case 'Star':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M8 0l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" />
          </svg>
        );
      case 'AlertTriangle':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M8 1l7 14H1L8 1zm0 4v6m0 2h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none" />
          </svg>
        );
      case 'BookOpen':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M2 2h12v12H2V2zm2 2h8v8H4V4z" />
          </svg>
        );
      case 'Info':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M8 2a6 6 0 100 12 6 6 0 000-12zm0 3v1m0 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none" />
          </svg>
        );
      case 'AlertCircle':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3v6m0 2h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none" />
          </svg>
        );
      case 'MessageSquare':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M2 2h12v9H8l-4 3v-3H2V2zm2 2h8v5H4V4z" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        );
      case 'Brain':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M8 2c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5zM6 7h4M8 5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none" />
          </svg>
        );
      case 'Clock':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M8 2a6 6 0 100 12 6 6 0 000-12zm0 3v3h3" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none" />
          </svg>
        );
      case 'ArrowRight':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M4 8h8M9 5l3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none" />
          </svg>
        );
      case 'Check':
      case 'CheckSquare':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none" />
          </svg>
        );
      case 'Plus':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none" />
          </svg>
        );
      case 'X':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none" />
          </svg>
        );
      case 'Settings':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M8 5a3 3 0 100 6 3 3 0 000-6zm0-3v2m0 8v2M3 8h2m6 0h2" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none" />
          </svg>
        );
      case 'GripVertical':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M6 3h1v1H6V3zm3 0h1v1H9V3zm-3 4h1v1H6V7zm3 0h1v1H9V7zm-3 4h1v1H6v-1zm3 0h1v1H9v-1z" fill="currentColor" />
          </svg>
        );
      case 'Move':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M8 2v12M2 8h12M5 5l-3 3 3 3M11 5l3 3-3 3M5 5l3-3 3 3M5 11l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" fill="none" />
          </svg>
        );
      case 'ImageIcon':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" />
            <path d="M2 11l3-3 4 4 2-2 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" fill="none" />
          </svg>
        );
      case 'Type':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M3 3h10v2H9v8H7V5H3V3z" fill="currentColor" />
          </svg>
        );
      case 'AlignLeft':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M2 3h12M2 7h8M2 11h12M2 15h8" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          </svg>
        );
      case 'AlignCenter':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M2 3h12M4 7h8M2 11h12M4 15h8" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          </svg>
        );
      case 'AlignRight':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M2 3h12M6 7h8M2 11h12M6 15h8" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          </svg>
        );
      case 'Square':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <rect x="2" y="2" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        );
      case 'Maximize2':
        return (
          <svg viewBox="0 0 16 16" className={className} style={style} fill="currentColor">
            <path d="M10 2h4v4M2 10v4h4M14 10v4h-4M6 2H2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none" />
          </svg>
        );
      default:
        break;
    }
  }

  // Fallback to Lucide icons
  const LucideIcon = {
    AlertTriangle, Lightbulb, AlertCircle, BookOpen, CheckSquare, 
    Info, Calculator, MessageSquare, ArrowRight, Clock, Star, ClipboardList, Check, Brain,
    Plus, X, ImageIcon, Type, Move, AlignLeft, AlignCenter, AlignRight, Square, Maximize2, Settings, GripVertical
  }[name] as any;

  if (LucideIcon) {
    return <LucideIcon className={className} style={style} />;
  }

  return null;
};
