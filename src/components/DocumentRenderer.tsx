import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Move, Plus, X, AlertTriangle, Lightbulb, AlertCircle, BookOpen, CheckSquare, Info, Calculator, MessageSquare, ArrowRight, Clock, Settings, AlignLeft, AlignCenter, AlignRight, Maximize2, Minimize2, Layout, GripVertical, Image as ImageIcon, Type, Square, Check, Brain, Star, ClipboardList, Sword, Ghost, ChevronDown, ChevronRight, ArrowUpDown } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface PlacedImage {
  url: string;
  size?: 'small' | 'medium' | 'large' | 'full';
  alignment: 'left' | 'center' | 'right';
  width?: number;
  caption?: string;
  hasBorder?: boolean;
}

interface Props {
  key?: React.Key;
  data: any;
  level?: number;
  path?: string;
  isDragModeActive?: boolean;
  isOrderingMode?: boolean;
  imagePlacements?: Record<string, PlacedImage[]>;
  onZoneClick?: (path: string) => void;
  onRemoveImage?: (path: string, index: number) => void;
  onUpdateImage?: (path: string, index: number, updates: Partial<PlacedImage>) => void;
  onUpdateItem?: (path: string, updates: any) => void;
  onReorderGroupClick?: (groupIndex: number) => void;
  selectedColors?: string[];
  groupColor?: string;
  theme?: 'modern' | 'cyberpunk' | 'vintage' | 'terminal' | 'ethereal' | 'prism' | 'minecraft' | 'undertale' | 'god-of-war' | 'cuphead';
}

const ColorContext = React.createContext<{ groupColor?: string, nextColor?: string, theme?: string }>({});
export const DocumentContext = React.createContext<{ fullData: any }>({ fullData: null });

function getShade(hex: string, percent: number) {
  const f = parseInt(hex.slice(1), 16),
    t = percent < 0 ? 0 : 255,
    p = percent < 0 ? percent * -1 : percent,
    R = f >> 16,
    G = (f >> 8) & 0x00ff,
    B = f & 0x0000ff;
  return (
    "#" +
    (
      0x1000000 +
      (Math.round((t - R) * p) + R) * 0x10000 +
      (Math.round((t - G) * p) + G) * 0x100 +
      (Math.round((t - B) * p) + B)
    )
      .toString(16)
      .slice(1)
  );
}

function DroppableZone({ id, active, onClick }: { id: string, active: boolean, onClick?: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  
  if (!active) {
    return (
      <div 
        onClick={onClick}
        className="h-2 my-1 hover:h-16 hover:my-4 rounded-xl border-2 border-dashed border-transparent hover:border-blue-300 hover:bg-blue-50/50 flex items-center justify-center transition-all duration-200 cursor-pointer group/zone"
      >
        <div className="opacity-0 group-hover/zone:opacity-100 flex items-center space-x-2 pointer-events-none">
          <Plus className="w-5 h-5 text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Add Image Here</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={setNodeRef} 
      onClick={onClick}
      className={cn(
        "h-20 my-4 rounded-xl border-2 border-dashed flex items-center justify-center transition-all duration-200 cursor-pointer",
        isOver ? "border-blue-500 bg-blue-100 scale-[1.02] shadow-inner" : "border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-blue-300"
      )}
    >
      <div className="flex items-center space-x-2 pointer-events-none">
        <Plus className={cn("w-5 h-5", isOver ? "text-blue-600" : "text-slate-400")} />
        <span className={cn(
          "text-sm font-bold uppercase tracking-wider",
          isOver ? "text-blue-600" : "text-slate-400"
        )}>
          {isOver ? "Drop Here!" : "Tap or Drop Image"}
        </span>
      </div>
    </div>
  );
}

export function ImageSettingsModal({ 
  image, 
  onClose, 
  onUpdate, 
  onRemove,
  onConfirm,
  confirmLabel = "Done"
}: { 
  image: PlacedImage, 
  onClose: () => void, 
  onUpdate: (updates: Partial<PlacedImage>) => void, 
  onRemove?: () => void,
  onConfirm?: () => void,
  confirmLabel?: string
}) {
  return createPortal(
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10001] flex items-center justify-center p-4 sm:p-6" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200" 
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Image Properties</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Adjust appearance & behavior</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
          
          {/* Caption */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Type className="w-3 h-3" /> Caption (Optional)
            </label>
            <input 
              type="text"
              value={image.caption || ''}
              onChange={(e) => onUpdate({ caption: e.target.value })}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700 font-medium"
              placeholder="Enter a caption for this image..."
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Alignment */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Move className="w-3 h-3" /> Alignment
              </label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {['left', 'center', 'right'].map((align) => (
                  <button 
                    key={align}
                    onClick={() => onUpdate({ alignment: align as any })}
                    className={cn(
                      "flex-1 py-2 flex justify-center rounded-lg text-sm transition-all",
                      image.alignment === align ? "bg-white shadow-sm text-blue-600 font-bold" : "text-slate-500 hover:text-slate-700 font-medium"
                    )}
                  >
                    {align === 'left' && <AlignLeft className="w-4 h-4" />}
                    {align === 'center' && <AlignCenter className="w-4 h-4" />}
                    {align === 'right' && <AlignRight className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Border */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Square className="w-3 h-3" /> Border Style
              </label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => onUpdate({ hasBorder: false })}
                  className={cn(
                    "flex-1 py-2 text-xs rounded-lg transition-all",
                    !image.hasBorder ? "bg-white shadow-sm text-blue-600 font-bold" : "text-slate-500 font-medium hover:text-slate-700"
                  )}
                >
                  None
                </button>
                <button 
                  onClick={() => onUpdate({ hasBorder: true })}
                  className={cn(
                    "flex-1 py-2 text-xs rounded-lg transition-all",
                    image.hasBorder ? "bg-white shadow-sm text-blue-600 font-bold" : "text-slate-500 font-medium hover:text-slate-700"
                  )}
                >
                  Solid
                </button>
              </div>
            </div>
          </div>

          {/* Width Slider */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Maximize2 className="w-3 h-3" /> Width ({image.width || 100}%)
              </label>
              <div className="flex gap-1">
                {[25, 50, 75, 100].map((w) => (
                  <button 
                    key={w}
                    onClick={() => onUpdate({ width: w, size: undefined })}
                    className={cn(
                      "px-2 py-1 text-[10px] rounded-md transition-all font-bold",
                      image.width === w 
                        ? "bg-blue-100 text-blue-700" 
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                  >
                    {w}%
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-400">10%</span>
              <input 
                type="range" 
                min="10" 
                max="100" 
                step="1" 
                value={image.width || 100} 
                onChange={(e) => onUpdate({ width: parseInt(e.target.value), size: undefined })}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-xs font-bold text-slate-400">100%</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-4">
          {onRemove && (
            <button 
              onClick={() => { onRemove(); onClose(); }}
              className="flex-1 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" /> Remove Image
            </button>
          )}
          <button 
            onClick={onConfirm || onClose}
            className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function DraggablePlacedImage({ id, image, active, path, index, onRemove, onUpdate }: { key?: React.Key, id: string, image: PlacedImage, active: boolean, path: string, index: number, onRemove?: () => void, onUpdate?: (updates: Partial<PlacedImage>) => void }) {
  const [isSelected, setIsSelected] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { url: image.url, source: 'placed', sourcePath: path, sourceIndex: index },
    disabled: !active || isResizing || isSelected
  });

  const getInitialWidth = () => {
    if (image.width !== undefined) return image.width;
    // Default to 25% for left/right if not specified
    if (image.alignment === 'left' || image.alignment === 'right') return 25;
    
    switch (image.size) {
      case 'small': return 25;
      case 'medium': return 50;
      case 'large': return 75;
      case 'full':
      default: return 25;
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = getInitialWidth();
    const parentWidth = containerRef.current?.parentElement?.clientWidth || 1;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / parentWidth) * 100;
      
      // If centered, we might want to double the delta if we resize from one side?
      // But usually handles are on one side. Let's keep it simple.
      // If it's centered, dragging right increases width.
      
      let newWidth = startWidth + deltaPercent;
      if (image.alignment === 'center') {
        // For centered images, dragging the right handle expands both sides visually relative to center
        newWidth = startWidth + (deltaPercent * 2);
      }

      newWidth = Math.min(Math.max(newWidth, 10), 100);
      onUpdate?.({ width: Math.round(newWidth), size: undefined });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const sizeStyle = {
    width: `${getInitialWidth()}%`,
  };

  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end'
  };

  if (!active) {
    const initialWidth = getInitialWidth();
    // Only float if there's enough space for text (width <= 65%)
    const canFloat = (image.alignment === 'left' || image.alignment === 'right') && initialWidth <= 65;
    const isFloating = canFloat;
    
    return (
      <div 
        className={cn(
          "my-4 transition-all group/img-container relative", 
          !isFloating && "flex w-full", 
          !isFloating && alignmentClasses[image.alignment || 'center']
        )}
        style={isFloating ? {
          float: image.alignment as 'left' | 'right',
          width: `${initialWidth}%`,
          marginRight: image.alignment === 'left' ? '1.5rem' : '0',
          marginLeft: image.alignment === 'right' ? '1.5rem' : '0',
          marginBottom: '1rem',
          maxWidth: '100%'
        } : {
          width: `${initialWidth}%`
        }}
      >
        <div 
          className={cn(
            "relative group rounded-xl overflow-hidden flex flex-col",
            image.hasBorder && "border-4 border-slate-800 p-1 bg-white shadow-lg"
          )}
        >
          <img 
            src={image.url} 
            alt={image.caption || "Placed"} 
            className={cn(
              "h-auto w-full transition-all group-hover:ring-4 group-hover:ring-blue-500/20",
              !image.hasBorder && "shadow-md border border-slate-200"
            )} 
            style={{ maxHeight: '600px' }} 
          />
          {image.caption && (
            <div className="p-2 text-center text-sm text-slate-600 italic bg-slate-50/80 backdrop-blur-sm border-t border-slate-100">
              {image.caption}
            </div>
          )}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsSelected(true);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors flex items-center justify-center group"
          >
            <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-blue-100 scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-bold text-slate-700">Image Properties</span>
            </div>
          </button>
        </div>
        {isSelected && (
          <ImageSettingsModal
            image={image}
            onClose={() => setIsSelected(false)}
            onUpdate={(updates) => onUpdate?.(updates)}
            onRemove={() => onRemove?.()}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex w-full my-4", alignmentClasses[image.alignment || 'center'])} ref={containerRef}>
      <div 
        ref={setNodeRef} 
        className={cn(
          "relative border-2 rounded-xl overflow-hidden shadow-sm flex justify-center bg-slate-50 transition-all group",
          isSelected ? "border-blue-500 ring-4 ring-blue-500/20" : "border-slate-200 hover:border-blue-400 hover:shadow-md",
          isDragging ? "opacity-40 scale-95" : "opacity-100"
        )}
        style={sizeStyle}
      >
        {/* Drag Handle */}
        <div 
          {...listeners} 
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 right-3 bg-slate-900/70 p-2 rounded-lg text-white backdrop-blur-md shadow-lg flex items-center space-x-2 cursor-grab active:cursor-grabbing z-20"
        >
          <Move className="w-4 h-4" />
          <span className="text-xs font-bold tracking-wider uppercase">Drag</span>
        </div>

        {/* Settings Button */}
        {!isSelected && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsSelected(true);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute top-3 left-3 bg-white/90 backdrop-blur-md p-2 rounded-lg text-blue-600 shadow-lg flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-blue-50"
          >
            <Settings className="w-4 h-4" />
            <span className="text-[10px] font-bold tracking-wider uppercase">Settings</span>
          </button>
        )}

        {/* Resize Handle */}
        {isSelected && (
          <div 
            onMouseDown={handleResizeStart}
            className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 cursor-nwse-resize flex items-center justify-center rounded-tl-xl z-40 shadow-lg hover:bg-blue-700 transition-colors"
          >
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Control Panel */}
        {isSelected && (
          <ImageSettingsModal
            image={image}
            onClose={() => setIsSelected(false)}
            onUpdate={(updates) => onUpdate?.(updates)}
            onRemove={() => onRemove?.()}
          />
        )}

        <div className={cn("w-full flex flex-col", image.hasBorder && "border-4 border-slate-800 p-1 bg-white")}>
          <img src={image.url} alt={image.caption || "Placed"} className="w-full h-auto object-contain" style={{ maxHeight: '600px' }} />
          {image.caption && (
            <div className="p-2 text-center text-sm text-slate-600 italic bg-slate-50/80 border-t border-slate-100">
              {image.caption}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlacedImages({ images, path, isDragModeActive, onRemove, onUpdate }: { images?: PlacedImage[], path: string, isDragModeActive: boolean, onRemove?: (index: number) => void, onUpdate?: (index: number, updates: Partial<PlacedImage>) => void }) {
  if (!images || images.length === 0) return null;
  
  // In preview mode (not active), we want images to be siblings to allow floating
  if (!isDragModeActive) {
    return (
      <>
        {images.filter(Boolean).map((img, i) => (
          <DraggablePlacedImage 
            key={`${path}-${i}`} 
            id={`placed-${path}-${i}`} 
            image={img} 
            active={isDragModeActive} 
            path={path} 
            index={i} 
            onRemove={() => onRemove?.(i)} 
            onUpdate={(updates) => onUpdate?.(i, updates)}
          />
        ))}
      </>
    );
  }

  return (
    <div className="my-6 flex flex-col gap-6 w-full">
      {images.filter(Boolean).map((img, i) => (
        <DraggablePlacedImage 
          key={`${path}-${i}`} 
          id={`placed-${path}-${i}`} 
          image={img} 
          active={isDragModeActive} 
          path={path} 
          index={i} 
          onRemove={() => onRemove?.(i)} 
          onUpdate={(updates) => onUpdate?.(i, updates)}
        />
      ))}
    </div>
  );
}

const GROUP_COLORS = [
  'border-blue-200 bg-blue-50/30',
  'border-emerald-200 bg-emerald-50/30',
  'border-purple-200 bg-purple-50/30',
  'border-amber-200 bg-amber-50/30',
  'border-rose-200 bg-rose-50/30',
  'border-cyan-200 bg-cyan-50/30',
];

function DraggableItemWrapper({ item, groupIndex, itemIndex, isDragModeActive, children }: { key?: React.Key, item: any, groupIndex: number, itemIndex: number, isDragModeActive: boolean, children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `drag-item-${item.id}`,
    data: { type: 'document-item', groupIndex, itemIndex, item },
    disabled: !isDragModeActive
  });

  return (
    <div 
      ref={setNodeRef} 
      className={cn(
        "relative transition-all",
        isDragModeActive && "p-2 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 bg-white/50",
        isDragging && "opacity-50 scale-95 z-50 shadow-xl"
      )}
    >
      {isDragModeActive && (
        <div 
          {...listeners} 
          {...attributes}
          className="absolute top-2 right-2 bg-slate-800 text-white p-1 rounded text-xs z-10 cursor-grab active:cursor-grabbing"
        >
          <Move className="w-3 h-3" />
        </div>
      )}
      <div>
        {children}
      </div>
    </div>
  );
}

function BrickItem({ item, groupIndex, itemIndex, isOrderingMode, imagePlacements, path, onRemoveImage, onUpdateImage, onUpdateItem, onZoneClick, groupColor, theme }: any) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `brick-${item.id}`,
    data: { type: 'document-item', groupIndex, itemIndex, item },
    disabled: selectedImageIndex !== null
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
  };

  const images = imagePlacements[path] || [];
  const beforeImages = imagePlacements[`${path}.before`] || [];

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "group relative transition-all flex flex-col gap-3",
        isDragging 
          ? "bg-white border-2 rounded-2xl p-4 opacity-75 scale-95 shadow-2xl border-blue-500" 
          : "border-2 border-transparent hover:border-blue-200/50 rounded-xl p-2 -mx-2"
      )}
    >
      <div className={cn("flex items-start gap-4", !isDragging && "items-stretch")}>
        {/* Drag Handle */}
        <div 
          {...listeners} 
          {...attributes}
          className={cn(
            "mt-1 p-2 rounded-xl cursor-grab active:cursor-grabbing transition-colors shrink-0",
            isDragging 
              ? "bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600" 
              : "bg-slate-50/50 hover:bg-slate-100 text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100"
          )}
        >
          <GripVertical className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isDragging ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span 
                  className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border"
                  style={{ 
                    color: groupColor, 
                    borderColor: groupColor,
                    backgroundColor: getShade(groupColor, 0.95)
                  }}
                >
                  {item.TYPE}
                </span>
              </div>
              <div className="text-sm text-slate-600 line-clamp-3 font-medium">
                {item.CONTENT || JSON.stringify(item)}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              {item.TYPE === 'IMG' && !item.CONTENT && (
                <div 
                  onClick={() => onZoneClick?.(path)}
                  className="p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group/upload"
                >
                  <ImageIcon className="w-8 h-8 mb-2 opacity-20 group-hover/upload:opacity-100 group-hover/upload:text-blue-500" />
                  <span className="text-xs font-bold uppercase tracking-widest opacity-40 group-hover/upload:opacity-100 group-hover/upload:text-blue-500">Click to Upload Image</span>
                </div>
              )}
              <div className="pointer-events-none">
                <DocumentRenderer 
                  data={item} 
                  level={2} 
                  path={path} 
                  isDragModeActive={false} 
                  isOrderingMode={false} 
                  imagePlacements={imagePlacements} 
                  onUpdateItem={onUpdateItem}
                  theme={theme} 
                />
              </div>
            </div>
          )}
        </div>

        {/* Sideways Images (Visible in Ordering Mode) */}
        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 max-w-[200px] shrink-0 items-center">
            {images.filter(Boolean).map((img: any, i: number) => (
              <div 
                key={i} 
                className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0 group/img cursor-pointer"
              >
                <img src={img.url} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImageIndex(i);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="p-1 bg-white rounded-md text-blue-600 hover:bg-blue-50 shadow-sm"
                    title="Settings"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveImage?.(path, i);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="p-1 bg-white rounded-md text-red-600 hover:bg-red-50 shadow-sm"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedImageIndex !== null && (
        <ImageSettingsModal
          image={images[selectedImageIndex]}
          onClose={() => setSelectedImageIndex(null)}
          onUpdate={(updates) => onUpdateImage?.(path, selectedImageIndex, updates)}
          onRemove={() => {
            onRemoveImage?.(path, selectedImageIndex);
            setSelectedImageIndex(null);
          }}
        />
      )}

      {/* Add Image Zone (Visible in Ordering Mode) */}
      {!isDragging && (
        <div 
          onClick={() => onZoneClick?.(path)}
          className="h-8 border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group/add"
        >
          <Plus className="w-4 h-4 text-slate-300 group-hover/add:text-blue-500 transition-colors" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 group-hover/add:text-blue-500 ml-2">Add Image</span>
        </div>
      )}
    </div>
  );
}

function GroupRenderer({ group, groupIndex, level, path, isDragModeActive, isOrderingMode, imagePlacements, onZoneClick, onRemoveImage, onUpdateImage, onReorderGroupClick, selectedColors, theme = 'modern' }: { group: any, groupIndex: number, level: number, path: string, isDragModeActive: boolean, isOrderingMode: boolean, imagePlacements: Record<string, PlacedImage[]>, onZoneClick: (path: string) => void, onRemoveImage: (path: string, index: number) => void, onUpdateImage: (path: string, index: number, updates: Partial<PlacedImage>) => void, onReorderGroupClick: (groupIndex: number) => void, selectedColors: string[], theme?: Props['theme'] }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const defaultColors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#a855f7', // purple
    '#f59e0b', // amber
    '#f43f5e', // rose
    '#06b6d4', // cyan
  ];

  const colorsToUse = selectedColors && selectedColors.length > 0 ? selectedColors : defaultColors;
  const groupColor = colorsToUse[groupIndex % colorsToUse.length];
  const nextColor = colorsToUse[(groupIndex + 1) % colorsToUse.length];
  const lightBg = getShade(groupColor, 0.95);
  const borderColor = groupColor;

  const { setNodeRef, isOver } = useDroppable({
    id: `group-drop-${group.id}`,
    data: { type: 'group', groupIndex }
  });

  const renderDropAndImages = (currentPath: string) => (
    <>
      {isOrderingMode && <DroppableZone id={currentPath} active={isDragModeActive} onClick={() => onZoneClick?.(currentPath)} />}
      <PlacedImages images={imagePlacements[currentPath]} path={currentPath} isDragModeActive={isDragModeActive} onRemove={(index) => onRemoveImage?.(currentPath, index)} onUpdate={(index, updates) => onUpdateImage?.(currentPath, index, updates)} />
    </>
  );

  return (
    <ColorContext.Provider value={{ groupColor, nextColor, theme }}>
      <div 
        id={`doc-item-${path.replace(/\s+/g, '_')}`}
        ref={isDragModeActive ? setNodeRef : undefined}
        className={cn(
          "border-2 p-6 transition-all",
          theme === 'modern' && "rounded-2xl",
          theme === 'cyberpunk' && "rounded-none border-purple-500/50 bg-[#0a0a0f] shadow-[0_0_20px_rgba(168,85,247,0.1)]",
          theme === 'vintage' && "rounded-sm border-[#d4c5a1] bg-[#fdfbf7] shadow-inner",
          theme === 'terminal' && "rounded-none border-green-500 bg-black font-mono",
          theme === 'ethereal' && "rounded-[2rem] border-indigo-100 bg-white/80 backdrop-blur-md shadow-[0_8px_32px_rgba(99,102,241,0.05)]",
          theme === 'prism' && "rounded-3xl border-transparent bg-white shadow-xl relative overflow-hidden",
          theme === 'minecraft' && "rounded-none border-4 border-[#373737] bg-[#c6c6c6] shadow-[inset_-4px_-4px_0_#555,inset_4px_4px_0_#fff] p-6 font-pixel",
          theme === 'undertale' && "rounded-none border-2 border-white bg-black p-8 font-retro text-white",
          theme === 'god-of-war' && "rounded-none border-4 border-[#4a4a4a] bg-[#1a1a1a] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden",
          theme === 'cuphead' && "rounded-none border-4 border-black bg-[#f5f5dc] p-8 shadow-[8px_8px_0_rgba(0,0,0,1)] relative",
          isOver && isDragModeActive ? "ring-4 ring-blue-400 scale-[1.01]" : ""
        )}
        style={{ 
          borderColor: theme === 'modern' ? borderColor : undefined,
          backgroundColor: theme === 'modern' ? lightBg : undefined,
          background: theme === 'prism' ? `linear-gradient(135deg, white, ${groupColor}05)` : undefined
        }}
      >
        {theme === 'prism' && (
          <div 
            className="absolute top-0 left-0 w-full h-2" 
            style={{ background: `linear-gradient(90deg, ${groupColor}, ${nextColor})` }}
          />
        )}
        {theme === 'god-of-war' && (
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#8b0000_0%,transparent_70%)]" />
          </div>
        )}
        {theme === 'cuphead' && (
          <div className="absolute inset-0 pointer-events-none opacity-5 mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
        )}
        <div 
          className="flex items-center justify-between mb-6 group"
        >
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="w-6 h-6 transition-transform" style={{ color: groupColor }} />
            ) : (
              <ChevronDown className="w-6 h-6 transition-transform" style={{ color: groupColor }} />
            )}
            <h2 
              className={cn(
                "text-2xl font-bold transition-colors",
                theme === 'cyberpunk' && "uppercase tracking-widest font-mono italic",
                theme === 'vintage' && "font-serif italic",
                theme === 'terminal' && "uppercase font-mono text-green-500",
                theme === 'ethereal' && "font-serif text-indigo-900 tracking-tight",
                theme === 'prism' && "text-3xl font-black tracking-tighter italic",
                theme === 'minecraft' && "text-2xl text-[#373737] uppercase tracking-wider",
                theme === 'undertale' && "text-2xl text-white uppercase tracking-widest flex items-center gap-4",
                theme === 'god-of-war' && "text-3xl text-[#ffd700] uppercase tracking-[0.3em] font-serif flex items-center gap-4 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]",
                theme === 'cuphead' && "text-4xl text-black uppercase font-black tracking-tighter flex items-center gap-4 transform -rotate-2",
              )}
              style={{ 
                color: theme === 'modern' ? getShade(groupColor, -0.2) : 
                       (theme === 'cyberpunk' ? groupColor : 
                       (theme === 'terminal' ? '#22c55e' : 
                       (theme === 'ethereal' ? '#312e81' : 
                       (theme === 'prism' ? groupColor : 
                       (theme === 'minecraft' ? '#373737' : 
                       (theme === 'undertale' ? '#ffffff' : 
                       (theme === 'god-of-war' ? '#ffd700' : 
                       (theme === 'cuphead' ? '#000000' : '#4a3728')))))))) 
              }}
            >
              {theme === 'terminal' && "> "}
              {theme === 'undertale' && <span className="text-red-600">❤</span>}
              {theme === 'god-of-war' && <Sword className="w-8 h-8 text-[#8b0000]" />}
              {theme === 'cuphead' && <div className="w-10 h-10 rounded-full bg-red-600 border-4 border-black shadow-[2px_2px_0_rgba(0,0,0,1)]" />}
              <MarkdownContent content={group.GROUP} />
            </h2>
          </div>
          <button 
            className="opacity-50 hover:opacity-100 transition-all p-2 rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer" 
            style={{ color: groupColor }}
            onClick={(e) => {
              e.stopPropagation();
              onReorderGroupClick?.(groupIndex);
            }}
            title="Reorder Group"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
        
        {!isCollapsed && (
          <div className="flex flex-col gap-4 flow-root">
            {isOrderingMode ? (
              <SortableContext 
                items={group.ITEMS.map((item: any) => `brick-${item.id}`)} 
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-3">
                  {group.ITEMS.map((item: any, itemIndex: number) => (
                    <BrickItem 
                      key={item.id}
                      item={item}
                      groupIndex={groupIndex}
                      itemIndex={itemIndex}
                      isOrderingMode={isOrderingMode}
                      imagePlacements={imagePlacements}
                      path={item.id}
                      onRemoveImage={onRemoveImage}
                      onUpdateImage={onUpdateImage}
                      onZoneClick={onZoneClick}
                      groupColor={groupColor}
                      theme={theme}
                    />
                  ))}
                </div>
              </SortableContext>
            ) : (
              <>
                {renderDropAndImages(`${group.id}.start`)}
                {group.ITEMS.map((item: any, itemIndex: number) => (
                  <React.Fragment key={item.id}>
                    <DraggableItemWrapper 
                      item={item} 
                      groupIndex={groupIndex} 
                      itemIndex={itemIndex} 
                      isDragModeActive={isDragModeActive}
                    >
                      <DocumentRenderer 
                        data={item} 
                        level={level + 1} 
                        path={item.id} 
                        isDragModeActive={isDragModeActive} 
                        isOrderingMode={isOrderingMode}
                        imagePlacements={imagePlacements} 
                        onZoneClick={onZoneClick} 
                        onRemoveImage={onRemoveImage} 
                        onUpdateImage={onUpdateImage}
                        onReorderGroupClick={onReorderGroupClick}
                        groupColor={groupColor}
                        theme={theme}
                      />
                    </DraggableItemWrapper>
                  </React.Fragment>
                ))}
                {renderDropAndImages(`${group.id}.end`)}
              </>
            )}
          </div>
        )}
      </div>
    </ColorContext.Provider>
  );
}

function MemoryLinkPopover({ concept, children }: { concept: string, children: React.ReactNode }) {
  const { fullData } = React.useContext(DocumentContext);
  const { groupColor, theme } = React.useContext(ColorContext);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const occurrences = React.useMemo(() => {
    const results: { group: string, text: string, type: string, path: string }[] = [];
    if (!fullData || !Array.isArray(fullData)) return results;

    fullData.forEach((group: any, groupIdx: number) => {
      // Check if it's a grouped format or flat format
      if (group.GROUP && Array.isArray(group.ITEMS)) {
        const groupName = group.GROUP || 'Untitled Group';
        group.ITEMS.forEach((item: any, itemIdx: number) => {
          const content = String(item.CONTENT || '');
          const isMention = content.includes(`[[${concept}]]`);
          const isDefinition = item.TYPE === 'CONCEPT' && content.trim().toLowerCase() === concept.trim().toLowerCase();
          
          if (isMention || isDefinition) {
            const cleanText = content
              .replace(/\[\[([^\]]+)\]\]/g, '$1')
              .replace(/\[([^\]]+)\]\{([^}]+)\}/g, '$1');
            
            results.push({
              group: groupName,
              text: cleanText,
              type: item.TYPE,
              path: item.id || `root.${groupIdx}.${itemIdx}`
            });
          }
        });
      } else {
        // Flat format
        const content = String(group.CONTENT || '');
        const isMention = content.includes(`[[${concept}]]`);
        const isDefinition = group.TYPE === 'CONCEPT' && content.trim().toLowerCase() === concept.trim().toLowerCase();
        
        if (isMention || isDefinition) {
          const cleanText = content
            .replace(/\[\[([^\]]+)\]\]/g, '$1')
            .replace(/\[([^\]]+)\]\{([^}]+)\}/g, '$1');
          
          results.push({
            group: 'General',
            text: cleanText,
            type: group.TYPE || 'ITEM',
            path: group.id || `root.${groupIdx}`
          });
        }
      }
    });
    return results;
  }, [fullData, concept]);

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    
    // Use a small timeout to ensure the popover is closed and document layout is stable
    setTimeout(() => {
      const sanitizedPath = path.replace(/\s+/g, '_');
      const elementId = `doc-item-${sanitizedPath}`;
      const element = document.getElementById(elementId);
      
      console.log(`Navigating to ${elementId}`, element);
      
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add a temporary highlight effect
        const highlightClasses = ['ring-4', 'ring-blue-500/50', 'ring-offset-4', 'transition-all', 'duration-500', 'z-50', 'relative'];
        element.classList.add(...highlightClasses);
        
        setTimeout(() => {
          element.classList.remove(...highlightClasses);
        }, 2000);
      } else {
        console.warn(`Element with ID ${elementId} not found for path ${path}`);
      }
    }, 100);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const popoverContent = (
    <div 
      ref={popoverRef}
      className={cn(
        "fixed z-[9999] w-80 max-h-96 overflow-y-auto shadow-2xl border transition-all duration-300 animate-in fade-in zoom-in-95",
        theme === 'modern' && "bg-white border-slate-200 rounded-2xl p-6",
        theme === 'cyberpunk' && "bg-black border-cyan-500 rounded-none p-6 shadow-[0_0_30px_rgba(6,182,212,0.3)]",
        theme === 'vintage' && "bg-[#fdfbf7] border-[#d4c5a1] rounded-sm p-6",
        theme === 'terminal' && "bg-black border-green-500 rounded-none p-6 shadow-[0_0_20px_rgba(34,197,94,0.2)]",
        theme === 'ethereal' && "bg-white/95 backdrop-blur-xl border-indigo-100 rounded-[2rem] p-8",
        theme === 'prism' && "bg-white border-slate-200 rounded-3xl p-8 shadow-2xl",
        theme === 'minecraft' && "bg-[#c6c6c6] border-4 border-[#373737] rounded-none p-4 shadow-[inset_-4px_-4px_0_#555,inset_4px_4px_0_#fff]",
        theme === 'undertale' && "bg-black border-2 border-white rounded-none p-4",
        theme === 'god-of-war' && "bg-[#1a1a1a] border-2 border-[#8b0000] rounded-none p-6 shadow-[0_0_40px_rgba(139,0,0,0.4)]",
        theme === 'cuphead' && "bg-[#f5f5dc] border-4 border-black rounded-none p-6 shadow-[8px_8px_0_rgba(0,0,0,1)]"
      )}
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className={cn(
            "w-5 h-5",
            theme === 'modern' && "text-blue-500",
            theme === 'cyberpunk' && "text-cyan-400",
            theme === 'terminal' && "text-green-500",
            theme === 'god-of-war' && "text-[#ffd700]"
          )} />
          <h3 className={cn(
            "font-bold uppercase tracking-wider text-sm",
            theme === 'modern' && "text-slate-900",
            theme === 'cyberpunk' && "text-cyan-400 font-mono",
            theme === 'terminal' && "text-green-500 font-mono",
            theme === 'god-of-war' && "text-[#ffd700] font-serif"
          )}>
            Memory Links: {concept}
          </h3>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="space-y-4">
        {occurrences.length <= 1 ? (
          <p className="text-sm text-slate-500 italic">No other occurrences found.</p>
        ) : (
          occurrences.map((occ, idx) => (
            <div 
              key={idx} 
              onClick={() => handleNavigate(occ.path)}
              className={cn(
                "p-3 rounded-xl border transition-all cursor-pointer group/item",
                theme === 'modern' && "bg-slate-50 border-slate-100 hover:border-blue-200 hover:bg-blue-50/50",
                theme === 'cyberpunk' && "bg-cyan-950/20 border-cyan-500/30 hover:bg-cyan-900/30 hover:border-cyan-400",
                theme === 'terminal' && "bg-green-900/10 border-green-500/30 hover:bg-green-900/20 hover:border-green-400",
                theme === 'god-of-war' && "bg-[#8b0000]/10 border-[#8b0000]/30 hover:bg-[#8b0000]/20 hover:border-[#8b0000]"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
                  theme === 'modern' && "bg-blue-100 text-blue-700",
                  theme === 'cyberpunk' && "bg-cyan-500/20 text-cyan-400",
                  theme === 'terminal' && "bg-green-500/20 text-green-500"
                )}>
                  {occ.group}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-medium">{occ.type}</span>
              </div>
              <p className={cn(
                "text-xs leading-relaxed line-clamp-3",
                theme === 'modern' && "text-slate-600",
                theme === 'cyberpunk' && "text-cyan-100/70 font-mono",
                theme === 'terminal' && "text-green-400/70 font-mono"
              )}>
                {occ.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      <span 
        onClick={() => setIsOpen(true)}
        data-memory-link={concept}
        className={cn(
          "cursor-pointer transition-all border-b-2 border-dashed print:border-none print:cursor-default",
          theme === 'modern' && "hover:bg-blue-50",
          theme === 'cyberpunk' && "hover:bg-cyan-400/10 shadow-[0_0_10px_rgba(6,182,212,0.2)]",
          theme === 'terminal' && "hover:bg-green-500/10",
          theme === 'ethereal' && "hover:bg-indigo-50/50",
          theme === 'prism' && "hover:bg-indigo-50",
          theme === 'minecraft' && "hover:bg-white/20",
          theme === 'undertale' && "hover:bg-white/10",
          theme === 'god-of-war' && "hover:bg-[#8b0000]/20",
          theme === 'cuphead' && "hover:bg-white/20"
        )}
        style={{ 
          color: groupColor || (theme === 'cyberpunk' ? '#22d3ee' : (theme === 'terminal' ? '#22c55e' : (theme === 'god-of-war' ? '#ffd700' : (theme === 'undertale' ? '#ffff00' : (theme === 'cuphead' ? '#2563eb' : '#2563eb'))))),
          borderColor: groupColor ? `${groupColor}60` : undefined
        }}
      >
        {children}
      </span>
      {isOpen && createPortal(popoverContent, document.body)}
    </>
  );
}

function ExplanationPopover({ data, children }: { data: string, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, groupColor, nextColor } = React.useContext(ColorContext);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const parts = data.split('|');
  const title = parts[0] || '';
  const def = parts[1] || '';
  const simple = parts[2] || '';
  const extra = parts[3] || '';

  return (
    <span className="relative inline-block explanation-wrapper" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "explanation-btn font-bold underline decoration-dashed decoration-2 underline-offset-4 cursor-pointer transition-colors relative z-10",
          theme === 'modern' && "hover:text-blue-800",
          theme === 'cyberpunk' && "text-cyan-400 hover:text-cyan-300 decoration-cyan-500/50",
          theme === 'vintage' && "text-[#8b4513] hover:text-[#5d4037] decoration-[#d4c5a1]",
          theme === 'terminal' && "text-green-400 hover:text-green-300 decoration-green-500/50",
          theme === 'ethereal' && "text-indigo-600 hover:text-indigo-800 decoration-indigo-300",
          theme === 'prism' && "text-transparent bg-clip-text decoration-slate-300",
          theme === 'minecraft' && "text-[#373737] hover:text-black decoration-[#373737]",
          theme === 'undertale' && "text-yellow-400 hover:text-yellow-300 decoration-yellow-400/50",
          theme === 'god-of-war' && "text-[#ffd700] hover:text-white decoration-[#8b0000]",
          theme === 'cuphead' && "text-red-600 hover:text-red-800 decoration-black"
        )}
        style={theme === 'prism' ? { backgroundImage: `linear-gradient(to right, ${groupColor || '#ef4444'}, ${nextColor || '#f97316'})` } : (theme === 'modern' ? { color: groupColor } : {})}
      >
        {children}
      </button>
      <div 
        className={cn(
          "explanation-popover absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-5 text-left animate-in fade-in slide-in-from-bottom-2 duration-200",
          !isOpen && "hidden",
          theme === 'modern' && "rounded-2xl shadow-xl bg-white border border-slate-200",
            theme === 'cyberpunk' && "rounded-none bg-black/90 border border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] backdrop-blur-md",
            theme === 'vintage' && "rounded-sm bg-[#fdfbf7] border-2 border-[#d4c5a1] shadow-lg",
            theme === 'terminal' && "rounded-none bg-black border-2 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]",
            theme === 'ethereal' && "rounded-3xl bg-white/90 backdrop-blur-xl border border-indigo-100 shadow-[0_8px_32px_rgba(99,102,241,0.1)]",
            theme === 'prism' && "rounded-3xl bg-white shadow-2xl border-none",
            theme === 'minecraft' && "rounded-none bg-[#c6c6c6] border-4 border-[#373737] shadow-[inset_-4px_-4px_0_#555,inset_4px_4px_0_#fff]",
            theme === 'undertale' && "rounded-none bg-black border-2 border-white p-6",
            theme === 'god-of-war' && "rounded-none bg-[#1a1a1a] border-2 border-[#ffd700] shadow-[0_10px_30px_rgba(0,0,0,0.8)]",
            theme === 'cuphead' && "rounded-none bg-[#f5f5dc] border-4 border-black shadow-[8px_8px_0_rgba(0,0,0,1)]"
          )}
        >
          {theme === 'prism' && (
            <div className="absolute top-0 left-0 w-full h-1.5" style={{ background: `linear-gradient(to right, ${groupColor || '#ef4444'}, ${nextColor || '#f97316'})` }} />
          )}
          
          {/* Triangle pointer */}
          <div className={cn(
            "absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-r border-b",
            theme === 'modern' && "bg-white border-slate-200",
            theme === 'cyberpunk' && "bg-black border-cyan-500",
            theme === 'vintage' && "bg-[#fdfbf7] border-[#d4c5a1]",
            theme === 'terminal' && "bg-black border-green-500",
            theme === 'ethereal' && "bg-white border-indigo-100",
            theme === 'prism' && "bg-white border-transparent",
            theme === 'minecraft' && "bg-[#c6c6c6] border-[#373737]",
            theme === 'undertale' && "bg-black border-white",
            theme === 'god-of-war' && "bg-[#1a1a1a] border-[#ffd700]",
            theme === 'cuphead' && "bg-[#f5f5dc] border-black border-r-4 border-b-4"
          )} />

          <div className="relative z-10">
            {title && (
              <div className={cn(
                "font-bold text-lg mb-2 flex items-center gap-2",
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-cyan-400 font-mono uppercase",
                theme === 'vintage' && "text-[#4a3728] font-serif italic",
                theme === 'terminal' && "text-green-500 font-mono uppercase",
                theme === 'ethereal' && "text-indigo-900 font-serif",
                theme === 'prism' && "text-slate-800 font-sans",
                theme === 'minecraft' && "text-[#373737] font-pixel",
                theme === 'undertale' && "text-white font-retro tracking-widest",
                theme === 'god-of-war' && "text-[#ffd700] font-serif uppercase tracking-widest",
                theme === 'cuphead' && "text-black font-black uppercase tracking-tighter"
              )}>
                <Lightbulb className="w-5 h-5 flex-shrink-0" />
                <MarkdownContent content={title} />
              </div>
            )}
            
            {def && (
              <div className={cn(
                "mb-3",
                theme === 'modern' && "text-slate-700",
                theme === 'cyberpunk' && "text-cyan-100/80 font-mono text-sm",
                theme === 'vintage' && "text-[#5d4037] font-serif",
                theme === 'terminal' && "text-green-400/80 font-mono text-sm",
                theme === 'ethereal' && "text-indigo-800/80 font-serif",
                theme === 'prism' && "text-slate-600",
                theme === 'minecraft' && "text-[#373737] font-pixel",
                theme === 'undertale' && "text-gray-300 font-retro text-sm",
                theme === 'god-of-war' && "text-gray-300 font-serif",
                theme === 'cuphead' && "text-[#2c1e14] font-medium"
              )}>
                <MarkdownContent content={def} />
              </div>
            )}
            
            {simple && (
              <div className={cn(
                "p-3 mb-3",
                theme === 'modern' && "bg-blue-50 rounded-xl text-blue-800 font-medium",
                theme === 'cyberpunk' && "bg-cyan-950/50 border border-cyan-500/30 text-cyan-200 font-mono text-sm",
                theme === 'vintage' && "bg-[#f4ecd8] border-l-2 border-[#d4c5a1] text-[#854d0e] font-serif italic",
                theme === 'terminal' && "bg-green-900/30 border-l-2 border-green-500 text-green-300 font-mono text-sm",
                theme === 'ethereal' && "bg-indigo-50/50 rounded-2xl text-indigo-900 font-medium",
                theme === 'prism' && "bg-slate-50 rounded-xl text-slate-700 font-medium",
                theme === 'minecraft' && "bg-[#a0a0a0] border-2 border-[#373737] text-[#1e1e1e] font-pixel p-2",
                theme === 'undertale' && "bg-gray-900 border border-gray-700 text-white font-retro text-sm p-2",
                theme === 'god-of-war' && "bg-[#8b0000]/20 border-l-4 border-[#8b0000] text-[#ffd700] font-serif p-2",
                theme === 'cuphead' && "bg-[#fef08a] border-2 border-black text-black font-bold p-2 shadow-[2px_2px_0_rgba(0,0,0,1)]"
              )}>
                <MarkdownContent content={simple} />
              </div>
            )}
            
            {extra && (
              <div className={cn(
                "text-xs",
                theme === 'modern' && "text-slate-500 font-mono",
                theme === 'cyberpunk' && "text-purple-400 font-mono opacity-80",
                theme === 'vintage' && "text-[#8b4513] font-serif opacity-80",
                theme === 'terminal' && "text-green-600 font-mono",
                theme === 'ethereal' && "text-indigo-400 font-mono",
                theme === 'prism' && "text-slate-400 font-mono",
                theme === 'minecraft' && "text-[#555] font-pixel",
                theme === 'undertale' && "text-gray-500 font-retro",
                theme === 'god-of-war' && "text-gray-500 font-serif italic",
                theme === 'cuphead' && "text-gray-600 font-mono font-bold"
              )}>
                <MarkdownContent content={extra} />
              </div>
            )}
          </div>
        </div>
    </span>
  );
}

function MarkdownContent({ content, className, disableExplanations = false }: { content: string, className?: string, disableExplanations?: boolean }) {
  const { groupColor, nextColor, theme } = React.useContext(ColorContext);
  
  // Simple regex to support [c:color]text[/c] for color coding
  // and ==text== for highlighting
  let processedContent = content.replace(/\[c:([^\]]+)\]([^\[]*)\[\/c\]/g, (match, color, text) => {
    return `<span style="color: ${color}">${text}</span>`;
  });
  
  processedContent = processedContent.replace(/==([^=]+)==/g, (match, text) => {
    return `<mark>${text}</mark>`;
  });

  // Parse [term]{title|def|simple|extra} into <explanation>
  if (!disableExplanations) {
    processedContent = processedContent.replace(/\[([^\]]+)\]\{([^}]+)\}/g, (match, term, data) => {
      const safeData = data.replace(/"/g, '&quot;');
      return `<explanation data="${safeData}">${term}</explanation>`;
    });

    // Parse [[concept]] into <memorylink>
    processedContent = processedContent.replace(/\[\[([^\]]+)\]\]/g, (match, concept) => {
      return `<memorylink concept="${concept}">${concept}</memorylink>`;
    });
  } else {
    // Just render the term as plain text
    processedContent = processedContent.replace(/\[([^\]]+)\]\{([^}]+)\}/g, (match, term, data) => {
      return term;
    });

    // Just render the concept as plain text
    processedContent = processedContent.replace(/\[\[([^\]]+)\]\]/g, (match, concept) => {
      return concept;
    });
  }
  
  const boldColor = groupColor ? getShade(groupColor, -0.4) : undefined;
  const italicColor = groupColor ? getShade(groupColor, -0.2) : undefined;
  const markBg = groupColor ? getShade(groupColor, 0.8) : '#fef08a';
  const markText = groupColor ? getShade(groupColor, -0.6) : '#854d0e';
  
  return (
    <span className={cn("markdown-content inline", className)}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          p: ({ children }) => <span className="inline">{children}</span>,
          strong: ({ children }) => (
            <strong 
              className={cn("font-bold", theme === 'prism' && "text-transparent bg-clip-text", theme === 'god-of-war' && "text-[#ffd700] uppercase tracking-wider", theme === 'cuphead' && "text-black font-black")} 
              style={theme === 'prism' ? { backgroundImage: `linear-gradient(to right, ${groupColor || '#ef4444'}, ${nextColor || '#f97316'})` } : (theme === 'god-of-war' || theme === 'cuphead' ? {} : { color: boldColor })}
            >
              {children}
            </strong>
          ),
          em: ({ children }) => <em className={cn("italic", theme === 'god-of-war' && "text-[#8b0000]", theme === 'cuphead' && "text-[#4a3728]")} style={theme === 'god-of-war' || theme === 'cuphead' ? {} : { color: italicColor }}>{children}</em>,
          del: ({ children }) => <del className="opacity-50 line-through">{children}</del>,
          mark: ({ children }) => (
            <mark 
              className={cn("px-1 rounded-sm font-medium", theme === 'prism' && "text-white shadow-sm", theme === 'god-of-war' && "bg-[#8b0000] text-white px-2 py-0.5 rounded-none", theme === 'cuphead' && "bg-[#fef08a] text-black border-2 border-black px-2 py-0.5 rounded-none")} 
              style={theme === 'prism' ? { background: `linear-gradient(to right, ${groupColor || '#ef4444'}, ${nextColor || '#f97316'})` } : (theme === 'god-of-war' || theme === 'cuphead' ? {} : { backgroundColor: markBg, color: markText })}
            >
              {children}
            </mark>
          ),
          explanation: ({ node, children, ...props }: any) => (
            <ExplanationPopover data={props.data}>{children}</ExplanationPopover>
          ),
          memorylink: ({ node, children, ...props }: any) => (
            <MemoryLinkPopover concept={props.concept}>{children}</MemoryLinkPopover>
          ),
        } as any}
      >
        {processedContent}
      </ReactMarkdown>
    </span>
  );
}

export default function DocumentRenderer({ 
  data, 
  level = 1, 
  path = "root", 
  isDragModeActive = false, 
  isOrderingMode = false, 
  imagePlacements = {}, 
  onZoneClick, 
  onRemoveImage, 
  onUpdateImage, 
  onUpdateItem,
  onReorderGroupClick, 
  selectedColors, 
  groupColor: inheritedGroupColor,
  nextColor: inheritedNextColor,
  theme = 'modern'
}: Props & { nextColor?: string }) {
  const { groupColor: contextGroupColor, nextColor: contextNextColor } = React.useContext(ColorContext);
  const groupColor = inheritedGroupColor || contextGroupColor;
  const nextColor = inheritedNextColor || contextNextColor;

  const sanitizedPath = path.replace(/\s+/g, '_');

  if (data === null || data === undefined) return null;

  const renderDropAndImages = (currentPath: string) => (
    <>
      {isOrderingMode && <DroppableZone id={currentPath} active={isDragModeActive} onClick={() => onZoneClick?.(currentPath)} />}
      <PlacedImages images={imagePlacements[currentPath]} path={currentPath} isDragModeActive={isDragModeActive} onRemove={(index) => onRemoveImage?.(currentPath, index)} onUpdate={(index, updates) => onUpdateImage?.(currentPath, index, updates)} />
    </>
  );

  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    const text = String(data);
    const lowerText = text.toLowerCase();
    
    // Simple heuristic for highlighting
    const isImportant = lowerText.includes('important') || lowerText.includes('warning') || lowerText.includes('red flag') || lowerText.includes('complication') || lowerText.includes('treatment') || lowerText.includes('diagnosis');
    const isHighlight = lowerText.includes('highlight') || lowerText.includes('note');

    return (
      <div id={`doc-item-${sanitizedPath}`} className="break-inside-avoid flow-root">
        {renderDropAndImages(`${path}.before`)}
        <div className={cn(
          "mb-3 leading-relaxed transition-all",
          theme === 'modern' && "text-slate-700",
          theme === 'cyberpunk' && "text-purple-100 font-mono",
          theme === 'vintage' && "text-[#4a3728] font-serif italic",
          theme === 'terminal' && "text-green-400 font-mono",
          theme === 'ethereal' && "text-indigo-900/80 font-serif leading-loose",
          theme === 'prism' && "text-slate-700 font-sans",
          theme === 'god-of-war' && "text-slate-300 font-serif",
          theme === 'cuphead' && "text-[#2c1e14] font-sans font-medium",
          isImportant && theme === 'modern' && "text-red-600 font-semibold bg-red-50 px-2 py-1 rounded border-l-4 border-red-500",
          isImportant && theme === 'cyberpunk' && "text-red-400 font-bold bg-red-950/30 px-2 py-1 rounded border-l-4 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]",
          isImportant && theme === 'vintage' && "text-red-900 font-bold bg-red-100/50 px-2 py-1 border-2 border-red-900/20 rounded-sm",
          isImportant && theme === 'terminal' && "text-red-500 font-bold border-2 border-red-500 px-2 py-1 bg-red-500/10",
          isImportant && theme === 'ethereal' && "text-rose-900 font-medium bg-rose-50/50 px-3 py-2 rounded-2xl border border-rose-100",
          isImportant && theme === 'prism' && "text-white font-bold p-4 rounded-2xl shadow-lg",
          isImportant && theme === 'god-of-war' && "text-white font-bold bg-[#8b0000] p-4 border-l-8 border-[#ffd700] uppercase tracking-widest",
          isImportant && theme === 'cuphead' && "text-black font-black bg-white p-4 border-4 border-black shadow-[4px_4px_0_rgba(0,0,0,1)] transform rotate-1",
          isHighlight && theme === 'modern' && "bg-yellow-100 px-2 py-1 rounded text-amber-900 font-medium",
          isHighlight && theme === 'cyberpunk' && "bg-yellow-400/20 px-2 py-1 rounded text-yellow-300 font-bold border border-yellow-400/50 shadow-[0_0_15px_rgba(250,204,21,0.2)]",
          isHighlight && theme === 'vintage' && "bg-[#f4ecd8] px-2 py-1 rounded-sm text-[#854d0e] font-serif border-b-2 border-[#d4c5a1]",
          isHighlight && theme === 'terminal' && "bg-green-500 text-black px-1 font-bold",
          isHighlight && theme === 'ethereal' && "bg-amber-100/40 px-2 py-1 rounded-full text-amber-900 italic border border-amber-200/50",
          isHighlight && theme === 'prism' && "px-3 py-1 rounded-lg font-bold shadow-sm",
          isHighlight && theme === 'god-of-war' && "bg-[#ffd700]/20 text-[#ffd700] border border-[#ffd700] px-3 py-1 font-bold italic",
          isHighlight && theme === 'cuphead' && "bg-[#fef08a] text-black border-2 border-black px-3 py-1 font-black shadow-[2px_2px_0_rgba(0,0,0,1)]"
        )}
        style={{
          background: isImportant && theme === 'prism' ? `linear-gradient(135deg, ${groupColor || '#ef4444'}, ${nextColor || '#f97316'})` : 
                      isHighlight && theme === 'prism' ? `linear-gradient(to right, ${groupColor || '#fef08a'}, ${nextColor || '#fef3c7'})` : undefined,
          color: isHighlight && theme === 'prism' ? '#ffffff' : undefined
        }}
      >
          <MarkdownContent content={text} />
        </div>
        {renderDropAndImages(path)}
      </div>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return null;

    const isGroupArray = data.length > 0 && data.every(item => item && typeof item === 'object' && item.GROUP && item.ITEMS);
    
    if (isGroupArray) {
      return (
        <div className="flex flex-col gap-8 flow-root">
          {data.map((group, i) => (
            <GroupRenderer 
              key={group.id} 
              group={group} 
              groupIndex={i} 
              level={level} 
              path={`${path}.${i}`} 
              isDragModeActive={isDragModeActive} 
              isOrderingMode={isOrderingMode}
              imagePlacements={imagePlacements} 
              onZoneClick={onZoneClick} 
              onRemoveImage={onRemoveImage} 
              onUpdateImage={onUpdateImage}
              onReorderGroupClick={onReorderGroupClick}
              selectedColors={selectedColors}
              theme={theme}
            />
          ))}
        </div>
      );
    }

    // Check if it's an array of TYPE/CONTENT objects
    const isTypeContentArray = data.length > 0 && data.every(item => item && typeof item === 'object' && item.TYPE);
    
    if (isTypeContentArray) {
      return (
        <div className="relative flex flex-col gap-2 flow-root">
          {data.map((item, i) => (
            <React.Fragment key={i}>
              <DocumentRenderer 
                data={item} 
                level={level} 
                path={item.id || `${path}.${i}`} 
                isDragModeActive={isDragModeActive} 
                isOrderingMode={isOrderingMode}
                imagePlacements={imagePlacements} 
                onZoneClick={onZoneClick} 
                onRemoveImage={onRemoveImage} 
                onUpdateImage={onUpdateImage} 
                onReorderGroupClick={onReorderGroupClick} 
                theme={theme}
              />
            </React.Fragment>
          ))}
          {renderDropAndImages(path)}
        </div>
      );
    }

    // Check if it's an array of objects (render as table)
    const isTable = typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0]);
    
    if (isTable) {
      const keys = Array.from(new Set(data.flatMap(item => Object.keys(item))));
      
      return (
        <div className="break-inside-avoid flow-root">
          {renderDropAndImages(`${path}.before`)}
          <div className={cn(
            "overflow-x-auto mb-6 transition-all",
            theme === 'modern' && "rounded-xl border border-slate-200 shadow-sm",
            theme === 'cyberpunk' && "border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)] bg-black/80 backdrop-blur-sm",
            theme === 'vintage' && "border-2 border-[#d4a373] bg-[#fff9f0] p-1",
            theme === 'terminal' && "border-2 border-green-500 bg-black",
            theme === 'ethereal' && "rounded-3xl border border-indigo-100 bg-white/60 backdrop-blur-md shadow-[0_8px_32px_rgba(99,102,241,0.05)]",
            theme === 'prism' && "rounded-2xl bg-white shadow-xl border-none relative",
            theme === 'minecraft' && "bg-[#c6c6c6] border-4 border-[#373737] shadow-[inset_-4px_-4px_0_#555,inset_4px_4px_0_#fff] p-1",
            theme === 'undertale' && "bg-black border-4 border-white p-2",
            theme === 'god-of-war' && "bg-[#1a1a1a] border-2 border-[#8b0000] shadow-[0_10px_30px_rgba(0,0,0,0.8)]",
            theme === 'cuphead' && "bg-[#f5f5dc] border-4 border-black shadow-[8px_8px_0_rgba(0,0,0,1)]"
          )}>
            <table className={cn(
              "min-w-full",
              (theme === 'modern' || theme === 'prism' || theme === 'ethereal') && "divide-y",
              theme === 'modern' && "divide-slate-200",
              theme === 'ethereal' && "divide-indigo-50/50",
              theme === 'prism' && "divide-slate-100",
              (theme === 'vintage' || theme === 'minecraft' || theme === 'undertale' || theme === 'god-of-war' || theme === 'cuphead') && "border-collapse",
              theme === 'cyberpunk' && "divide-y divide-cyan-500/30",
              theme === 'terminal' && "divide-y divide-green-500/50"
            )}>
              <thead className={cn(
                theme === 'modern' && "bg-slate-50",
                theme === 'cyberpunk' && "bg-cyan-950/40",
                theme === 'vintage' && "border-b-2 border-[#d4a373]",
                theme === 'terminal' && "bg-green-900/30",
                theme === 'ethereal' && "border-b border-indigo-100/50",
                theme === 'prism' && "bg-slate-50/50",
                theme === 'minecraft' && "bg-[#8b8b8b] border-b-4 border-[#373737]",
                theme === 'undertale' && "border-b-4 border-white",
                theme === 'god-of-war' && "bg-[#8b0000]/20 border-b-2 border-[#ffd700]",
                theme === 'cuphead' && "bg-[#fef08a] border-b-4 border-black"
              )}>
                <tr>
                  {keys.map(k => (
                      <th key={k} className={cn(
                        "px-6 py-3 text-left uppercase",
                        theme === 'modern' && "text-[0.75em] font-bold text-slate-500 tracking-wider",
                        theme === 'cyberpunk' && "text-[0.75em] font-bold text-cyan-400 tracking-widest font-mono",
                        theme === 'vintage' && "text-[0.85em] font-bold text-[#8b4513] tracking-wider font-serif",
                        theme === 'terminal' && "text-[0.75em] font-bold text-green-400 tracking-widest font-mono",
                        theme === 'ethereal' && "text-[0.75em] font-bold text-indigo-400 tracking-widest font-serif",
                        theme === 'prism' && "text-[0.75em] font-black text-slate-400 tracking-widest",
                        theme === 'minecraft' && "px-4 text-[0.75em] text-white font-pixel drop-shadow-[2px_2px_0_#373737]",
                        theme === 'undertale' && "px-4 text-[0.85em] text-yellow-400 font-retro",
                        theme === 'god-of-war' && "text-[0.85em] text-[#ffd700] font-serif tracking-widest",
                        theme === 'cuphead' && "text-[0.85em] text-black font-black tracking-wider"
                      )}>
                        <MarkdownContent content={k} disableExplanations />
                      </th>
                  ))}
                </tr>
              </thead>
              <tbody className={cn(
                theme === 'modern' && "bg-white divide-y divide-slate-200",
                theme === 'cyberpunk' && "divide-y divide-cyan-500/20",
                theme === 'vintage' && "divide-y divide-[#d4a373]/30",
                theme === 'terminal' && "divide-y divide-green-500/30",
                theme === 'ethereal' && "divide-y divide-indigo-50/50",
                theme === 'prism' && "divide-y divide-slate-100",
                theme === 'minecraft' && "divide-y-4 divide-[#8b8b8b]",
                theme === 'undertale' && "divide-y-2 divide-white/30",
                theme === 'god-of-war' && "divide-y divide-[#4a4a4a]",
                theme === 'cuphead' && "divide-y-2 divide-black"
              )}>
                {data.map((row, i) => (
                  <tr key={i} className={cn(
                    "transition-colors",
                    theme === 'modern' && (i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50 hover:bg-blue-50/50'),
                    theme === 'cyberpunk' && (i % 2 === 0 ? 'bg-transparent' : 'bg-cyan-950/20 hover:bg-cyan-900/40'),
                    theme === 'vintage' && (i % 2 === 0 ? 'bg-transparent' : 'bg-[#f4ecd8]/50 hover:bg-[#e6d5b8]/50'),
                    theme === 'terminal' && 'hover:bg-green-900/40',
                    theme === 'ethereal' && 'hover:bg-indigo-50/30',
                    theme === 'prism' && (i % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/30 hover:bg-slate-50'),
                    theme === 'minecraft' && (i % 2 === 0 ? 'bg-transparent' : 'bg-[#b0b0b0] hover:bg-[#a0a0a0]'),
                    theme === 'undertale' && 'hover:bg-white/10',
                    theme === 'god-of-war' && (i % 2 === 0 ? 'bg-transparent' : 'bg-[#2a2a2a] hover:bg-[#8b0000]/10'),
                    theme === 'cuphead' && (i % 2 === 0 ? 'bg-transparent' : 'bg-[#e8e8d0] hover:bg-[#fef08a]/50')
                  )}>
                    {keys.map(k => (
                      <td key={k} className={cn(
                        "px-6 py-4 text-[0.875em] whitespace-pre-wrap",
                        theme === 'modern' && "text-slate-700",
                        theme === 'cyberpunk' && "text-cyan-100 font-mono",
                        theme === 'vintage' && "text-[#5d4037] font-serif",
                        theme === 'terminal' && "text-green-300 font-mono",
                        theme === 'ethereal' && "text-indigo-900/80 font-serif",
                        theme === 'prism' && "text-slate-700 font-medium",
                        theme === 'minecraft' && "px-4 py-3 text-[#373737] font-pixel",
                        theme === 'undertale' && "px-4 py-4 text-white font-retro",
                        theme === 'god-of-war' && "text-slate-300 font-serif",
                        theme === 'cuphead' && "text-[#2c1e14] font-medium"
                      )}>
                        {row[k] !== undefined ? (
                          <MarkdownContent content={typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k])} disableExplanations />
                        ) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderDropAndImages(path)}
        </div>
      );
    }

    // Render as bullet list
    return (
      <div id={`doc-item-${sanitizedPath}`} className="break-inside-avoid flow-root">
        {renderDropAndImages(path)}
        <ul className={cn(
          "list-disc pl-6 mb-6 space-y-2",
          theme === 'modern' && "marker:text-blue-400",
          theme === 'cyberpunk' && "marker:text-purple-500",
          theme === 'vintage' && "marker:text-[#8b4513]",
          theme === 'terminal' && "list-none pl-0",
          theme === 'ethereal' && "marker:text-indigo-200"
        )}>
          {data.map((item, i) => (
            <li key={i} className={cn(
              theme === 'modern' && "text-slate-700",
              theme === 'cyberpunk' && "text-purple-100 font-mono",
              theme === 'vintage' && "text-[#5d4037] font-serif",
              theme === 'terminal' && "text-green-400 font-mono before:content-['>'] before:mr-2",
              theme === 'ethereal' && "text-indigo-900/80 font-serif"
            )}>
              <DocumentRenderer data={item} level={level + 1} path={`${path}.${i}`} isDragModeActive={isDragModeActive} isOrderingMode={isOrderingMode} imagePlacements={imagePlacements} onZoneClick={onZoneClick} onRemoveImage={onRemoveImage} onUpdateImage={onUpdateImage} onUpdateItem={onUpdateItem} onReorderGroupClick={onReorderGroupClick} theme={theme} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (typeof data === 'object') {
    if (data.TYPE && data.CONTENT !== undefined) {
      const type = String(data.TYPE).toUpperCase();
      const content = String(data.CONTENT);

      let renderedContent = null;

      switch (type) {
        case 'TITLE':
          renderedContent = (
            <h1 
              className={cn(
                "mb-6 mt-8 transition-all",
                theme === 'modern' && "text-4xl font-extrabold text-slate-900 border-b-4 pb-4",
                theme === 'cyberpunk' && "text-5xl font-black text-white uppercase tracking-tighter italic border-l-8 pl-6 py-2 bg-gradient-to-r from-purple-900/20 to-transparent shadow-[0_0_20px_rgba(168,85,247,0.1)]",
                theme === 'vintage' && "text-4xl font-serif text-[#2c1e14] border-double border-b-4 pb-4 text-center italic",
                theme === 'terminal' && "text-4xl font-mono text-green-500 border-2 border-green-500 p-4 uppercase text-center bg-green-500/5 shadow-[0_0_15px_rgba(34,197,94,0.2)]",
                theme === 'ethereal' && "text-5xl font-serif text-indigo-900 text-center tracking-tight font-light italic border-b border-indigo-100 pb-8 mb-12",
                theme === 'prism' && "text-6xl font-black tracking-tighter italic text-center mb-16 mt-12 text-transparent bg-clip-text drop-shadow-sm",
                theme === 'minecraft' && "text-5xl font-pixel text-[#373737] text-center uppercase tracking-widest mb-12 p-8 bg-[#c6c6c6] border-8 border-[#373737] shadow-[inset_-8px_-8px_0_#555,inset_8px_8px_0_#fff]",
                theme === 'undertale' && "text-6xl font-retro text-yellow-400 text-center uppercase tracking-[0.2em] mb-16 drop-shadow-[0_4px_0_#000]",
                theme === 'god-of-war' && "text-6xl font-serif text-[#ffd700] text-center uppercase tracking-[0.4em] mb-16 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] border-b-4 border-[#8b0000] pb-8",
                theme === 'cuphead' && "text-7xl font-black text-black text-center uppercase tracking-tighter mb-16 transform -rotate-3 border-8 border-black p-8 bg-white shadow-[12px_12px_0_rgba(0,0,0,1)]",
              )} 
              style={{ 
                borderBottomColor: theme !== 'cyberpunk' && theme !== 'terminal' && theme !== 'ethereal' && theme !== 'prism' && theme !== 'god-of-war' && theme !== 'cuphead' ? (groupColor || '#f1f5f9') : undefined,
                borderLeftColor: theme === 'cyberpunk' ? (groupColor || '#a855f7') : undefined,
                color: theme === 'cyberpunk' ? (groupColor || undefined) : undefined,
                backgroundImage: theme === 'prism' ? `linear-gradient(to bottom right, ${groupColor || '#0f172a'}, ${nextColor || '#334155'})` : undefined
              }}
            >
              {theme === 'terminal' && "[ "}
              <MarkdownContent content={content} />
              {theme === 'terminal' && " ]"}
            </h1>
          );
          break;
        case 'SUBHEADER':
          renderedContent = (
            <h2 
              className={cn(
                "mb-4 mt-6 flex items-center transition-all",
                theme === 'modern' && "text-2xl font-bold text-slate-900",
                theme === 'cyberpunk' && "text-2xl font-bold text-cyan-400 font-mono uppercase tracking-widest border-b border-cyan-500/30 pb-1",
                theme === 'vintage' && "text-2xl font-serif text-[#4a3728] border-b border-[#d4c5a1] pb-1 italic",
                theme === 'terminal' && "text-xl font-mono text-amber-500 uppercase before:content-['#'] before:mr-2 border-b border-amber-500/30 pb-1",
                theme === 'ethereal' && "text-2xl font-serif text-indigo-800/70 border-b border-indigo-50 pb-2 font-medium tracking-wide",
                theme === 'prism' && "text-3xl font-black tracking-tighter italic text-transparent bg-clip-text mb-6 mt-10",
                theme === 'minecraft' && "text-3xl font-pixel text-[#373737] uppercase border-b-4 border-[#373737] pb-2 mb-6",
                theme === 'undertale' && "text-2xl font-retro text-white uppercase tracking-widest border-b-2 border-white pb-2 mb-6 flex items-center gap-3",
                theme === 'god-of-war' && "text-3xl font-serif text-[#ffd700] uppercase tracking-[0.2em] border-b-2 border-[#8b0000] pb-2 mb-8 flex items-center gap-4",
                theme === 'cuphead' && "text-4xl font-black text-black uppercase tracking-tighter mb-8 flex items-center gap-4 transform rotate-1",
              )}
              style={{
                backgroundImage: theme === 'prism' ? `linear-gradient(to right, ${groupColor || '#0f172a'}, ${nextColor || '#94a3b8'})` : undefined
              }}
            >
              {theme === 'modern' && <span className="w-2 h-8 mr-3 rounded-full" style={{ backgroundColor: groupColor || '#cbd5e1' }}></span>}
              {theme === 'cyberpunk' && <span className="w-4 h-4 mr-3 rotate-45 border-2" style={{ borderColor: groupColor || '#22d3ee', backgroundColor: `${groupColor || '#22d3ee'}33` }}></span>}
              {theme === 'ethereal' && <Star className="w-4 h-4 mr-3 text-amber-400/50" />}
              {theme === 'undertale' && <span className="text-red-600">❤</span>}
              {theme === 'god-of-war' && <Sword className="w-6 h-6 text-[#8b0000]" />}
              {theme === 'cuphead' && <div className="w-8 h-8 rounded-full bg-red-600 border-4 border-black" />}
              {theme === 'prism' && (
                <div className="w-10 h-1 mr-4 rounded-full" style={{ background: `linear-gradient(90deg, ${groupColor}, transparent)` }} />
              )}
              <MarkdownContent content={content} />
            </h2>
          );
          break;
        case 'BULLET':
          renderedContent = (
            <div className="flex items-start mb-2 ml-4">
              {theme === 'modern' && <span className="mr-3 mt-1.5 text-xl leading-none font-bold" style={{ color: groupColor || '#3b82f6' }}>•</span>}
              {theme === 'cyberpunk' && <span className="mr-3 mt-2 w-2 h-2 bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" style={{ backgroundColor: groupColor }}></span>}
              {theme === 'vintage' && <span className="mr-3 mt-1.5 font-serif italic text-lg" style={{ color: '#8b4513' }}>~</span>}
              {theme === 'terminal' && <span className="mr-3 mt-1.5 font-mono text-green-500">{">"}</span>}
              {theme === 'ethereal' && <div className="mr-4 mt-2.5 w-1.5 h-1.5 rounded-full bg-indigo-200 shadow-[0_0_8px_rgba(165,180,252,0.5)]"></div>}
              {theme === 'prism' && <div className="mr-4 mt-2.5 w-2 h-2 rounded-full shadow-lg" style={{ background: `linear-gradient(135deg, ${groupColor}, ${nextColor})` }}></div>}
              {theme === 'minecraft' && <div className="mr-3 mt-1.5 w-3 h-3 bg-[#373737] shadow-[inset_-2px_-2px_0_#555,inset_2px_2px_0_#fff]"></div>}
              {theme === 'undertale' && <span className="mr-3 mt-1.5 text-red-600 text-xs">❤</span>}
              {theme === 'god-of-war' && <Sword className="mr-3 mt-1.5 w-4 h-4 text-[#8b0000]" />}
              {theme === 'cuphead' && <div className="mr-3 mt-1.5 w-4 h-4 rounded-full bg-black border-2 border-white" />}
              <div className={cn(
                "text-lg",
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-purple-100 font-mono text-base",
                theme === 'vintage' && "text-[#5d4037] font-serif",
                theme === 'terminal' && "text-green-400 font-mono text-base",
                theme === 'ethereal' && "text-indigo-900/80 font-serif",
                theme === 'prism' && "text-slate-600 font-medium tracking-tight",
                theme === 'god-of-war' && "text-slate-200 font-serif",
                theme === 'cuphead' && "text-black font-black uppercase tracking-tighter"
              )}>
                <MarkdownContent content={content} />
              </div>
            </div>
          );
          break;
        case 'EXPLANATION':
          renderedContent = (
            <div className="flex items-start mb-4 mt-2">
              <div className={cn(
                "text-lg leading-relaxed",
                theme === 'modern' && "text-slate-800",
                theme === 'cyberpunk' && "text-cyan-100 font-mono text-base",
                theme === 'vintage' && "text-[#4a3728] font-serif",
                theme === 'terminal' && "text-green-300 font-mono text-base",
                theme === 'ethereal' && "text-indigo-900/90 font-serif",
                theme === 'prism' && "text-slate-700 font-medium tracking-tight",
                theme === 'minecraft' && "text-[#373737] font-pixel text-xl",
                theme === 'undertale' && "text-white font-retro text-lg",
                theme === 'god-of-war' && "text-slate-200 font-serif",
                theme === 'cuphead' && "text-[#2c1e14] font-medium text-xl"
              )}>
                <MarkdownContent content={content} />
              </div>
            </div>
          );
          break;
        case 'WARNING':
          renderedContent = (
            <div 
              className={cn(
                "border-l-4 p-5 mb-4 rounded-r-xl flex items-start shadow-sm transition-all",
                theme === 'cyberpunk' && "bg-red-950/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)] rounded-none border-r-4",
                theme === 'vintage' && "bg-[#fff9f0] border-[#d4a373] rounded-sm border-2 italic",
                theme === 'terminal' && "bg-black border-2 border-red-500 rounded-none shadow-[0_0_10px_rgba(239,68,68,0.3)]",
                theme === 'ethereal' && "bg-rose-50/30 border-rose-100 rounded-3xl shadow-sm",
                theme === 'prism' && "bg-white border-none rounded-3xl shadow-2xl p-8 overflow-hidden relative",
                theme === 'minecraft' && "bg-[#4a4a4a] border-4 border-[#1e1e1e] rounded-none shadow-[inset_-4px_-4px_0_#333,inset_4px_4px_0_#666]",
                theme === 'undertale' && "bg-black border-2 border-white rounded-none p-6",
                theme === 'god-of-war' && "bg-[#8b0000]/20 border-[#8b0000] border-l-8 rounded-none",
                theme === 'cuphead' && "bg-[#fef08a] border-4 border-black rounded-none shadow-[4px_4px_0_rgba(0,0,0,1)]",
              )}
              style={{ 
                backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.92) : '#fffbeb') : undefined,
                background: theme === 'prism' ? `linear-gradient(135deg, #fff, ${groupColor}05)` : undefined,
                borderLeftColor: groupColor || (theme === 'cyberpunk' ? '#ef4444' : (theme === 'terminal' ? '#ef4444' : (theme === 'god-of-war' ? '#8b0000' : '#facc15'))),
                borderRightColor: theme === 'cyberpunk' ? (groupColor || '#ef4444') : undefined
              }}
            >
              {theme === 'prism' && (
                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: `linear-gradient(to bottom, ${groupColor || '#ef4444'}, ${nextColor || '#f97316'})` }} />
              )}
              <AlertTriangle className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" style={{ color: groupColor || (theme === 'cyberpunk' ? '#ef4444' : (theme === 'terminal' ? '#ef4444' : (theme === 'minecraft' ? '#ff5555' : (theme === 'undertale' ? '#ffffff' : (theme === 'god-of-war' ? '#ffd700' : '#eab308'))))) }} />
              <div className={cn(
                "font-medium text-lg",
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-red-200 font-mono",
                theme === 'vintage' && "text-[#5d4037] font-serif",
                theme === 'terminal' && "text-red-500 font-mono uppercase",
                theme === 'ethereal' && "text-rose-900 font-serif",
                theme === 'prism' && "text-slate-800 font-sans",
                theme === 'minecraft' && "text-[#373737] font-pixel text-xl",
                theme === 'undertale' && "text-white font-retro text-lg tracking-widest",
                theme === 'god-of-war' && "text-[#ffd700] font-serif uppercase tracking-widest",
                theme === 'cuphead' && "text-black font-black uppercase tracking-tighter"
              )}>
                <MarkdownContent content={content} />
              </div>
            </div>
          );
          break;
        case 'TIP':
          renderedContent = (
            <div 
              className={cn(
                "border-l-4 p-5 mb-4 rounded-r-xl flex items-start shadow-sm transition-all",
                theme === 'cyberpunk' && "bg-emerald-950/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] rounded-none border-r-4",
                theme === 'vintage' && "bg-[#f0f9f0] border-[#8fb38f] rounded-sm border-2 italic",
                theme === 'terminal' && "bg-black border-2 border-green-500 rounded-none shadow-[0_0_10px_rgba(34,197,94,0.3)]",
                theme === 'ethereal' && "bg-emerald-50/30 border-emerald-100 rounded-3xl shadow-sm",
                theme === 'prism' && "bg-white border-none rounded-3xl shadow-2xl p-8 overflow-hidden relative",
                theme === 'minecraft' && "bg-[#c6c6c6] border-4 border-[#373737] rounded-none shadow-[inset_-4px_-4px_0_#555,inset_4px_4px_0_#fff]",
                theme === 'undertale' && "bg-black border-2 border-yellow-400 rounded-none p-6",
                theme === 'god-of-war' && "bg-[#1a1a1a] border-[#ffd700] border-2 rounded-none shadow-[inset_0_0_20px_rgba(255,215,0,0.1)]",
                theme === 'cuphead' && "bg-[#f5f5dc] border-4 border-black rounded-none shadow-[4px_4px_0_rgba(0,0,0,1)]",
              )}
              style={{ 
                backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.92) : '#f0fdf4') : undefined,
                background: theme === 'prism' ? `linear-gradient(135deg, white, ${groupColor}05)` : undefined,
                borderLeftColor: groupColor || (theme === 'cyberpunk' ? '#10b981' : (theme === 'terminal' ? '#22c55e' : (theme === 'god-of-war' ? '#ffd700' : '#22c55e'))),
                borderRightColor: theme === 'cyberpunk' ? (groupColor || '#10b981') : undefined
              }}
            >
              {theme === 'prism' && (
                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: `linear-gradient(to bottom, ${groupColor || '#10b981'}, ${nextColor || '#3b82f6'})` }} />
              )}
              <Lightbulb className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" style={{ color: groupColor || (theme === 'cyberpunk' ? '#10b981' : (theme === 'terminal' ? '#22c55e' : (theme === 'minecraft' ? '#55ff55' : (theme === 'undertale' ? '#ffff00' : (theme === 'god-of-war' ? '#ffd700' : '#22c55e'))))) }} />
              <div className={cn(
                "font-medium text-lg",
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-emerald-100 font-mono",
                theme === 'vintage' && "text-[#2d4a2d] font-serif",
                theme === 'terminal' && "text-green-400 font-mono uppercase",
                theme === 'ethereal' && "text-emerald-900 font-serif",
                theme === 'prism' && "text-slate-800 font-sans",
                theme === 'god-of-war' && "text-[#ffd700] font-serif italic",
                theme === 'cuphead' && "text-black font-black uppercase tracking-tighter"
              )}>
                <MarkdownContent content={content} />
              </div>
            </div>
          );
          break;
        case 'IMPORTANT':
          renderedContent = (
            <div 
              className={cn(
                "border-l-4 p-5 mb-4 rounded-r-xl flex items-start shadow-sm transition-all",
                theme === 'cyberpunk' && "bg-red-950/30 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] rounded-none border-r-4",
                theme === 'vintage' && "bg-[#fff5f5] border-[#c0392b] rounded-sm border-2 italic",
                theme === 'terminal' && "bg-red-500/10 border-2 border-red-500 rounded-none",
                theme === 'ethereal' && "bg-indigo-50/30 border-indigo-100 rounded-3xl shadow-sm",
                theme === 'prism' && "bg-white border-none rounded-3xl shadow-2xl p-8 overflow-hidden relative",
                theme === 'minecraft' && "bg-[#ff5555] border-4 border-[#373737] rounded-none shadow-[inset_-4px_-4px_0_#aa0000,inset_4px_4px_0_#ffaaaa]",
                theme === 'undertale' && "bg-black border-2 border-red-600 rounded-none p-6",
                theme === 'god-of-war' && "bg-[#8b0000] border-[#ffd700] border-l-8 rounded-none shadow-[0_10px_30px_rgba(139,0,0,0.3)]",
                theme === 'cuphead' && "bg-[#e63946] border-4 border-black rounded-none shadow-[4px_4px_0_rgba(0,0,0,1)]",
              )}
              style={{ 
                backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.92) : '#fef2f2') : undefined,
                background: theme === 'prism' ? `linear-gradient(135deg, white, ${groupColor}05)` : undefined,
                borderLeftColor: groupColor || (theme === 'god-of-war' ? '#ffd700' : '#ef4444'),
                borderRightColor: theme === 'cyberpunk' ? (groupColor || '#ef4444') : undefined
              }}
            >
              {theme === 'prism' && (
                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: `linear-gradient(to bottom, ${groupColor || '#f43f5e'}, ${nextColor || '#a855f7'})` }} />
              )}
              <AlertCircle className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" style={{ color: groupColor || (theme === 'god-of-war' ? '#ffd700' : '#ef4444') }} />
              <div className={cn(
                "font-bold text-lg",
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-red-100 font-mono uppercase tracking-tighter",
                theme === 'vintage' && "text-[#c0392b] font-serif",
                theme === 'terminal' && "text-red-500 font-mono uppercase italic",
                theme === 'ethereal' && "text-indigo-900 font-serif font-bold",
                theme === 'prism' && "text-slate-800 font-sans",
                theme === 'god-of-war' && "text-white font-serif uppercase tracking-[0.2em]",
                theme === 'cuphead' && "text-white font-black uppercase tracking-tighter"
              )}>
                <MarkdownContent content={content} />
              </div>
            </div>
          );
          break;
        case 'DEFINITION':
          const colonIndex = content.indexOf(':');
          if (colonIndex !== -1) {
            const term = content.substring(0, colonIndex).trim();
            const definition = content.substring(colonIndex + 1).trim();
            renderedContent = (
              <div 
                className={cn(
                  "mb-4 p-4 border flex items-start transition-all",
                  theme === 'modern' && "rounded-xl",
                  theme === 'cyberpunk' && "bg-blue-950/20 border-blue-500 rounded-none shadow-[0_0_15px_rgba(59,130,246,0.1)]",
                  theme === 'vintage' && "bg-[#fdfbf7] border-[#d4c5a1] rounded-sm border-2",
                  theme === 'terminal' && "bg-black border-2 border-green-500 rounded-none",
                  theme === 'ethereal' && "bg-white border border-indigo-50 rounded-2xl shadow-sm",
                  theme === 'prism' && "bg-white border-none rounded-3xl shadow-xl p-8 overflow-hidden relative",
                  theme === 'minecraft' && "bg-[#c6c6c6] border-4 border-[#373737] rounded-none shadow-[inset_-4px_-4px_0_#555,inset_4px_4px_0_#fff]",
                  theme === 'undertale' && "bg-black border-2 border-white rounded-none p-6",
                  theme === 'god-of-war' && "bg-[#1a1a1a] border-[#ffd700] border-2 rounded-none",
                  theme === 'cuphead' && "bg-[#f5f5dc] border-4 border-black rounded-none shadow-[4px_4px_0_rgba(0,0,0,1)]",
                )}
                style={{ 
                  backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.98) : '#f8fafc') : undefined, 
                  background: theme === 'prism' ? `linear-gradient(135deg, white, ${groupColor}05)` : undefined,
                  borderColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.85) : '#e2e8f0') : undefined 
                }}
              >
                {theme === 'prism' && (
                  <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: `linear-gradient(to bottom, ${groupColor}, ${nextColor})` }} />
                )}
                <BookOpen className="w-5 h-5 mr-3 flex-shrink-0 mt-1" style={{ color: groupColor || (theme === 'cyberpunk' ? '#06b6d4' : (theme === 'terminal' ? '#22c55e' : (theme === 'god-of-war' ? '#ffd700' : '#6366f1'))) }} />
                <div>
                  <span className={cn(
                    "font-bold text-lg",
                    theme === 'modern' && "text-slate-900",
                    theme === 'cyberpunk' && "text-cyan-400 font-mono uppercase",
                    theme === 'vintage' && "text-[#4a3728] font-serif italic",
                    theme === 'terminal' && "text-green-500 font-mono uppercase underline decoration-green-500/30",
                    theme === 'ethereal' && "text-indigo-900 font-serif italic",
                    theme === 'prism' && "text-2xl font-black tracking-tighter italic",
                    theme === 'minecraft' && "text-xl font-pixel text-[#373737] uppercase",
                    theme === 'undertale' && "text-lg font-retro text-yellow-400 uppercase tracking-widest",
                    theme === 'god-of-war' && "text-[#ffd700] font-serif uppercase tracking-widest",
                    theme === 'cuphead' && "text-black font-black uppercase tracking-tighter"
                  )} style={{ color: theme === 'prism' ? groupColor : undefined }}>
                    <MarkdownContent content={term} />:
                  </span> 
                  <span className={cn(
                    "text-lg ml-1",
                    theme === 'modern' && "text-slate-900",
                    theme === 'cyberpunk' && "text-blue-100 font-mono",
                    theme === 'vintage' && "text-[#5d4037] font-serif",
                    theme === 'terminal' && "text-green-400 font-mono",
                    theme === 'ethereal' && "text-indigo-900/70 font-serif",
                    theme === 'prism' && "text-slate-600 font-medium",
                    theme === 'god-of-war' && "text-slate-300 font-serif italic",
                    theme === 'cuphead' && "text-black font-medium"
                  )}>
                    <MarkdownContent content={definition} />
                  </span>
                </div>
              </div>
            );
          } else {
            renderedContent = (
              <div 
                className={cn(
                  "mb-4 p-4 border transition-all",
                  theme === 'modern' && "rounded-xl",
                  theme === 'cyberpunk' && "bg-blue-950/20 border-blue-500 rounded-none",
                  theme === 'vintage' && "bg-[#fdfbf7] border-[#d4c5a1] rounded-sm border-2",
                  theme === 'terminal' && "bg-black border-2 border-green-500 rounded-none",
                  theme === 'ethereal' && "bg-white border border-indigo-50 rounded-2xl shadow-sm",
                  theme === 'minecraft' && "bg-[#373737] border-4 border-[#1e1e1e] rounded-none shadow-[inset_-4px_-4px_0_#333,inset_4px_4px_0_#666] text-[#55ff55]",
                  theme === 'undertale' && "bg-black border-2 border-white rounded-none p-4 text-white font-retro",
                  theme === 'god-of-war' && "bg-[#1a1a1a] border-[#ffd700] border-2 rounded-none p-4 text-[#ffd700] font-serif italic",
                  theme === 'cuphead' && "bg-[#f5f5dc] border-4 border-black rounded-none p-4 text-black font-black uppercase tracking-tighter",
                )}
                style={{ 
                  backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.98) : '#f8fafc') : undefined, 
                  borderColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.85) : '#e2e8f0') : undefined 
                }}
              >
                <span className={cn(
                  "font-bold text-lg",
                  theme === 'modern' && "text-slate-900",
                  theme === 'cyberpunk' && "text-cyan-400 font-mono uppercase",
                  theme === 'vintage' && "text-[#4a3728] font-serif italic",
                  theme === 'terminal' && "text-green-500 font-mono uppercase",
                  theme === 'ethereal' && "text-indigo-900 font-serif italic"
                )}>
                  <MarkdownContent content={content} />
                </span>
              </div>
            );
          }
          break;
        case 'CODE':
          renderedContent = (
            <div 
              className={cn(
                "p-4 rounded-xl font-mono text-sm overflow-x-auto mb-4 transition-all",
                theme === 'cyberpunk' && "border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.2)] bg-black",
                theme === 'vintage' && "bg-[#f4f1ea] border border-[#d4c5a1] text-[#4a3728] rounded-sm",
                theme === 'terminal' && "bg-black border border-green-500 text-green-500 rounded-none shadow-[inset_0_0_10px_rgba(34,197,94,0.2)]",
                theme === 'ethereal' && "bg-slate-50 border border-slate-100 text-slate-600 rounded-2xl italic",
                theme === 'prism' && "bg-slate-900 text-white rounded-3xl shadow-2xl p-8 border-t-4",
                theme === 'god-of-war' && "bg-[#0a0a0a] border-[#8b0000] border-2 rounded-none shadow-[0_0_30px_rgba(139,0,0,0.2)] text-slate-400",
                theme === 'cuphead' && "bg-black border-4 border-black rounded-none p-4 text-white font-mono",
              )}
              style={{ 
                backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, -0.6) : '#1e293b') : undefined,
                borderTopColor: theme === 'prism' ? groupColor : undefined,
                color: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.9) : '#f8fafc') : undefined
              }}
            >
              {theme === 'prism' && (
                <div className="flex gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
              )}
              <MarkdownContent content={content} disableExplanations />
            </div>
          );
          break;
        case 'QUOTE':
          renderedContent = (
            <blockquote 
              className={cn(
                "border-l-4 pl-4 py-2 mb-4 italic text-lg rounded-r-xl transition-all",
                theme === 'cyberpunk' && "bg-purple-900/10 border-purple-500 font-mono text-purple-200",
                theme === 'vintage' && "bg-[#fdfbf7] border-[#8b4513] font-serif text-[#5d4037] border-y-2 border-r-2 rounded-sm",
                theme === 'terminal' && "bg-green-500/5 border-l-4 border-green-500 font-mono text-green-400 py-4",
                theme === 'ethereal' && "bg-transparent border-l-2 border-indigo-200 font-serif text-indigo-900/60 pl-8 py-6 text-xl leading-relaxed",
                theme === 'prism' && "bg-white border-none rounded-3xl shadow-lg p-10 relative italic text-2xl leading-relaxed",
                theme === 'minecraft' && "bg-[#c6c6c6] border-l-8 border-[#373737] font-pixel text-[#373737] pl-6 py-4 italic text-xl",
                theme === 'undertale' && "bg-black border-l-4 border-white font-retro text-white/80 pl-8 py-6 text-lg italic tracking-widest",
                theme === 'god-of-war' && "bg-[#1a1a1a] border-l-8 border-[#8b0000] border-r-8 font-serif text-slate-300 pl-8 py-6 text-xl leading-relaxed italic",
                theme === 'cuphead' && "bg-[#f5f5dc] border-4 border-black rounded-none shadow-[8px_8px_0_rgba(0,0,0,1)] p-8 text-black font-black uppercase tracking-tighter",
              )}
              style={{ 
                backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.95) : '#f8fafc') : undefined,
                background: theme === 'prism' ? `linear-gradient(135deg, white, ${groupColor}05)` : undefined,
                borderLeftColor: groupColor || (theme === 'cyberpunk' ? '#a855f7' : (theme === 'terminal' ? '#22c55e' : '#cbd5e1')),
                color: theme === 'modern' ? (groupColor ? getShade(groupColor, -0.4) : '#475569') : undefined
              }}
            >
              {theme === 'prism' && (
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full flex items-center justify-center text-white text-3xl font-black italic shadow-lg" style={{ background: `linear-gradient(135deg, ${groupColor}, ${nextColor})` }}>
                  "
                </div>
              )}
              <MarkdownContent content={content} />
            </blockquote>
          );
          break;
        case 'CHECKLIST':
          renderedContent = (
            <div className="flex items-start mb-2 ml-4 group/checklist">
              <div className={cn(
                "mr-3 mt-1 flex-shrink-0 transition-all",
                theme === 'cyberpunk' && "border-2 border-cyan-500 p-0.5 bg-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.3)]",
                theme === 'vintage' && "border border-[#8b4513] p-0.5 rounded-sm",
                theme === 'terminal' && "border border-green-500 p-0.5 rounded-none",
                theme === 'ethereal' && "bg-indigo-50 p-1 rounded-full",
                theme === 'prism' && "rounded-xl border-none shadow-md group-hover/checklist:scale-110 p-1",
                theme === 'minecraft' && "rounded-none border-4 border-[#373737] bg-[#c6c6c6] shadow-[inset_-2px_-2px_0_#555,inset_2px_2px_0_#fff] p-0.5",
                theme === 'undertale' && "rounded-none border-2 border-white bg-black p-1",
                theme === 'god-of-war' && "rounded-none border-2 border-[#ffd700] bg-[#1a1a1a] p-1",
                theme === 'cuphead' && "rounded-none border-4 border-black bg-white p-1",
              )} style={{ 
                backgroundColor: theme === 'prism' ? groupColor : undefined 
              }}>
                {theme === 'prism' ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <CheckSquare className="w-5 h-5" style={{ color: groupColor || (theme === 'cyberpunk' ? '#06b6d4' : (theme === 'vintage' ? '#8b4513' : (theme === 'terminal' ? '#22c55e' : (theme === 'god-of-war' ? '#ffd700' : '#3b82f6')))) }} />
                )}
              </div>
              <div className={cn(
                "text-lg",
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-cyan-100 font-mono",
                theme === 'vintage' && "text-[#5d4037] font-serif",
                theme === 'terminal' && "text-green-400 font-mono",
                theme === 'ethereal' && "text-indigo-900/80 font-serif",
                theme === 'prism' && "text-slate-700 font-bold tracking-tight",
                theme === 'god-of-war' && "text-slate-300 font-serif",
                theme === 'cuphead' && "text-black font-black uppercase tracking-tighter"
              )}>
                <MarkdownContent content={content} />
              </div>
            </div>
          );
          break;
        case 'EXAMPLE':
          renderedContent = (
            <div 
              className={cn(
                "border p-4 mb-4 transition-all",
                theme === 'modern' && "rounded-xl",
                theme === 'cyberpunk' && "bg-emerald-950/10 border-emerald-500/50 rounded-none border-l-4",
                theme === 'vintage' && "bg-[#fdfbf7] border-[#d4c5a1] rounded-sm border-2 border-dashed",
                theme === 'terminal' && "bg-black border-2 border-amber-500 rounded-none",
                theme === 'ethereal' && "bg-amber-50/20 border border-amber-100 rounded-3xl",
                theme === 'prism' && "bg-white border-none rounded-3xl shadow-xl p-8 overflow-hidden relative",
                theme === 'minecraft' && "bg-[#c6c6c6] border-4 border-[#373737] rounded-none shadow-[inset_-4px_-4px_0_#555,inset_4px_4px_0_#fff] p-6",
                theme === 'undertale' && "bg-black border-2 border-white rounded-none p-6",
                theme === 'god-of-war' && "bg-[#1a1a1a] border-[#ffd700] border-2 rounded-none p-6",
                theme === 'cuphead' && "bg-[#f5f5dc] border-4 border-black rounded-none p-6 shadow-[4px_4px_0_rgba(0,0,0,1)]",
              )}
              style={{ 
                backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.98) : '#f8fafc') : undefined, 
                background: theme === 'prism' ? `linear-gradient(135deg, white, ${groupColor}05)` : undefined,
                borderColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.9) : '#e2e8f0') : undefined 
              }}
            >
              {theme === 'prism' && (
                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: `linear-gradient(to bottom, ${groupColor || '#f59e0b'}, ${nextColor || '#ef4444'})` }} />
              )}
              <div 
                className={cn(
                  "flex items-center mb-2 font-bold text-sm uppercase tracking-wider",
                  theme === 'cyberpunk' && "text-emerald-400 font-mono",
                  theme === 'vintage' && "text-[#8b4513] font-serif italic",
                  theme === 'terminal' && "text-amber-500 font-mono",
                  theme === 'ethereal' && "text-amber-700 font-serif italic",
                  theme === 'prism' && "text-amber-500 font-black tracking-tighter italic",
                  theme === 'minecraft' && "text-xl font-pixel text-[#373737] uppercase",
                  theme === 'undertale' && "text-lg font-retro text-white uppercase tracking-widest",
                  theme === 'god-of-war' && "text-[#ffd700] font-serif",
                  theme === 'cuphead' && "text-black font-black"
                )}
                style={{ color: theme === 'modern' ? (groupColor ? getShade(groupColor, -0.2) : '#64748b') : undefined }}
              >
                <Info className="w-4 h-4 mr-2" /> Example
              </div>
              <div className={cn(
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-emerald-50 font-mono",
                theme === 'vintage' && "text-[#5d4037] font-serif",
                theme === 'terminal' && "text-amber-400 font-mono",
                theme === 'ethereal' && "text-indigo-900/70 font-serif",
                theme === 'prism' && "text-slate-600 font-medium",
                theme === 'god-of-war' && "text-slate-300 font-serif",
                theme === 'cuphead' && "text-black font-black uppercase tracking-tighter"
              )}>
                <MarkdownContent content={content} />
              </div>
            </div>
          );
          break;
        case 'FORMULA':
          renderedContent = (
            <div 
              className={cn(
                "border p-6 mb-4 flex flex-col items-center justify-center text-center transition-all",
                theme === 'modern' && "rounded-xl",
                theme === 'cyberpunk' && "bg-black border-cyan-500 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)] rounded-none border-2",
                theme === 'vintage' && "bg-[#fdfbf7] border-[#d4c5a1] rounded-sm border-2 shadow-inner",
                theme === 'terminal' && "bg-black border-2 border-green-500 rounded-none",
                theme === 'ethereal' && "bg-indigo-50/20 border border-indigo-100 rounded-[3rem] shadow-sm",
                theme === 'prism' && "bg-slate-900 border-none rounded-[3rem] shadow-2xl p-12 relative overflow-hidden",
                theme === 'minecraft' && "bg-[#373737] border-4 border-[#1e1e1e] rounded-none shadow-[inset_-4px_-4px_0_#333,inset_4px_4px_0_#666] p-8",
                theme === 'undertale' && "bg-black border-2 border-white rounded-none p-10",
                theme === 'god-of-war' && "bg-[#1a1a1a] border-[#ffd700] border-2 rounded-none p-12 text-[#ffd700] font-serif text-3xl uppercase tracking-[0.3em] shadow-[0_0_50px_rgba(255,215,0,0.1)]",
                theme === 'cuphead' && "bg-white border-8 border-black rounded-none p-12 text-black font-black text-4xl uppercase tracking-tighter transform rotate-2 shadow-[15px_15px_0_rgba(0,0,0,1)]",
              )}
              style={{ 
                backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.96) : '#eff6ff') : undefined, 
                borderColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.9) : '#dbeafe') : undefined 
              }}
            >
              {theme === 'prism' && (
                <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at center, ${groupColor}, transparent)` }} />
              )}
              <Calculator className="w-5 h-5 mb-2" style={{ color: groupColor || (theme === 'cyberpunk' ? '#06b6d4' : (theme === 'terminal' ? '#22c55e' : '#60a5fa')) }} />
              <code 
                className={cn(
                  "text-xl",
                  theme === 'modern' && "font-serif",
                  theme === 'cyberpunk' && "font-mono text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]",
                  theme === 'vintage' && "font-serif italic text-[#2c1e14]",
                  theme === 'terminal' && "font-mono text-green-500",
                  theme === 'ethereal' && "font-serif text-indigo-900 tracking-widest",
                  theme === 'prism' && "font-mono text-white text-3xl tracking-widest",
                  theme === 'minecraft' && "font-pixel text-[#55ff55] text-4xl",
                  theme === 'undertale' && "font-retro text-white text-3xl tracking-[0.3em]",
                )}
                style={{ color: (theme === 'modern' && groupColor) ? getShade(groupColor, -0.4) : (theme === 'modern' ? '#1e3a8a' : undefined) }}
              >
                <MarkdownContent content={content} />
              </code>
            </div>
          );
          break;
        case 'CALLOUT':
          renderedContent = (
            <div 
              className={cn(
                "border-l-4 p-5 mb-4 rounded-r-xl flex items-start shadow-sm transition-all",
                theme === 'cyberpunk' && "bg-purple-950/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)] rounded-none border-r-4",
                theme === 'vintage' && "bg-[#fdfbf7] border-[#d4c5a1] rounded-sm border-2 italic",
                theme === 'terminal' && "bg-black border-2 border-purple-500 rounded-none",
                theme === 'ethereal' && "bg-indigo-50/10 border border-indigo-100 rounded-3xl shadow-sm",
                theme === 'prism' && "bg-white border-none rounded-3xl shadow-2xl p-8 overflow-hidden relative",
                theme === 'minecraft' && "bg-[#c6c6c6] border-4 border-[#373737] rounded-none shadow-[inset_-4px_-4px_0_#555,inset_2px_2px_0_#fff] p-6",
                theme === 'undertale' && "bg-black border-2 border-purple-500 rounded-none p-6",
              )}
              style={{ 
                backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.92) : '#faf5ff') : undefined,
                background: theme === 'prism' ? `linear-gradient(135deg, white, ${groupColor}05)` : undefined,
                borderLeftColor: groupColor || (theme === 'cyberpunk' ? '#a855f7' : (theme === 'terminal' ? '#a855f7' : '#a855f7')),
                borderRightColor: theme === 'cyberpunk' ? (groupColor || '#a855f7') : undefined
              }}
            >
              {theme === 'prism' && (
                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: `linear-gradient(to bottom, ${groupColor || '#a855f7'}, ${nextColor || '#3b82f6'})` }} />
              )}
              <MessageSquare className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" style={{ color: groupColor || (theme === 'cyberpunk' ? '#a855f7' : (theme === 'terminal' ? '#a855f7' : '#a855f7')) }} />
              <div className={cn(
                "font-medium text-lg",
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-purple-100 font-mono",
                theme === 'vintage' && "text-[#5d4037] font-serif",
                theme === 'terminal' && "text-purple-400 font-mono",
                theme === 'ethereal' && "text-indigo-900 font-serif",
                theme === 'prism' && "text-slate-800 font-sans",
                theme === 'minecraft' && "text-xl font-pixel text-[#373737] uppercase",
                theme === 'undertale' && "text-lg font-retro text-white uppercase tracking-widest",
              )}>
                <MarkdownContent content={content} />
              </div>
            </div>
          );
          break;
        case 'CONCEPT':
          renderedContent = (
            <div 
              className={cn(
                "border-l-4 p-5 mb-4 rounded-r-xl flex items-start shadow-sm transition-all",
                theme === 'cyberpunk' && "bg-cyan-950/20 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)] rounded-none border-r-4",
                theme === 'vintage' && "bg-[#f0f7ff] border-[#a1c4d4] rounded-sm border-2 italic",
                theme === 'terminal' && "bg-black border-2 border-cyan-500 rounded-none",
                theme === 'ethereal' && "bg-cyan-50/10 border border-cyan-100 rounded-3xl shadow-sm",
                theme === 'prism' && "bg-white border-none rounded-3xl shadow-2xl p-8 overflow-hidden relative",
                theme === 'minecraft' && "bg-[#c6c6c6] border-4 border-[#373737] rounded-none shadow-[inset_-4px_-4px_0_#555,inset_4px_4px_0_#fff] p-6",
                theme === 'undertale' && "bg-black border-2 border-cyan-400 rounded-none p-6",
              )}
              style={{ 
                backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.92) : '#f0f9ff') : undefined,
                background: theme === 'prism' ? `linear-gradient(135deg, white, ${groupColor}05)` : undefined,
                borderLeftColor: groupColor || (theme === 'cyberpunk' ? '#06b6d4' : (theme === 'terminal' ? '#06b6d4' : '#0ea5e9')),
                borderRightColor: theme === 'cyberpunk' ? (groupColor || '#06b6d4') : undefined
              }}
            >
              {theme === 'prism' && (
                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: `linear-gradient(to bottom, ${groupColor || '#06b6d4'}, ${nextColor || '#3b82f6'})` }} />
              )}
              <Lightbulb className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" style={{ color: groupColor || (theme === 'cyberpunk' ? '#06b6d4' : (theme === 'terminal' ? '#06b6d4' : '#0ea5e9')) }} />
              <div className={cn(
                "font-medium text-lg",
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-cyan-100 font-mono",
                theme === 'vintage' && "text-[#2d4a5d] font-serif",
                theme === 'terminal' && "text-cyan-400 font-mono",
                theme === 'ethereal' && "text-cyan-900 font-serif",
                theme === 'prism' && "text-slate-800 font-sans"
              )}>
                <MarkdownContent content={content} />
              </div>
            </div>
          );
          break;
        case 'MNEMONIC':
          renderedContent = (
            <div 
              className={cn(
                "border-l-4 p-5 mb-4 rounded-r-xl flex items-start shadow-sm transition-all",
                theme === 'cyberpunk' && "bg-indigo-950/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)] rounded-none border-r-4",
                theme === 'vintage' && "bg-[#f5f3ff] border-[#b1a1d4] rounded-sm border-2 italic",
                theme === 'terminal' && "bg-black border-2 border-indigo-500 rounded-none",
                theme === 'ethereal' && "bg-indigo-50/10 border border-indigo-100 rounded-3xl shadow-sm",
                theme === 'prism' && "bg-white border-none rounded-3xl shadow-2xl p-8 overflow-hidden relative",
                theme === 'minecraft' && "bg-[#c6c6c6] border-4 border-[#373737] rounded-none shadow-[inset_-4px_-4px_0_#555,inset_2px_2px_0_#fff] p-6",
                theme === 'undertale' && "bg-black border-2 border-indigo-500 rounded-none p-6",
              )}
              style={{ 
                backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.92) : '#eef2ff') : undefined,
                background: theme === 'prism' ? `linear-gradient(135deg, white, ${groupColor}05)` : undefined,
                borderLeftColor: groupColor || (theme === 'cyberpunk' ? '#6366f1' : (theme === 'terminal' ? '#6366f1' : '#6366f1')),
                borderRightColor: theme === 'cyberpunk' ? (groupColor || '#6366f1') : undefined
              }}
            >
              {theme === 'prism' && (
                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: `linear-gradient(to bottom, ${groupColor || '#6366f1'}, ${nextColor || '#ec4899'})` }} />
              )}
              <Brain className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" style={{ color: groupColor || (theme === 'cyberpunk' ? '#6366f1' : (theme === 'terminal' ? '#6366f1' : '#6366f1')) }} />
              <div className={cn(
                "font-medium text-lg",
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-indigo-100 font-mono",
                theme === 'vintage' && "text-[#4a4a5d] font-serif",
                theme === 'terminal' && "text-indigo-400 font-mono",
                theme === 'ethereal' && "text-indigo-900 font-serif",
                theme === 'prism' && "text-slate-800 font-sans"
              )}>
                <MarkdownContent content={content} />
              </div>
            </div>
          );
          break;
        case 'KEY_POINT':
          renderedContent = (
            <div 
              className={cn(
                "border-l-4 p-5 mb-4 rounded-r-xl flex items-start shadow-sm transition-all",
                theme === 'cyberpunk' && "bg-amber-950/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)] rounded-none border-r-4",
                theme === 'vintage' && "bg-[#fffbeb] border-[#d4a373] rounded-sm border-2 italic",
                theme === 'terminal' && "bg-black border-2 border-amber-500 rounded-none",
                theme === 'ethereal' && "bg-amber-50/10 border border-amber-100 rounded-3xl shadow-sm",
                theme === 'prism' && "bg-white border-none rounded-3xl shadow-2xl p-8 overflow-hidden relative",
                theme === 'minecraft' && "bg-[#c6c6c6] border-4 border-[#373737] rounded-none shadow-[inset_-4px_-4px_0_#555,inset_2px_2px_0_#fff] p-6",
                theme === 'undertale' && "bg-black border-2 border-amber-500 rounded-none p-6",
              )}
              style={{ 
                backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.92) : '#fffbeb') : undefined,
                background: theme === 'prism' ? `linear-gradient(135deg, white, ${groupColor}05)` : undefined,
                borderLeftColor: groupColor || (theme === 'cyberpunk' ? '#f59e0b' : (theme === 'terminal' ? '#f59e0b' : '#f59e0b')),
                borderRightColor: theme === 'cyberpunk' ? (groupColor || '#f59e0b') : undefined
              }}
            >
              {theme === 'prism' && (
                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: `linear-gradient(to bottom, ${groupColor || '#f59e0b'}, ${nextColor || '#3b82f6'})` }} />
              )}
              <Star className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" style={{ color: groupColor || (theme === 'cyberpunk' ? '#f59e0b' : (theme === 'terminal' ? '#f59e0b' : '#f59e0b')) }} />
              <div className={cn(
                "font-medium text-lg",
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-amber-100 font-mono",
                theme === 'vintage' && "text-[#5d4a2d] font-serif",
                theme === 'terminal' && "text-amber-400 font-mono",
                theme === 'ethereal' && "text-amber-900 font-serif",
                theme === 'prism' && "text-slate-800 font-sans"
              )}>
                <MarkdownContent content={content} />
              </div>
            </div>
          );
          break;
        case 'SUMMARY':
          renderedContent = (
            <div 
              className={cn(
                "border-l-4 p-5 mb-4 rounded-r-xl flex items-start shadow-sm transition-all",
                theme === 'cyberpunk' && "bg-slate-900/50 border-slate-500 shadow-[0_0_15px_rgba(100,116,139,0.2)] rounded-none border-r-4",
                theme === 'vintage' && "bg-[#f8fafc] border-[#64748b] rounded-sm border-2 italic",
                theme === 'terminal' && "bg-black border-2 border-slate-500 rounded-none",
                theme === 'ethereal' && "bg-slate-50/10 border border-slate-100 rounded-3xl shadow-sm",
                theme === 'prism' && "bg-white border-none rounded-3xl shadow-2xl p-8 overflow-hidden relative",
                theme === 'minecraft' && "bg-[#c6c6c6] border-4 border-[#373737] rounded-none shadow-[inset_-4px_-4px_0_#555,inset_2px_2px_0_#fff] p-6",
                theme === 'undertale' && "bg-black border-2 border-slate-500 rounded-none p-6",
              )}
              style={{ 
                backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.92) : '#f8fafc') : undefined,
                background: theme === 'prism' ? `linear-gradient(135deg, white, ${groupColor}05)` : undefined,
                borderLeftColor: groupColor || (theme === 'cyberpunk' ? '#64748b' : (theme === 'terminal' ? '#64748b' : '#64748b')),
                borderRightColor: theme === 'cyberpunk' ? (groupColor || '#64748b') : undefined
              }}
            >
              {theme === 'prism' && (
                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: `linear-gradient(to bottom, ${groupColor || '#64748b'}, ${nextColor || '#3b82f6'})` }} />
              )}
              <ClipboardList className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" style={{ color: groupColor || (theme === 'cyberpunk' ? '#94a3b8' : (theme === 'terminal' ? '#94a3b8' : '#64748b')) }} />
              <div className={cn(
                "font-medium text-lg",
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-slate-100 font-mono",
                theme === 'vintage' && "text-[#334155] font-serif",
                theme === 'terminal' && "text-slate-400 font-mono",
                theme === 'ethereal' && "text-slate-900 font-serif",
                theme === 'prism' && "text-slate-800 font-sans"
              )}>
                <MarkdownContent content={content} />
              </div>
            </div>
          );
          break;
        case 'STEP':
          renderedContent = (
            <div className="flex items-start mb-3 ml-2 group/step">
              <div 
                className={cn(
                  "p-1 rounded-full mr-3 mt-0.5 flex-shrink-0 transition-all",
                  theme === 'cyberpunk' && "rounded-none bg-cyan-500/20 border border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]",
                  theme === 'terminal' && "rounded-none bg-black border border-green-500",
                  theme === 'ethereal' && "rounded-full bg-indigo-50 border border-indigo-100 shadow-sm",
                  theme === 'vintage' && "bg-transparent border-b-2 border-[#8b4513] rounded-none",
                  theme === 'prism' && "rounded-xl bg-white shadow-lg border-none p-2 group-hover/step:scale-110 transition-transform",
                  theme === 'minecraft' && "rounded-none border-4 border-[#373737] bg-[#c6c6c6] shadow-[inset_-2px_-2px_0_#555,inset_2px_2px_0_#fff] p-1",
                  theme === 'undertale' && "rounded-none border-2 border-white bg-black p-1",
                )}
                style={{ backgroundColor: theme === 'modern' ? (groupColor ? getShade(groupColor, 0.9) : '#dbeafe') : undefined }}
              >
                <ArrowRight className="w-4 h-4" style={{ color: groupColor || (theme === 'cyberpunk' ? '#06b6d4' : (theme === 'terminal' ? '#22c55e' : (theme === 'ethereal' ? '#6366f1' : (theme === 'vintage' ? '#8b4513' : (theme === 'prism' ? '#3b82f6' : '#2563eb'))))) }} />
              </div>
              <div className={cn(
                "text-lg font-medium",
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-cyan-50 font-mono",
                theme === 'terminal' && "text-green-400 font-mono",
                theme === 'ethereal' && "text-indigo-900 font-serif italic",
                theme === 'vintage' && "text-[#5d4037] font-serif italic",
                theme === 'prism' && "text-slate-700 font-bold tracking-tight"
              )}>
                <MarkdownContent content={content} />
              </div>
            </div>
          );
          break;
        case 'TIMELINE':
          const pipeIndex = content.indexOf('|');
          if (pipeIndex !== -1) {
            const time = content.substring(0, pipeIndex).trim();
            const event = content.substring(pipeIndex + 1).trim();
            renderedContent = (
              <div className="flex items-start mb-4 relative">
                <div className={cn(
                  "absolute left-[11px] top-6 bottom-[-16px] w-0.5",
                  theme === 'modern' && "bg-slate-200",
                  theme === 'cyberpunk' && "bg-purple-500/30",
                  theme === 'terminal' && "bg-green-500/30",
                  theme === 'ethereal' && "bg-indigo-100",
                  theme === 'vintage' && "bg-[#d4c5a1]",
                  theme === 'prism' && "bg-slate-200",
                  theme === 'minecraft' && "bg-[#373737]",
                  theme === 'undertale' && "bg-white",
                )}></div>
                <div 
                  className={cn(
                    "border-2 p-1 mr-4 relative z-10 mt-1 transition-all",
                    theme === 'modern' && "bg-white rounded-full",
                    theme === 'cyberpunk' && "bg-black rounded-none border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]",
                    theme === 'terminal' && "bg-black rounded-none border-green-500",
                    theme === 'ethereal' && "bg-white rounded-full border-indigo-200 shadow-sm",
                    theme === 'vintage' && "bg-[#fdfbf7] rounded-sm border-[#8b4513]",
                    theme === 'prism' && "bg-white rounded-full border-none shadow-lg p-2",
                    theme === 'minecraft' && "bg-[#c6c6c6] rounded-none border-4 border-[#373737] shadow-[inset_-2px_-2px_0_#555,inset_2px_2px_0_#fff]",
                    theme === 'undertale' && "bg-black rounded-none border-2 border-white",
                  )}
                  style={{ borderColor: theme === 'modern' ? (groupColor || '#3b82f6') : undefined }}
                >
                  <Clock className="w-3 h-3" style={{ color: groupColor || (theme === 'cyberpunk' ? '#a855f7' : (theme === 'terminal' ? '#22c55e' : (theme === 'ethereal' ? '#6366f1' : (theme === 'vintage' ? '#8b4513' : (theme === 'prism' ? '#3b82f6' : '#3b82f6'))))) }} />
                </div>
                <div className={cn(
                  "flex-1 shadow-sm p-3 transition-all",
                  theme === 'modern' && "bg-white border border-slate-100 rounded-xl",
                  theme === 'cyberpunk' && "bg-purple-950/10 border border-purple-500/30 rounded-none",
                  theme === 'terminal' && "bg-black border border-green-900 rounded-none",
                  theme === 'ethereal' && "bg-white/50 border border-indigo-50/50 rounded-2xl shadow-sm",
                  theme === 'vintage' && "bg-[#fdfbf7] border-b-2 border-[#d4c5a1] rounded-none",
                  theme === 'prism' && "bg-white border-none rounded-2xl shadow-xl p-6",
                  theme === 'minecraft' && "bg-[#c6c6c6] border-4 border-[#373737] rounded-none shadow-[inset_-4px_-4px_0_#555,inset_4px_4px_0_#fff] p-4",
                  theme === 'undertale' && "bg-black border-2 border-white rounded-none p-4",
                )}>
                  <span 
                    className={cn(
                      "font-bold text-sm block mb-1",
                      theme === 'cyberpunk' && "font-mono uppercase tracking-widest",
                      theme === 'terminal' && "font-mono uppercase text-green-500",
                      theme === 'ethereal' && "font-serif italic text-indigo-600",
                      theme === 'vintage' && "font-serif italic",
                      theme === 'prism' && "text-blue-600 font-black tracking-tighter italic",
                      theme === 'minecraft' && "font-pixel text-[#373737] text-lg",
                      theme === 'undertale' && "font-retro text-yellow-400 text-base tracking-widest",
                    )}
                    style={{ color: groupColor || (theme === 'cyberpunk' ? '#a855f7' : (theme === 'terminal' ? '#22c55e' : (theme === 'ethereal' ? '#6366f1' : (theme === 'vintage' ? '#8b4513' : (theme === 'prism' ? '#3b82f6' : '#2563eb'))))) }}
                  >
                    <MarkdownContent content={time} />
                  </span>
                  <div className={cn(
                    theme === 'modern' && "text-slate-900",
                    theme === 'cyberpunk' && "text-purple-100 font-mono",
                    theme === 'terminal' && "text-green-400 font-mono",
                    theme === 'ethereal' && "text-slate-800 font-serif",
                    theme === 'vintage' && "text-[#5d4037] font-serif",
                    theme === 'prism' && "text-slate-700 font-bold tracking-tight",
                    theme === 'minecraft' && "text-[#373737] font-pixel text-base",
                    theme === 'undertale' && "text-white font-retro text-sm tracking-wide",
                  )}>
                    <MarkdownContent content={event} />
                  </div>
                </div>
              </div>
            );
          } else {
            renderedContent = (
              <div className={cn(
                "mb-2 text-lg",
                theme === 'modern' && "text-slate-900",
                theme === 'cyberpunk' && "text-purple-100 font-mono",
                theme === 'terminal' && "text-green-400 font-mono",
                theme === 'ethereal' && "text-slate-800 font-serif italic",
                theme === 'vintage' && "text-[#5d4037] font-serif"
              )}>
                <MarkdownContent content={content} />
              </div>
            );
          }
          break;
        case 'IMG':
          renderedContent = (
            <div className="my-4 relative group/img-block-container">
              {content ? (
                <div className={cn(
                  "relative group/img-block overflow-hidden",
                  theme === 'modern' && "rounded-2xl shadow-md",
                  theme === 'cyberpunk' && "rounded-none border-2 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.2)]",
                  theme === 'vintage' && "rounded-sm border-4 border-double border-[#8b4513] p-1 bg-[#fdfbf7]",
                  theme === 'terminal' && "rounded-none border-2 border-green-500 bg-black p-2",
                  theme === 'prism' && "rounded-[2rem] shadow-2xl",
                  theme === 'minecraft' && "rounded-none border-8 border-[#373737] bg-[#c6c6c6] p-2",
                  theme === 'undertale' && "rounded-none border-4 border-white bg-black p-2",
                )}>
                  <img src={content} alt="Content" className="w-full h-auto block" />
                  {isOrderingMode && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img-block:opacity-100 transition-opacity flex items-center justify-center pointer-events-auto">
                      <button 
                        onClick={() => onZoneClick?.(path)}
                        className="px-4 py-2 bg-white text-blue-600 font-bold rounded-xl shadow-lg hover:bg-blue-50 transition-all active:scale-95 flex items-center gap-2"
                      >
                        <ImageIcon className="w-4 h-4" />
                        Change Image
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div 
                  onClick={() => isOrderingMode && onZoneClick?.(path)}
                  className={cn(
                    "p-8 border-2 border-dashed flex flex-col items-center justify-center text-slate-400",
                    isOrderingMode && "cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all",
                    theme === 'modern' && "rounded-2xl border-slate-200 bg-slate-50",
                    theme === 'cyberpunk' && "rounded-none border-cyan-500/30 bg-cyan-950/10",
                    theme === 'terminal' && "rounded-none border-green-900 bg-black",
                  )}
                >
                  <ImageIcon className="w-8 h-8 mb-2 opacity-20" />
                  <span className="text-xs font-bold uppercase tracking-widest opacity-40">
                    {isOrderingMode ? "Click to Upload Image" : "No Image Uploaded"}
                  </span>
                </div>
              )}
            </div>
          );
          break;
        case 'DIVIDER':
          renderedContent = (
            <hr 
              className={cn(
                "my-8 border-t-2 transition-all",
                theme === 'modern' && "border-slate-100",
                theme === 'cyberpunk' && "border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]",
                theme === 'terminal' && "border-green-900 border-dashed",
                theme === 'ethereal' && "border-indigo-50 border-dotted",
                theme === 'vintage' && "border-[#d4c5a1] border-double border-t-4",
                theme === 'prism' && "border-none h-px my-12 opacity-20",
                theme === 'minecraft' && "border-[#373737] border-t-4 shadow-[0_4px_0_#555]",
                theme === 'undertale' && "border-white border-t-2 border-dashed",
              )} 
              style={{ 
                background: theme === 'prism' ? `linear-gradient(90deg, transparent, ${groupColor || '#3b82f6'}, transparent)` : undefined
              }}
            />
          );
          break;
        case 'TABLE_HEAD':
          const headers = content.split('|').map(s => s.trim());
          renderedContent = (
            <div className={cn(
              "overflow-x-auto mb-0 border-t border-l border-r transition-all",
              theme === 'modern' && "rounded-t-xl border-slate-200 bg-slate-50",
              theme === 'cyberpunk' && "bg-blue-950/30 border-blue-500/50 rounded-none",
              theme === 'terminal' && "bg-black border-green-500 rounded-none",
              theme === 'ethereal' && "bg-indigo-50/30 border-indigo-100 rounded-t-2xl",
              theme === 'vintage' && "bg-[#f4f1ea] border-[#d4c5a1] rounded-none",
              theme === 'prism' && "bg-slate-900 border-none rounded-t-[2rem] overflow-hidden",
              theme === 'minecraft' && "bg-[#c6c6c6] border-4 border-[#373737] rounded-none shadow-[inset_-4px_-4px_0_#555,inset_2px_2px_0_#fff]",
              theme === 'undertale' && "bg-black border-2 border-white rounded-none",
            )}>
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    {headers.map((h, idx) => (
                      <th 
                        key={idx} 
                        className={cn(
                          "px-6 py-4 text-left text-xs font-bold uppercase tracking-wider",
                          theme === 'modern' && "text-slate-500",
                          theme === 'cyberpunk' && "text-cyan-400 font-mono",
                          theme === 'terminal' && "text-green-500 font-mono",
                          theme === 'ethereal' && "text-indigo-600 font-serif",
                          theme === 'vintage' && "text-[#4a3728] font-serif",
                          theme === 'prism' && "text-white font-black tracking-tighter italic",
                          theme === 'minecraft' && "text-[#373737] font-pixel text-lg",
                          theme === 'undertale' && "text-yellow-400 font-retro text-base tracking-widest",
                        )}
                      >
                        <MarkdownContent content={h} disableExplanations />
                      </th>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>
          );
          break;
        case 'TABLE_ROW':
          const cells = content.split('|').map(s => s.trim());
          renderedContent = (
            <div className={cn(
              "overflow-x-auto border-l border-r border-b transition-all",
              theme === 'modern' && "bg-white border-slate-200 last:rounded-b-xl",
              theme === 'cyberpunk' && "bg-black border-blue-500/50 rounded-none",
              theme === 'terminal' && "bg-black border-green-900 rounded-none",
              theme === 'ethereal' && "bg-white/50 border-indigo-50 rounded-none",
              theme === 'vintage' && "bg-[#fdfbf7] border-[#d4c5a1] rounded-none",
              theme === 'prism' && "bg-white border-none last:rounded-b-[2rem] shadow-xl",
              theme === 'minecraft' && "bg-[#c6c6c6] border-4 border-[#373737] rounded-none shadow-[inset_-4px_-4px_0_#555,inset_4px_4px_0_#fff]",
              theme === 'undertale' && "bg-black border-2 border-white rounded-none",
            )}>
              <table className="min-w-full divide-y divide-slate-200">
                <tbody>
                  <tr className={cn(
                    "transition-colors",
                    theme === 'modern' && "hover:bg-slate-50",
                    theme === 'cyberpunk' && "hover:bg-blue-900/10",
                    theme === 'terminal' && "hover:bg-green-900/10",
                    theme === 'ethereal' && "hover:bg-indigo-50/20",
                    theme === 'vintage' && "hover:bg-[#f4f1ea]",
                    theme === 'prism' && "hover:bg-slate-50"
                  )}>
                    {cells.map((c, idx) => (
                      <td 
                        key={idx} 
                        className={cn(
                          "px-6 py-4 text-sm whitespace-pre-wrap",
                          theme === 'modern' && "text-slate-700",
                          theme === 'cyberpunk' && "text-blue-100 font-mono",
                          theme === 'terminal' && "text-green-400 font-mono",
                          theme === 'ethereal' && "text-slate-800 font-serif",
                          theme === 'vintage' && "text-[#5d4037] font-serif",
                          theme === 'prism' && "text-slate-600 font-medium",
                          theme === 'minecraft' && "text-[#373737] font-pixel text-base",
                          theme === 'undertale' && "text-white font-retro text-sm tracking-wide",
                        )}
                      >
                        <MarkdownContent content={c} disableExplanations />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          );
          break;
        default:
          renderedContent = (
            <div className={cn(
              "mb-2 text-lg",
              theme === 'modern' && "text-slate-700",
              theme === 'cyberpunk' && "text-purple-100 font-mono",
              theme === 'vintage' && "text-[#5d4037] font-serif"
            )}>
              <MarkdownContent content={content} />
            </div>
          );
      }

      return (
        <div id={`doc-item-${sanitizedPath}`} className="relative group flow-root">
          {renderDropAndImages(`${path}.before`)}
          {renderedContent}
          {renderDropAndImages(path)}
        </div>
      );
    }

    return (
      <div id={`doc-item-${sanitizedPath}`} className="mb-6 space-y-4 flow-root">
        {renderDropAndImages(path)}
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="break-inside-avoid">
            <Heading level={level} theme={theme}>{key}</Heading>
            <div className={cn(
              "pl-2 ml-2 mt-2",
              theme === 'modern' && "border-l-2 border-slate-100",
              theme === 'cyberpunk' && "border-l-2 border-purple-500/30",
              theme === 'vintage' && "border-l-2 border-[#d4c5a1]"
            )}>
              <DocumentRenderer data={value} level={level + 1} path={`${path}.${key}`} isDragModeActive={isDragModeActive} isOrderingMode={isOrderingMode} imagePlacements={imagePlacements} onZoneClick={onZoneClick} onRemoveImage={onRemoveImage} onUpdateImage={onUpdateImage} onUpdateItem={onUpdateItem} onReorderGroupClick={onReorderGroupClick} theme={theme} />
            </div>
          </div>
        ))}
        {path === "root" && renderDropAndImages("root.end")}
      </div>
    );
  }

  return null;
}

function Heading({ level, children, theme = 'modern' }: { level: number, children: React.ReactNode, theme?: string }) {
  const text = String(children);
  const lowerText = text.toLowerCase();
  
  const isImportant = lowerText.includes('important') || lowerText.includes('warning') || lowerText.includes('red flag') || lowerText.includes('complication') || lowerText.includes('treatment') || lowerText.includes('diagnosis');
  const isHighlight = lowerText.includes('highlight') || lowerText.includes('note');

  let colorClass = "text-slate-800";
  if (theme === 'cyberpunk') colorClass = "text-cyan-400 font-mono uppercase tracking-widest";
  else if (theme === 'vintage') colorClass = "text-[#2c1e14] font-serif italic";
  else if (theme === 'prism') colorClass = "text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 font-black tracking-tighter";
  else if (theme === 'god-of-war') colorClass = "text-[#ffd700] font-serif uppercase tracking-[0.2em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]";
  else if (theme === 'cuphead') colorClass = "text-[#e63946] font-black uppercase tracking-tight transform -rotate-1 drop-shadow-[2px_2px_0_rgba(0,0,0,1)]";
  else {
    if (isImportant) colorClass = "text-red-600";
    else if (level === 1) colorClass = "text-blue-900";
    else if (level === 2) colorClass = "text-blue-800";
    else if (level === 3) colorClass = "text-blue-700";
  }
  
  let bgClass = "";
  if (isHighlight) {
    if (theme === 'cyberpunk') bgClass = "bg-yellow-400/20 px-3 py-1 rounded-none border border-yellow-400/50";
    else if (theme === 'vintage') bgClass = "bg-[#f4ecd8] px-3 py-1 rounded-sm border-b-2 border-[#d4c5a1]";
    else if (theme === 'god-of-war') bgClass = "bg-[#8b0000]/30 px-4 py-2 border-l-4 border-[#8b0000]";
    else if (theme === 'cuphead') bgClass = "bg-[#f5f5dc] px-4 py-2 border-4 border-black shadow-[4px_4px_0_rgba(0,0,0,1)]";
    else bgClass = "bg-yellow-200 px-3 py-1 rounded-md inline-block";
  }

  const baseClass = cn(
    "font-bold capitalize mb-3 mt-6 tracking-tight transition-all",
    colorClass,
    bgClass
  );
  
  if (level === 1) return <h1 className={cn(baseClass, "text-[1.875em] pb-3", theme === 'modern' && "border-b-2 border-blue-100", theme === 'cyberpunk' && "border-b border-cyan-500/30", theme === 'vintage' && "border-b-4 border-double border-[#d4c5a1]", theme === 'prism' && "text-5xl mb-8", theme === 'god-of-war' && "border-b-2 border-[#8b0000] text-4xl mb-10", theme === 'cuphead' && "text-6xl mb-12 border-b-8 border-black")}>{typeof children === 'string' ? <MarkdownContent content={children} /> : children}</h1>;
  if (level === 2) return <h2 className={`${baseClass} text-[1.5em]`}>{typeof children === 'string' ? <MarkdownContent content={children} /> : children}</h2>;
  if (level === 3) return <h3 className={`${baseClass} text-[1.25em]`}>{typeof children === 'string' ? <MarkdownContent content={children} /> : children}</h3>;
  return <h4 className={`${baseClass} text-[1.125em]`}>{typeof children === 'string' ? <MarkdownContent content={children} /> : children}</h4>;
}
