import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { FileCode, FileJson, Play, RefreshCw, Image as ImageIcon, Settings, X, Type, Move, Plus, Check, Sparkles, CheckSquare, Square, Download, Upload, Layout, Brain, Star, ClipboardList, Lightbulb as ConceptIcon, Trash2, Type as FontIcon, Terminal, Cloud, Maximize2, Save, ArrowLeft, Heart, Box, Sword, Ghost } from 'lucide-react';

const AVAILABLE_TYPES = [
  { id: 'TITLE', description: 'Main document title.' },
  { id: 'SUBHEADER', description: 'Section headers.' },
  { id: 'BULLET', description: 'Standard bullet points.' },
  { id: 'EXPLANATION', description: 'Simple explanation with clickable highlights using special syntax. Supports [[concept]] links.' },
  { id: 'WARNING', description: 'Yellow box for warnings/critical info.' },
  { id: 'TIP', description: 'Green box for helpful hints/success tips.' },
  { id: 'IMPORTANT', description: 'Red box for high-yield/exam-critical info.' },
  { id: 'DEFINITION', description: 'Format as "Term: Definition".' },
  { id: 'CODE', description: 'Monospace font for code/dosages/syntax.' },
  { id: 'QUOTE', description: 'Indented italic text.' },
  { id: 'CHECKLIST', description: 'Checkbox style item.' },
  { id: 'EXAMPLE', description: 'Gray box for examples.' },
  { id: 'FORMULA', description: 'Centered text for math/formulas.' },
  { id: 'CALLOUT', description: 'Purple accented box for side notes.' },
  { id: 'CONCEPT', description: 'Light blue box for core concepts. Tip: Use [[concept]] to link this concept across the document.' },
  { id: 'MNEMONIC', description: 'Indigo box for memory aids.' },
  { id: 'KEY_POINT', description: 'Amber box for essential takeaways.' },
  { id: 'SUMMARY', description: 'Slate box for section summaries.' },
  { id: 'STEP', description: 'Bold arrow list for sequences.' },
  { id: 'TIMELINE', description: 'Format as "Date/Time | Event" for chronological lists.' },
  { id: 'DIVIDER', description: 'Horizontal line separator (Content can be empty).' },
  { id: 'TABLE_HEAD', description: 'Table headers separated by "|".' },
  { id: 'TABLE_ROW', description: 'Table rows separated by "|".' },
  { id: 'IMG', description: 'Dedicated image block. Upload an image to display it.' },
];
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, TouchSensor, useDraggable, useDroppable, closestCenter } from '@dnd-kit/core';
import DocumentRenderer, { type PlacedImage, cn, ImageSettingsModal, DocumentContext } from '../components/DocumentRenderer';
import PdfUploader from '../components/PdfUploader';
import HtmlUploader from '../components/HtmlUploader';
import { generatePDF, type CustomFont } from '../utils/pdfGenerator';
import { exportToHTML } from '../utils/htmlExporter';

function DraggableImage({ id, image, onUpdate, onRemove }: { key?: React.Key, id: string, image: PlacedImage, onUpdate: (updates: Partial<PlacedImage>) => void, onRemove: () => void }) {
  const [isSelected, setIsSelected] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { image, source: 'extracted' },
    disabled: isSelected
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`relative border-2 rounded-xl overflow-hidden shadow-sm flex justify-center bg-slate-50 transition-all hover:border-blue-400 hover:shadow-md ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'} ${isSelected ? 'ring-4 ring-blue-500/20 border-blue-500' : 'border-slate-200'}`}
    >
      <div 
        {...listeners} 
        {...attributes} 
        onClick={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 bg-slate-900/70 p-2 rounded-lg text-white backdrop-blur-md shadow-lg flex items-center space-x-2 cursor-grab active:cursor-grabbing z-20"
      >
        <Move className="w-4 h-4" />
        <span className="text-xs font-bold tracking-wider uppercase">Drag</span>
      </div>

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

      {isSelected && (
        <ImageSettingsModal
          image={image}
          onClose={() => setIsSelected(false)}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      )}

      <div className={cn("w-full flex flex-col", image.hasBorder && "border-4 border-slate-800 p-1 bg-white")}>
        <img src={image.url} alt={image.caption || "Extracted"} className="max-w-full h-auto object-contain" style={{ maxHeight: '800px' }} />
        {image.caption && (
          <div className="p-2 text-center text-sm text-slate-600 italic bg-slate-50/80 border-t border-slate-100">
            {image.caption}
          </div>
        )}
      </div>
    </div>
  );
}

function ExtractedImagesZone({ children, active }: { children: React.ReactNode, active: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'extracted-images-zone' });
  
  return (
    <div 
      ref={active ? setNodeRef : undefined} 
      className={`mt-12 pt-8 border-t-2 border-dashed transition-colors ${isOver ? 'border-blue-500 bg-blue-50/50 rounded-xl p-4' : 'border-slate-200'}`}
    >
      {children}
    </div>
  );
}

const PRESET_COLORS = [
  { id: 'blue', name: 'Blue', hex: '#3b82f6' },
  { id: 'red', name: 'Red', hex: '#ef4444' },
  { id: 'green', name: 'Green', hex: '#22c55e' },
  { id: 'purple', name: 'Purple', hex: '#a855f7' },
  { id: 'orange', name: 'Orange', hex: '#f97316' },
  { id: 'pink', name: 'Pink', hex: '#ec4899' },
  { id: 'teal', name: 'Teal', hex: '#14b8a6' },
  { id: 'indigo', name: 'Indigo', hex: '#6366f1' },
  { id: 'amber', name: 'Amber', hex: '#f59e0b' },
  { id: 'cyan', name: 'Cyan', hex: '#06b6d4' },
  { id: 'emerald', name: 'Emerald', hex: '#10b981' },
  { id: 'rose', name: 'Rose', hex: '#f43f5e' },
  { id: 'lime', name: 'Lime', hex: '#84cc16' },
  { id: 'violet', name: 'Violet', hex: '#8b5cf6' },
  { id: 'fuchsia', name: 'Fuchsia', hex: '#d946ef' },
  { id: 'yellow', name: 'Yellow', hex: '#eab308' },
  { id: 'sky', name: 'Sky', hex: '#0ea5e9' },
  { id: 'zinc', name: 'Zinc', hex: '#71717a' },
  { id: 'slate', name: 'Slate', hex: '#64748b' },
  { id: 'stone', name: 'Stone', hex: '#78716c' },
  { id: 'neutral', name: 'Neutral', hex: '#737373' },
  { id: 'brown', name: 'Brown', hex: '#92400e' },
  { id: 'maroon', name: 'Maroon', hex: '#991b1b' },
  { id: 'navy', name: 'Navy', hex: '#1e3a8a' },
  { id: 'olive', name: 'Olive', hex: '#3f6212' },
];

export default function Parser() {
  const [input, setInput] = useState('');
  const [parsedData, setParsedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [extractedImages, setExtractedImages] = useState<PlacedImage[]>([]);
  const [isOrderingMode, setIsOrderingMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [textSize, setTextSize] = useState(16); // Default 16px
  const [selectedColors, setSelectedColors] = useState<string[]>(['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f97316']); // Default cycle
  const [uploadedFonts, setUploadedFonts] = useState<CustomFont[]>([]);
  const [selectedFont, setSelectedFont] = useState<string>('Inter'); // Default
  const [pendingImage, setPendingImage] = useState<{ url: string, path: string | null } | null>(null);
  const [pendingImageSettings, setPendingImageSettings] = useState<PlacedImage>({
    url: '',
    width: 25,
    alignment: 'right',
    hasBorder: false,
    caption: ''
  });
  const [theme, setTheme] = useState<'modern' | 'cyberpunk' | 'vintage' | 'terminal' | 'ethereal' | 'prism' | 'minecraft' | 'undertale' | 'god-of-war' | 'cuphead'>('modern');
  const [isGameThemeMenuOpen, setIsGameThemeMenuOpen] = useState(false);

  const gameThemes = [
    { id: 'minecraft', name: 'Minecraft', icon: Box, color: 'bg-green-700' },
    { id: 'undertale', name: 'Undertale', icon: Heart, color: 'bg-black' },
    { id: 'god-of-war', name: 'God of War', icon: Sword, color: 'bg-red-900' },
    { id: 'cuphead', name: 'Cuphead', icon: Ghost, color: 'bg-amber-600' }
  ];

  const mainThemes = [
    { id: 'modern', name: 'Modern', icon: Layout, color: 'bg-blue-500' },
    { id: 'cyberpunk', name: 'Cyber', icon: Sparkles, color: 'bg-purple-600' },
    { id: 'vintage', name: 'Vintage', icon: ClipboardList, color: 'bg-amber-700' },
    { id: 'terminal', name: 'Terminal', icon: Terminal, color: 'bg-green-600' },
    { id: 'ethereal', name: 'Ethereal', icon: Cloud, color: 'bg-indigo-400' },
    { id: 'prism', name: 'Prism', icon: Maximize2, color: 'bg-indigo-600' }
  ];
  
  // Drag and Drop State
  const [isDragModeActive, setIsDragModeActive] = useState(false);
  const [imagePlacements, setImagePlacements] = useState<Record<string, PlacedImage[]>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragUrl, setActiveDragUrl] = useState<string | null>(null);
  const [activeZonePath, setActiveZonePath] = useState<string | null>(null);
  const [isPromptCopied, setIsPromptCopied] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptFormat, setPromptFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [selectedPromptTypes, setSelectedPromptTypes] = useState<string[]>(['TITLE', 'SUBHEADER', 'BULLET', 'EXPLANATION', 'WARNING', 'TIP', 'IMPORTANT', 'DEFINITION']);
  const [reorderGroupIndex, setReorderGroupIndex] = useState<number | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [noteName, setNoteName] = useState('');
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const noteId = searchParams.get('noteId');
  const generateParam = searchParams.get('generate');

  const handleGenerate = () => {
    setError(null);
    setIsGenerating(true);
    
    setTimeout(() => {
      try {
        const trimmed = input.trim();
        if (!trimmed) {
          throw new Error("Please enter some JSON or CSV text.");
        }

        let rawItems: any[] = [];
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          // Try JSON
          const data = JSON.parse(trimmed);
          if (Array.isArray(data)) {
            rawItems = data;
          } else {
            setParsedData(data);
            return;
          }
        } else {
          // Try CSV
          const result = Papa.parse(trimmed, { header: false, skipEmptyLines: true });
          if (result.errors.length > 0 && result.data.length === 0) {
            throw new Error("Invalid CSV format.");
          }
          
          const parsedArray = result.data as string[][];
          
          // Check if it looks like GROUP, TYPE, CONTENT
          const isGroupTypeContentFormat = parsedArray.length > 0 && parsedArray.some(row => row.length >= 3 && /^[A-Z_]+$/.test(row[1]?.trim() || ''));
          const isTypeContentFormat = parsedArray.length > 0 && parsedArray.some(row => row.length >= 2 && /^[A-Z_]+$/.test(row[0]?.trim() || ''));
          
          if (isGroupTypeContentFormat) {
            rawItems = parsedArray.map(row => {
              if (row[0].trim() === 'GROUP' && row[1].trim() === 'TYPE') return null;
              return {
                GROUP: row[0].trim(),
                TYPE: row[1].trim(),
                CONTENT: row.slice(2).join(',').trim()
              };
            }).filter(Boolean);
          } else if (isTypeContentFormat) {
            rawItems = parsedArray.map(row => {
              if (row[0].trim() === 'TYPE' && row[1]?.trim() === 'CONTENT') return null;
              return {
                TYPE: row[0].trim(),
                CONTENT: row.slice(1).join(',').trim()
              };
            }).filter(Boolean);
          } else {
            // Assume first row is header
            const headers = parsedArray[0];
            rawItems = parsedArray.slice(1).map(row => {
              const obj: any = {};
              headers.forEach((h, i) => {
                obj[h] = row[i];
              });
              return obj;
            });
          }
        }

        // Grouping logic
        if (rawItems.length > 0 && rawItems.some(item => item.TYPE)) {
          const groupsMap = new Map<string, any[]>();
          rawItems.forEach((item, idx) => {
            const groupName = item.GROUP || 'Default Topic';
            if (!groupsMap.has(groupName)) {
              groupsMap.set(groupName, []);
            }
            groupsMap.get(groupName)!.push({ ...item, id: `item-${Date.now()}-${idx}` });
          });
          
          const groupedData = Array.from(groupsMap.entries()).map(([groupName, items], idx) => ({
            id: `group-${Date.now()}-${idx}`,
            GROUP: groupName,
            ITEMS: items
          }));
          
          setParsedData(groupedData);
        } else {
          setParsedData(rawItems);
        }
      } catch (err: any) {
        setError(err.message || "Failed to parse input. Ensure it's valid JSON or CSV.");
        setParsedData(null);
      } finally {
        setIsGenerating(false);
      }
    }, 400); // Fake delay for smooth animation
  };

  useEffect(() => {
    if (generateParam === 'true' && input && !parsedData) {
      handleGenerate();
      // Clean up URL
      navigate('/parser', { replace: true });
    }
  }, [generateParam, input, parsedData]);

  // Local Storage Persistence
  useEffect(() => {
    const savedInput = localStorage.getItem('arcane-notes-input');
    const savedParsedData = localStorage.getItem('arcane-notes-parsed-data');
    const savedExtractedImages = localStorage.getItem('arcane-notes-extracted-images');
    const savedImagePlacements = localStorage.getItem('arcane-notes-image-placements');
    const savedTextSize = localStorage.getItem('arcane-notes-text-size');
    const savedSelectedColors = localStorage.getItem('arcane-notes-selected-colors');
    const savedPromptFormat = localStorage.getItem('arcane-notes-prompt-format');
    const savedPromptTypes = localStorage.getItem('arcane-notes-prompt-types');
    const savedUploadedFonts = localStorage.getItem('arcane-notes-uploaded-fonts');
    const savedSelectedFont = localStorage.getItem('arcane-notes-selected-font');
    const savedTheme = localStorage.getItem('arcane-notes-theme');
    const savedCurrentNoteId = localStorage.getItem('arcane-notes-current-note-id');

    if (savedInput) setInput(savedInput);
    if (savedParsedData) setParsedData(JSON.parse(savedParsedData));
    if (savedExtractedImages) {
      const parsed = JSON.parse(savedExtractedImages);
      if (parsed.length > 0 && typeof parsed[0] === 'string') {
        setExtractedImages(parsed.map((url: string) => ({ url, alignment: 'center' as const, size: 'medium' as const, hasBorder: false })));
      } else {
        setExtractedImages(parsed);
      }
    }
    if (savedImagePlacements) setImagePlacements(JSON.parse(savedImagePlacements));
    if (savedTextSize) setTextSize(parseInt(savedTextSize, 10));
    if (savedSelectedColors) setSelectedColors(JSON.parse(savedSelectedColors));
    if (savedPromptFormat) setPromptFormat(savedPromptFormat as 'CSV' | 'JSON');
    if (savedPromptTypes) setSelectedPromptTypes(JSON.parse(savedPromptTypes));
    if (savedUploadedFonts) setUploadedFonts(JSON.parse(savedUploadedFonts));
    if (savedSelectedFont) setSelectedFont(savedSelectedFont);
    if (savedTheme) setTheme(savedTheme as any);

    if (noteId) {
      // If we have working data for THIS note, don't overwrite it with the saved version
      // This is crucial when returning from Fluid Mode
      if (savedCurrentNoteId === noteId && savedParsedData) {
        return;
      }

      const savedNotes = JSON.parse(localStorage.getItem('arcane_saved_notes') || '[]');
      const note = savedNotes.find((n: any) => n.id === noteId);
      if (note) {
        setParsedData(note.parsedData);
        setImagePlacements(note.imagePlacements || {});
        if (note.settings) {
          if (note.settings.theme) setTheme(note.settings.theme);
          if (note.settings.selectedColors) setSelectedColors(note.settings.selectedColors);
          if (note.settings.textSize) setTextSize(note.settings.textSize);
          if (note.settings.selectedFont) setSelectedFont(note.settings.selectedFont);
        }
        localStorage.setItem('arcane-notes-current-note-id', noteId);
      }
    } else {
      localStorage.removeItem('arcane-notes-current-note-id');
    }
  }, [noteId]);

  useEffect(() => {
    try {
      if (input !== undefined) {
        localStorage.setItem('arcane-notes-input', input);
      }
    } catch (e) {
      console.warn('LocalStorage quota exceeded for input');
    }
  }, [input]);

  useEffect(() => {
    try {
      if (parsedData !== null) {
        localStorage.setItem('arcane-notes-parsed-data', JSON.stringify(parsedData));
        
        // Also update the saved note if we have a noteId
        if (noteId) {
          const savedNotes = JSON.parse(localStorage.getItem('arcane_saved_notes') || '[]');
          const noteIndex = savedNotes.findIndex((n: any) => n.id === noteId);
          if (noteIndex !== -1) {
            savedNotes[noteIndex].parsedData = parsedData;
            localStorage.setItem('arcane_saved_notes', JSON.stringify(savedNotes));
          }
        }
      }
    } catch (e) {
      console.warn('LocalStorage quota exceeded for parsed-data');
    }
  }, [parsedData, noteId]);

  useEffect(() => {
    try {
      if (extractedImages !== undefined) {
        localStorage.setItem('arcane-notes-extracted-images', JSON.stringify(extractedImages));
      }
    } catch (e) {
      console.warn('LocalStorage quota exceeded for extracted-images');
    }
  }, [extractedImages]);

  useEffect(() => {
    try {
      if (imagePlacements !== undefined) {
        localStorage.setItem('arcane-notes-image-placements', JSON.stringify(imagePlacements));
        
        // Also update the saved note if we have a noteId
        if (noteId) {
          const savedNotes = JSON.parse(localStorage.getItem('arcane_saved_notes') || '[]');
          const noteIndex = savedNotes.findIndex((n: any) => n.id === noteId);
          if (noteIndex !== -1) {
            savedNotes[noteIndex].imagePlacements = imagePlacements;
            localStorage.setItem('arcane_saved_notes', JSON.stringify(savedNotes));
          }
        }
      }
    } catch (e) {
      console.warn('LocalStorage quota exceeded for image-placements');
    }
  }, [imagePlacements, noteId]);

  useEffect(() => {
    try {
      localStorage.setItem('arcane-notes-text-size', textSize.toString());
    } catch (e) {
      console.warn('LocalStorage quota exceeded for text-size');
    }
  }, [textSize]);

  useEffect(() => {
    try {
      localStorage.setItem('arcane-notes-selected-colors', JSON.stringify(selectedColors));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for selected-colors');
    }
  }, [selectedColors]);

  useEffect(() => {
    try {
      localStorage.setItem('arcane-notes-prompt-format', promptFormat);
    } catch (e) {
      console.warn('LocalStorage quota exceeded for prompt-format');
    }
  }, [promptFormat]);

  useEffect(() => {
    try {
      localStorage.setItem('arcane-notes-prompt-types', JSON.stringify(selectedPromptTypes));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for prompt-types');
    }
  }, [selectedPromptTypes]);

  useEffect(() => {
    try {
      localStorage.setItem('arcane-notes-uploaded-fonts', JSON.stringify(uploadedFonts));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for uploaded-fonts');
    }
  }, [uploadedFonts]);

  useEffect(() => {
    try {
      localStorage.setItem('arcane-notes-selected-font', selectedFont);
    } catch (e) {
      console.warn('LocalStorage quota exceeded for selected-font');
    }
  }, [selectedFont]);

  useEffect(() => {
    try {
      localStorage.setItem('arcane-notes-theme', theme);
    } catch (e) {
      console.warn('LocalStorage quota exceeded for theme');
    }
  }, [theme]);

  useEffect(() => {
    const font = uploadedFonts.find(f => f.name === selectedFont);
    const styleId = 'custom-font-style';
    let style = document.getElementById(styleId);
    
    if (font) {
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
      }
      style.innerHTML = `
        @font-face {
          font-family: '${font.name}';
          src: url('${font.data}');
        }
        .document-preview {
          font-family: '${font.name}', sans-serif !important;
        }
      `;
    } else {
      if (style) style.innerHTML = '';
      // Reset to default Inter if font not found
      const previewEl = document.querySelector('.document-preview');
      if (previewEl) (previewEl as HTMLElement).style.fontFamily = '';
    }
  }, [selectedFont, uploadedFonts]);

  const compressImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Limit max dimension to 1600px
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with 0.7 quality
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, path: string | null = null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawUrl = event.target?.result as string;
      const url = await compressImage(rawUrl);
      
      const targetPath = path || activeZonePath;
      const targetItem = targetPath ? getItemByPath(targetPath) : null;
      const isImgBlock = targetItem && targetItem.TYPE === 'IMG';

      setPendingImage({ url, path: targetPath });
      setPendingImageSettings({
        url,
        width: isImgBlock ? 100 : (targetPath ? 25 : 100),
        alignment: isImgBlock ? 'center' : (targetPath ? 'right' : 'center'),
        hasBorder: false,
        caption: ''
      });
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmPendingImage = () => {
    if (!pendingImage) return;

    const { path } = pendingImage;
    const settings = pendingImageSettings;

    if (path) {
      // Check if path is an IMG type block
      const targetItem = getItemByPath(path);
      if (targetItem && targetItem.TYPE === 'IMG') {
        handleUpdateItem(path, { CONTENT: settings.url });
      } else {
        setImagePlacements(prev => ({
          ...prev,
          [path]: [...(prev[path] || []), settings]
        }));
      }
      // Remove from extracted images if it was there
      setExtractedImages(prev => prev.filter(img => img.url !== settings.url));
      setActiveZonePath(null);
    } else {
      setExtractedImages(prev => [...prev, settings]);
    }
    setPendingImage(null);
  };

  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as string;
      const fontName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '');
      const newFont: CustomFont = {
        name: fontName,
        data: data,
        fileName: file.name
      };
      setUploadedFonts(prev => [...prev, newFont]);
      setSelectedFont(fontName);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFont = (fontName: string) => {
    setUploadedFonts(prev => prev.filter(f => f.name !== fontName));
    if (selectedFont === fontName) {
      setSelectedFont('Inter');
    }
  };

  const handleCopyPrompt = async () => {
    const selectedTypesList = AVAILABLE_TYPES.filter(t => selectedPromptTypes.includes(t.id))
      .map(t => `- ${t.id}: ${t.description}`)
      .join('\n');

    const formatInstructions = promptFormat === 'CSV' 
      ? `Please provide the data in valid CSV format.\nDo NOT use a header row. The CSV should have 3 main columns: GROUP, TYPE, CONTENT.`
      : `Please provide the data in valid JSON format.\nProvide an array of objects with "GROUP", "TYPE" and "CONTENT" keys.`;

    const exampleOutput = promptFormat === 'CSV'
      ? `Example CSV Output:
Biology 101, TITLE, CELLULAR BIOLOGY
Biology 101, SUBHEADER, Structure
Biology 101, DEFINITION, [[Mitochondria]]: Powerhouse of the cell
Biology 101, TIP, Remember that RBCs lack [[Mitochondria]].
Biology 101, IMPORTANT, EXAM TIP: Ribosomes are the site of protein synthesis.
Biology 101, BULLET, Size: 0.5 - 1.0 micrometers`
      : `Example JSON Output:
[
  { "GROUP": "Biology 101", "TYPE": "TITLE", "CONTENT": "CELLULAR BIOLOGY" },
  { "GROUP": "Biology 101", "TYPE": "SUBHEADER", "CONTENT": "Structure" },
  { "GROUP": "Biology 101", "TYPE": "DEFINITION", "CONTENT": "[[Mitochondria]]: Powerhouse of the cell" },
  { "GROUP": "Biology 101", "TYPE": "TIP", "CONTENT": "Remember that RBCs lack [[Mitochondria]]." },
  { "GROUP": "Biology 101", "TYPE": "IMPORTANT", "CONTENT": "EXAM TIP: Ribosomes are the site of protein synthesis." },
  { "GROUP": "Biology 101", "TYPE": "BULLET", "CONTENT": "Size: 0.5 - 1.0 micrometers" }
]`;

    const prompt = `I need you to generate structured data that I can use to render a document.
${formatInstructions}

The "GROUP" column/key represents the section or topic the item belongs to. Items with the same GROUP will be styled together.
The "TYPE" column/key determines how the content is rendered.
The "CONTENT" column/key contains the actual text.

You can use standard Markdown for formatting within the CONTENT:
- **Bold text** (Will be colored with the group's theme color)
- *Italic text* (Will be colored with the group's theme color)
- ~~Strikethrough~~
- \`Inline code\`
- ==Highlighted text== (Will have a background color)

You can also use a custom color syntax: [c:color]text[/c]
Example: [c:red]This is red text[/c] or [c:#00ff00]This is green text[/c].

For the EXPLANATION type, you MUST use the following syntax to create clickable popovers:
[Term to click]{Title of popover|Definition|Simple explanation|Extra info or formula}
Example: The heart pumps blood using [cardiac output]{Cardiac Output|amount of blood pumped by heart per minute|how much blood your heart pushes every minute|CO = HR × SV}

For the MEMORY LINK SYSTEM, use the following syntax to link concepts across the document:
[[Concept Name]]
Example: The [[Heart]] is a vital organ. (Clicking this will show all other occurrences of "Heart" in the document).

Here are the allowed TYPEs:
${selectedTypesList}

${exampleOutput}

Do not wrap the output in markdown code blocks (like \`\`\`json or \`\`\`csv). Just output the raw text.
Do not include any conversational text, explanations, or greetings. Output ONLY the data.

Here is the topic/content I want you to generate data for:
[INSERT YOUR TOPIC HERE]`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(prompt);
      } else {
        throw new Error('Clipboard API not available');
      }
    } catch (err) {
      // Fallback for iframes or when document is not focused
      const textArea = document.createElement("textarea");
      textArea.value = prompt;
      // Avoid scrolling to bottom
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (e) {
        console.error('Fallback copy failed', e);
      }
      document.body.removeChild(textArea);
    }

    setIsPromptCopied(true);
    setTimeout(() => {
      setIsPromptCopied(false);
      setIsPromptModalOpen(false);
    }, 1500);
  };

  const togglePromptType = (id: string) => {
    setSelectedPromptTypes(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleRemovePlacedImage = (path: string, index: number) => {
    setImagePlacements(prev => {
      const newPlacements = { ...prev };
      const removedImage = newPlacements[path][index];
      if (removedImage) {
        setExtractedImages(imgs => [...imgs, removedImage]);
      }
      newPlacements[path] = newPlacements[path].filter((_, idx) => idx !== index);
      return newPlacements;
    });
  };

  const getItemByPath = (path: string) => {
    if (!parsedData) return null;
    const parts = path.split('.');
    let current = parsedData;
    const startIndex = parts[0] === 'root' ? 1 : 0;
    
    for (let i = startIndex; i < parts.length; i++) {
      const part = parts[i];
      if (current === null || current === undefined || current[part] === undefined) return null;
      current = current[part];
    }
    return current;
  };

  const handleUpdateItem = (path: string, updates: any) => {
    setParsedData((prev: any) => {
      if (!prev) return prev;
      const newData = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      
      if (parts.length === 1 && parts[0] === 'root') {
        return { ...newData, ...updates };
      }

      let current = newData;
      const startIndex = parts[0] === 'root' ? 1 : 0;
      
      for (let i = startIndex; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined) return prev;
        current = current[part];
      }
      
      const lastPart = parts[parts.length - 1];
      if (current[lastPart] !== undefined) {
        current[lastPart] = { ...current[lastPart], ...updates };
      }
      
      return newData;
    });
  };

  const handleUpdatePlacedImage = (path: string, index: number, updates: Partial<PlacedImage>) => {
    setImagePlacements(prev => {
      const newPlacements = { ...prev };
      if (newPlacements[path] && newPlacements[path][index]) {
        newPlacements[path] = [...newPlacements[path]];
        newPlacements[path][index] = { ...newPlacements[path][index], ...updates };
      }
      return newPlacements;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  const handleDragStart = (event: any) => {
    setActiveDragId(event.active.id);
    setActiveDragUrl(event.active.data.current?.url || null);
  };

  const handleDragEnd = (event: any) => {
    setActiveDragId(null);
    setActiveDragUrl(null);
    const { active, over } = event;
    
    if (!over) return;

    if (active.data.current?.type === 'document-item') {
      const sourceGroupIndex = active.data.current.groupIndex;
      const sourceItemIndex = active.data.current.itemIndex;
      const targetGroupIndex = over.data.current?.groupIndex;
      
      if (targetGroupIndex !== undefined && sourceGroupIndex !== undefined) {
        setParsedData(prev => {
          if (!prev || !Array.isArray(prev)) return prev;
          const newData = [...prev];
          const sourceGroup = { ...newData[sourceGroupIndex], ITEMS: [...newData[sourceGroupIndex].ITEMS] };
          const targetGroup = sourceGroupIndex === targetGroupIndex ? sourceGroup : { ...newData[targetGroupIndex], ITEMS: [...newData[targetGroupIndex].ITEMS] };
          
          const [item] = sourceGroup.ITEMS.splice(sourceItemIndex, 1);
          const targetItemIndex = over.data.current?.itemIndex;
          
          if (sourceGroupIndex === targetGroupIndex) {
            if (targetItemIndex !== undefined) {
              sourceGroup.ITEMS.splice(targetItemIndex, 0, item);
            } else {
              sourceGroup.ITEMS.push(item);
            }
            newData[sourceGroupIndex] = sourceGroup;
          } else {
            item.GROUP = targetGroup.GROUP;
            if (targetItemIndex !== undefined) {
              targetGroup.ITEMS.splice(targetItemIndex, 0, item);
            } else {
              targetGroup.ITEMS.push(item);
            }
            newData[sourceGroupIndex] = sourceGroup;
            newData[targetGroupIndex] = targetGroup;
          }
          
          return newData;
        });
      }
      return;
    }

    const imageUrl = active.data.current?.url;
    let dropPath = over.id as string;
    
    // Handle brick- prefixed IDs from ordering mode
    if (dropPath.startsWith('brick-')) {
      const brickId = dropPath.replace('brick-', '');
      dropPath = brickId;
    }

    const source = active.data.current?.source;
    const sourcePath = active.data.current?.sourcePath;
    const sourceIndex = active.data.current?.sourceIndex;
    
    if (imageUrl && dropPath) {
        if (dropPath === 'extracted-images-zone') {
          if (source === 'placed' && sourcePath) {
            // Remove from placements
            setImagePlacements(prev => {
              const newPlacements = { ...prev };
              if (newPlacements[sourcePath]) {
                newPlacements[sourcePath] = newPlacements[sourcePath].filter((_, idx) => idx !== sourceIndex);
              }
              return newPlacements;
            });
            // Add back to extracted images
            setExtractedImages(prev => [...prev, { url: imageUrl, alignment: 'center' as const, size: 'medium' as const, hasBorder: false }]);
          }
          return;
        }

        // Check if dropping onto an IMG type block
        const targetItem = getItemByPath(dropPath);
        if (targetItem && targetItem.TYPE === 'IMG') {
          handleUpdateItem(dropPath, { CONTENT: imageUrl });
          if (source === 'extracted') {
            setExtractedImages(prev => prev.filter(img => img.url !== imageUrl));
          } else if (source === 'placed' && sourcePath) {
            setImagePlacements(prev => {
              const newPlacements = { ...prev };
              if (newPlacements[sourcePath]) {
                newPlacements[sourcePath] = newPlacements[sourcePath].filter((_, idx) => idx !== sourceIndex);
              }
              return newPlacements;
            });
          }
          return;
        }

        setImagePlacements(prev => {
          const newPlacements = { ...prev };
          let imageToPlace: PlacedImage = { url: imageUrl, width: 25, alignment: 'right' };
          
          // Remove from source if it was a placed image
          if (source === 'placed' && sourcePath) {
            if (newPlacements[sourcePath]) {
              const existingImage = newPlacements[sourcePath][sourceIndex];
              if (existingImage) {
                imageToPlace = { ...existingImage };
              }
              newPlacements[sourcePath] = newPlacements[sourcePath].filter((_, idx) => idx !== sourceIndex);
            }
          }
          
          // Add to new destination
          newPlacements[dropPath] = [...(newPlacements[dropPath] || []), imageToPlace];
          
          return newPlacements;
        });
        
        // Remove from extracted images if it came from there
        if (source === 'extracted') {
          setExtractedImages(prev => prev.filter(img => img.url !== imageUrl));
        }
      }
  };

  const handleSaveNote = () => {
    if (!noteName.trim() || !parsedData) return;
    
    const savedNotes = JSON.parse(localStorage.getItem('arcane_saved_notes') || '[]');
    
    if (noteId) {
      // Update existing note
      const noteIndex = savedNotes.findIndex((n: any) => n.id === noteId);
      if (noteIndex !== -1) {
        savedNotes[noteIndex] = {
          ...savedNotes[noteIndex],
          name: noteName.trim(),
          date: Date.now(),
          parsedData,
          imagePlacements,
          settings: { theme, selectedColors, textSize, selectedFont }
        };
        localStorage.setItem('arcane_saved_notes', JSON.stringify(savedNotes));
        setIsSaveModalOpen(false);
        setNoteName('');
        alert('Note updated successfully!');
        return;
      }
    }

    // Create new note
    const newNote = {
      id: Date.now().toString(),
      name: noteName.trim(),
      date: Date.now(),
      parsedData,
      imagePlacements,
      settings: { theme, selectedColors, textSize, selectedFont }
    };
    
    try {
      localStorage.setItem('arcane_saved_notes', JSON.stringify([...savedNotes, newNote]));
      setIsSaveModalOpen(false);
      setNoteName('');
      alert('Note saved successfully!');
    } catch (e) {
      console.error('Failed to save note', e);
      alert('Failed to save note. Storage might be full.');
    }
  };

  const handleHtmlMetadataExtracted = (metadata: any) => {
    if (metadata.parsedData) setParsedData(metadata.parsedData);
    if (metadata.imagePlacements) setImagePlacements(metadata.imagePlacements);
    if (metadata.selectedColors) setSelectedColors(metadata.selectedColors);
    if (metadata.textSize) setTextSize(metadata.textSize);
    if (metadata.theme) setTheme(metadata.theme);
    if (metadata.customFont) {
      // Check if font already exists in uploadedFonts
      setUploadedFonts(prev => {
        if (!prev.some(f => f.name === metadata.customFont.name)) {
          return [...prev, metadata.customFont];
        }
        return prev;
      });
      setSelectedFont(metadata.customFont.name);
    }
    alert('Note successfully imported from HTML!');
  };

  const stringifyData = (data: any[]) => {
    if (promptFormat === 'JSON') {
      return JSON.stringify(data, null, 2);
    } else {
      // CSV
      const rows: any[] = [];
      data.forEach(group => {
        if (group.ITEMS && Array.isArray(group.ITEMS)) {
          group.ITEMS.forEach((item: any) => {
            rows.push({
              GROUP: group.GROUP || '',
              TYPE: item.TYPE || '',
              CONTENT: item.CONTENT || ''
            });
          });
        }
      });
      return Papa.unparse(rows);
    }
  };

  const handleSyncInput = () => {
    if (!parsedData) return;
    const syncedInput = stringifyData(parsedData);
    setInput(syncedInput);
    localStorage.setItem('arcane-notes-input', syncedInput);
  };

  const handleReset = () => {
    setParsedData(null);
    setInput('');
    setError(null);
    setExtractedImages([]);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => navigate('/')}
              className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-500 hover:text-blue-600 transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="bg-blue-600 p-2 rounded-lg shadow-md">
              <FileCode className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Arcane Notes</h1>
          </div>
      {parsedData && (
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleReset}
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Start Over
          </button>
        </div>
      )}
        </header>

        <div className={parsedData ? "flex flex-col space-y-8" : "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"}>
          
          {/* Input Panel */}
          <div className={`${parsedData ? 'hidden' : 'lg:col-span-8 lg:col-start-3'}`}>
            <motion.div 
              layout
              className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-12rem)]"
            >
              <div className="p-5 border-b border-slate-100 bg-white flex items-center justify-between">
                <h2 className="font-bold text-slate-800 flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mr-3">
                    <FileJson className="w-5 h-5 text-blue-500" />
                  </div>
                  Input Data
                </h2>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => setInput(`Cardiology, TITLE, [c:#ef4444]Cardio[vascular]{Vascular|relating to blood vessels|the pipes of the body|Includes arteries and veins} System[/c]
Cardiology, SUBHEADER, Overview of Cardiac [Function]{Function|how something works|the job it does|Crucial for life}
Cardiology, DEFINITION, [[Heart]]: A muscular organ that pumps [[Blood]] through the circulatory system.
Cardiology, EXPLANATION, The [[Heart]] pumps [[Blood]] using [cardiac output]{Cardiac Output|amount of blood pumped by heart per minute|how much blood your heart pushes every minute|CO = HR × SV} which is the product of heart rate and stroke volume.
Cardiology, BULLET, This is a standard bullet point with **bold** and *italic* text.
Cardiology, BULLET, Another bullet point to show multiple items in a list.
Cardiology, WARNING, Patient must be monitored for [arrhythmias]{Arrhythmia|a condition in which the heart beats with an irregular or abnormal rhythm|an irregular heartbeat|Can be too fast or too slow} during the procedure.
Cardiology, TIP, Regular exercise improves cardiovascular health and reduces the risk of heart disease.
Cardiology, IMPORTANT, EXAM TIP: The [SA node]{SA Node|the heart's natural pacemaker|the spark plug of the heart|Located in the right atrium} is the natural pacemaker of the [[Heart]].
Cardiology, CODE, Administer [Aspirin]{Aspirin|a medication used to reduce pain, fever, or inflammation|a blood thinner|Often used in heart attacks} 81mg PO daily
Cardiology, QUOTE, "The [[Heart]] has its reasons which reason knows nothing of."
Cardiology, CHECKLIST, Check blood pressure
Cardiology, CHECKLIST, Auscultate heart sounds
Cardiology, EXAMPLE, Patient presents with [chest pain]{Angina|a type of chest pain caused by reduced blood flow to the heart|heart pain|Can feel like pressure or squeezing} radiating to the left arm.
Cardiology, FORMULA, BP = CO × SVR
Cardiology, CALLOUT, Note: Women may present with atypical symptoms of myocardial infarction.
Cardiology, STEP, Assess airway, breathing, and circulation.
Cardiology, STEP, Obtain a 12-lead [[ECG]].
Cardiology, TIMELINE, 0 min | Patient arrives at ED
Cardiology, TIMELINE, 10 min | [[ECG]] completed
Cardiology, DIVIDER, 
Cardiology, TABLE_HEAD, [Condition]{Condition|a medical state|the problem} | Symptoms | Treatment
Cardiology, TABLE_ROW, [STEMI]{STEMI|ST-Elevation Myocardial Infarction|a major heart attack|Complete blockage of a coronary artery} | Chest pain, ST elevation | PCI, Thrombolytics
Cardiology, TABLE_ROW, NSTEMI | Chest pain, ST depression | [Antiplatelets]{Antiplatelets|medicines that stop blood cells from sticking together|clot preventers|Example: Aspirin}, Anticoagulants
Cardiology, SUBHEADER, Diagnostic Procedures
Cardiology, EXPLANATION, An [echocardiogram]{Echocardiogram|a test that uses sound waves to produce live images of your heart|an ultrasound of the heart|Used to check heart valves and chambers} is a common diagnostic tool.
Cardiology, TABLE_HEAD, Test | Purpose | Findings
Cardiology, TABLE_ROW, [[ECG]] | Electrical activity | Arrhythmias, Ischemia
Cardiology, TABLE_ROW, Stress Test | [[Heart]] response to exercise | CAD, Exercise tolerance

Neurology, TITLE, [c:#8b5cf6]Nervous System[/c]
Neurology, SUBHEADER, Central Nervous System
Neurology, DEFINITION, [[Brain]]: The control center of the nervous system.
Neurology, EXPLANATION, Neurons communicate via [action potentials]{Action Potential|a rapid sequence of changes in the voltage across a membrane|an electrical signal that travels down a nerve|Threshold is typically -55mV} that travel along the axon.
Neurology, BULLET, The CNS consists of the [[Brain]] and spinal cord.
Neurology, BULLET, The PNS consists of nerves and ganglia outside the CNS.
Neurology, WARNING, Increased [intracranial]{Intracranial|within the skull|inside the head|Can be pressure or bleeding} pressure is a medical emergency.
Neurology, TIP, The Glasgow Coma Scale is used to assess consciousness.
Neurology, IMPORTANT, The blood-brain barrier protects the [[Brain]] from toxins.
Neurology, CODE, Administer [tPA]{tPA|tissue plasminogen activator|a clot-busting drug|Must be given within 4.5 hours} within 3-4.5 hours of ischemic stroke onset
Neurology, QUOTE, "The [[Brain]] is a world consisting of a number of unexplored continents and great stretches of unknown territory."
Neurology, CHECKLIST, Assess pupillary response
Neurology, CHECKLIST, Test motor function
Neurology, EXAMPLE, Patient presents with unilateral facial droop and arm weakness.
Neurology, FORMULA, CPP = MAP - ICP
Neurology, CALLOUT, Note: Time is [[Brain]] in acute stroke management.
Neurology, STEP, Perform a rapid neurological assessment.
Neurology, STEP, Obtain a non-contrast head CT.
Neurology, TIMELINE, 0 min | Patient arrives at ED
Neurology, TIMELINE, 25 min | Head CT completed
Neurology, DIVIDER, 
Neurology, TABLE_HEAD, Lobe | Primary Function | Deficit
Neurology, TABLE_ROW, Frontal | Executive function, motor | Personality changes, weakness
Neurology, TABLE_ROW, Temporal | Hearing, memory | [Aphasia]{Aphasia|a language disorder that affects a person's ability to communicate|speech trouble|Can be expressive or receptive}, memory loss
Neurology, SUBHEADER, Neurotransmitters
Neurology, EXPLANATION, [Dopamine]{Dopamine|a neurotransmitter that plays several important roles in the brain and body|the "reward" chemical|Involved in movement and motivation} is crucial for the reward system.
Neurology, TABLE_HEAD, Neurotransmitter | Type | Function
Neurology, TABLE_ROW, Acetylcholine | Excitatory | Muscle contraction, memory
Neurology, TABLE_ROW, GABA | Inhibitory | Reduces neuronal excitability

Gastroenterology, TITLE, [c:#10b981]Gastrointestinal System[/c]
Gastroenterology, SUBHEADER, Digestive Process
Gastroenterology, DEFINITION, Digestion: The process of breaking down food into smaller components.
Gastroenterology, EXPLANATION, The [stomach]{Stomach|a muscular organ located on the left side of the upper abdomen|the food blender|Secretes acid and enzymes to digest food} is a key organ in digestion.
Gastroenterology, BULLET, Digestion begins in the mouth with salivary amylase.
Gastroenterology, BULLET, The small intestine is where most nutrient absorption occurs.
Gastroenterology, WARNING, Severe abdominal pain may indicate a surgical emergency.
Gastroenterology, TIP, A high-fiber diet promotes healthy digestion.
Gastroenterology, IMPORTANT, [H. pylori]{H. pylori|a type of bacteria that can infect your stomach|stomach bug|Can cause ulcers and cancer} is a common cause of peptic ulcers.
Gastroenterology, CODE, Administer [Omeprazole]{Omeprazole|a proton pump inhibitor|acid blocker|Used for GERD and ulcers} 20mg PO daily
Gastroenterology, QUOTE, "All disease begins in the gut."
Gastroenterology, CHECKLIST, Palpate abdomen
Gastroenterology, CHECKLIST, Check for bowel sounds
Gastroenterology, EXAMPLE, Patient presents with epigastric pain relieved by food.
Gastroenterology, FORMULA, BMI = weight / height²
Gastroenterology, CALLOUT, Note: Celiac disease requires a strict gluten-free diet.
Gastroenterology, STEP, Perform a physical examination.
Gastroenterology, STEP, Order [[Blood]] tests and imaging.
Gastroenterology, TIMELINE, 0 min | Patient arrives at ED
Gastroenterology, TIMELINE, 45 min | Abdominal ultrasound completed
Gastroenterology, DIVIDER, 
Gastroenterology, TABLE_HEAD, Organ | Function | Secretion
Gastroenterology, TABLE_ROW, Liver | Detoxification, bile production | [Bile]{Bile|a fluid that aids digestion and is secreted by the liver|fat dissolver|Stored in the gallbladder}
Gastroenterology, TABLE_ROW, Pancreas | Enzyme production, [[Insulin]] | [Insulin]{Insulin|a hormone that regulates blood sugar|sugar controller|Produced by beta cells}
Gastroenterology, SUBHEADER, Common Disorders
Gastroenterology, EXPLANATION, [GERD]{GERD|Gastroesophageal reflux disease|chronic acid reflux|Can cause heartburn and esophagus damage} is a chronic digestive disease.
Gastroenterology, TABLE_HEAD, Disorder | Symptoms | Treatment
Gastroenterology, TABLE_ROW, IBS | Bloating, gas, diarrhea | Diet changes, stress management
Gastroenterology, TABLE_ROW, IBD | Inflammation, pain, bleeding | [Immunosuppressants]{Immunosuppressants|drugs that lower the body's immune response|immune blockers|Used for autoimmune diseases}, Surgery`)}
                    className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all active:scale-95"
                  >
                    Load Sample
                  </button>
                  <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-widest">JSON / CSV</span>
                </div>
              </div>
              <div className="flex-1 p-6 flex flex-col bg-slate-50/30">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste your JSON or CSV data here..."
                  className="w-full flex-1 resize-none bg-white border-2 border-slate-100 rounded-2xl p-6 font-mono text-sm text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-inner"
                  spellCheck={false}
                />
                
                <AnimatePresence>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => setIsPromptModalOpen(true)}
                    className="w-full flex items-center justify-center px-6 py-4 bg-white text-purple-600 border-2 border-purple-100 font-bold rounded-2xl shadow-sm hover:bg-purple-50 hover:border-purple-200 transition-all active:scale-[0.98]"
                  >
                    <Sparkles className="w-5 h-5 mr-2" /> Configure AI Prompt
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !input.trim()}
                    className="w-full flex items-center justify-center px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  >
                    {isGenerating ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2 fill-current" /> Generate Document
                      </>
                    )}
                  </button>
                </div>

                {parsedData && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      <div className="p-2 bg-emerald-500 rounded-lg mr-3">
                        <RefreshCw className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-900">Data Synced</p>
                        <p className="text-[10px] text-emerald-600 font-medium">Your preview is active. Sync back to text editor?</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleSyncInput}
                      className="px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-colors shadow-sm"
                    >
                      Sync to Editor
                    </button>
                  </motion.div>
                )}

                <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                    <HtmlUploader onMetadataExtracted={handleHtmlMetadataExtracted} />
                  </div>
                  <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                    <PdfUploader onImagesExtracted={(images) => {
                      setExtractedImages(prev => [...prev, ...images.map(url => ({ url, alignment: 'center' as const, size: 'medium' as const, hasBorder: false }))]);
                    }} />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Preview Panel */}
          <AnimatePresence>
            {parsedData && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full space-y-8"
              >
                <DndContext 
                  sensors={sensors} 
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart} 
                  onDragEnd={handleDragEnd}
                >
                  {/* Document View */}
                  <div className="bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 10rem)' }}>
                    <div className="bg-slate-800 px-6 py-3 border-b border-slate-700 flex items-center justify-between shrink-0">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      </div>
                      <div className="text-slate-300 text-xs font-medium tracking-wider uppercase">Document Preview</div>
                      <div className="w-12"></div>
                    </div>
                    
                    <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-[#f8f9fa] custom-scrollbar">
                      <div className={cn(
                        "w-full max-w-5xl mx-auto p-6 md:p-16 shadow-sm border rounded-lg min-h-full transition-all duration-500",
                        theme === 'modern' && "bg-white border-slate-100",
                        theme === 'cyberpunk' && "bg-[#0a0a0f] border-purple-500/30 shadow-[0_0_50px_-12px_rgba(168,85,247,0.2)]",
                        theme === 'vintage' && "bg-[#fdfbf7] border-[#e5e1d8] shadow-[inset_0_0_100px_rgba(0,0,0,0.02)]",
                        theme === 'prism' && "bg-[#fdfdfd] border-slate-200 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)]"
                      )}>
                        <div className="document-preview" style={{ fontSize: `${textSize}px`, transition: 'font-size 0.2s ease' }}>
                          <DocumentContext.Provider value={{ fullData: parsedData }}>
                            <DocumentRenderer 
                              data={parsedData} 
                              isDragModeActive={isDragModeActive} 
                              isOrderingMode={isOrderingMode}
                              imagePlacements={imagePlacements} 
                              onZoneClick={(path) => setActiveZonePath(path)}
                              onRemoveImage={handleRemovePlacedImage}
                              onUpdateImage={handleUpdatePlacedImage}
                              onUpdateItem={handleUpdateItem}
                              onReorderGroupClick={setReorderGroupIndex}
                              selectedColors={selectedColors}
                              theme={theme}
                            />
                          </DocumentContext.Provider>
                        </div>
                        
                        {/* Extracted Images Section */}
                        {(extractedImages.length > 0 || isDragModeActive) && (
                          <ExtractedImagesZone active={isDragModeActive}>
                            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
                              <ImageIcon className="w-6 h-6 mr-2 text-purple-500" />
                              Extracted Images
                            </h2>
                            {extractedImages.length === 0 && isDragModeActive ? (
                              <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                Drop images here to remove them from the document
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-6">
                                {extractedImages.map((img, idx) => (
                                  isDragModeActive ? (
                                    <DraggableImage 
                                      key={img.url} 
                                      id={`img-${idx}`} 
                                      image={img} 
                                      onUpdate={(updates) => {
                                        setExtractedImages(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
                                      }}
                                      onRemove={() => {
                                        setExtractedImages(prev => prev.filter((_, i) => i !== idx));
                                      }}
                                    />
                                  ) : (
                                    <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden shadow-sm flex justify-center bg-slate-50">
                                      <img src={img.url} alt={`Extracted page ${idx + 1}`} className="max-w-full h-auto object-contain" style={{ maxHeight: '800px' }} />
                                    </div>
                                  )
                                ))}
                              </div>
                            )}
                          </ExtractedImagesZone>
                        )}
                      </div>
                    </div>
                  </div>

                  <DragOverlay dropAnimation={{ duration: 200, easing: 'ease-out' }}>
                    {activeDragUrl ? (
                      <div className="opacity-90 rotate-3 scale-105 transition-transform shadow-2xl rounded-xl overflow-hidden border-4 border-blue-500 bg-white w-48 pointer-events-none">
                        <img 
                          src={activeDragUrl} 
                          alt="Dragging" 
                          className="w-full h-auto object-contain" 
                        />
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>

                {/* Image Selector Modal for Tap-to-Place */}
                <AnimatePresence>
                  {activeZonePath && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setActiveZonePath(null)}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-[60] flex flex-col max-h-[85vh]"
                      >
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                          <div className="flex items-center">
                            <div className="p-2 bg-blue-50 rounded-lg mr-3">
                              <ImageIcon className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-800">Place Image</h3>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Choose source or enter URL</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setActiveZonePath(null)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto bg-slate-50 flex-1 space-y-8 custom-scrollbar">
                          {/* Image Upload Option */}
                          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center">
                              <Upload className="w-4 h-4 mr-2 text-emerald-500" />
                              Upload Image File
                            </h4>
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-emerald-400 transition-all">
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Plus className="w-8 h-8 text-slate-300 mb-2" />
                                <p className="text-sm text-slate-500 font-medium">Click to upload image</p>
                                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">PNG, JPG, WEBP</p>
                              </div>
                              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </label>
                          </div>

                          {/* Manual URL Input - "To Type" */}
                          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center">
                              <Type className="w-4 h-4 mr-2 text-blue-500" />
                              Enter Image URL
                            </h4>
                            <div className="flex gap-3">
                              <input 
                                type="text"
                                placeholder="https://example.com/image.png"
                                className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.currentTarget.value) {
                                    const url = e.currentTarget.value;
                                    const targetItem = activeZonePath ? getItemByPath(activeZonePath) : null;
                                    const isImgBlock = targetItem && targetItem.TYPE === 'IMG';

                                    setPendingImage({ url, path: activeZonePath });
                                    setPendingImageSettings({
                                      url,
                                      width: isImgBlock ? 100 : (activeZonePath ? 25 : 100),
                                      alignment: isImgBlock ? 'center' : (activeZonePath ? 'right' : 'center'),
                                      hasBorder: false,
                                      caption: ''
                                    });
                                  }
                                }}
                                id="manual-url-input"
                              />
                              <button
                                onClick={() => {
                                  const input = document.getElementById('manual-url-input') as HTMLInputElement;
                                  if (input && input.value) {
                                    const url = input.value;
                                    const targetItem = activeZonePath ? getItemByPath(activeZonePath) : null;
                                    const isImgBlock = targetItem && targetItem.TYPE === 'IMG';

                                    setPendingImage({ url, path: activeZonePath });
                                    setPendingImageSettings({
                                      url,
                                      width: isImgBlock ? 100 : (activeZonePath ? 25 : 100),
                                      alignment: isImgBlock ? 'center' : (activeZonePath ? 'right' : 'center'),
                                      hasBorder: false,
                                      caption: ''
                                    });
                                  }
                                }}
                                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-100"
                              >
                                Add
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-3 italic">Paste any image link from the web to include it in your document.</p>
                          </div>

                          {/* Extracted Images */}
                          <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center">
                              <ImageIcon className="w-4 h-4 mr-2 text-purple-500" />
                              From Extracted Images
                            </h4>
                            {extractedImages.length === 0 ? (
                              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
                                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">No extracted images available.</p>
                                <p className="text-[10px] mt-1">Upload a PDF in settings to see images here.</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {extractedImages.map((img, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      const path = activeZonePath;
                                      if (!path) return;
                                      setPendingImage({ url: img.url, path });
                                      setPendingImageSettings({
                                        ...img,
                                        width: 25,
                                        alignment: 'right'
                                      });
                                    }}
                                    className="relative group border-2 border-white hover:border-blue-500 rounded-xl overflow-hidden shadow-sm bg-white transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                                  >
                                    <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors z-10 flex items-center justify-center">
                                      <Plus className="w-8 h-8 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                                    </div>
                                    <img src={img.url} alt={`Selectable ${idx}`} className="w-full h-32 object-contain p-2" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                          <button
                            onClick={() => setActiveZonePath(null)}
                            className="px-8 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* Floating Settings Button */}
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center z-40"
                  aria-label="Settings"
                >
                  <Settings className="w-6 h-6" />
                </button>

                {/* Settings Menu Popup */}
                <AnimatePresence>
                  {isSettingsOpen && (
                    <>
                      {/* Backdrop */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSettingsOpen(false)}
                        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
                      />
                      
                      {/* Menu Panel */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed bottom-24 right-8 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 flex flex-col"
                      >
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                          <h3 className="font-bold text-slate-800 flex items-center">
                            <Settings className="w-5 h-5 mr-2 text-blue-500" />
                            Document Settings
                          </h3>
                          <button 
                            onClick={() => setIsSettingsOpen(false)}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        
                        <div className="p-6 space-y-8 overflow-y-auto max-h-[60vh]">
                          {/* Text Size Slider */}
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <label className="text-sm font-semibold text-slate-700 flex items-center">
                                <Type className="w-4 h-4 mr-2 text-slate-500" />
                                Text Size
                              </label>
                              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{textSize}px</span>
                            </div>
                            <input 
                              type="range" 
                              min="12" 
                              max="32" 
                              step="1"
                              value={textSize}
                              onChange={(e) => setTextSize(Number(e.target.value))}
                              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                              <span>A</span>
                              <span className="text-base">A</span>
                            </div>
                          </div>

                          {/* Drag Mode Toggle */}
                          <div className="border-t border-slate-100 pt-6">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-semibold text-slate-700 flex items-center">
                                <Move className="w-4 h-4 mr-2 text-slate-500" />
                                Drag & Drop Images
                              </label>
                              <button
                                onClick={() => setIsDragModeActive(!isDragModeActive)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDragModeActive ? 'bg-blue-600' : 'bg-slate-200'}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDragModeActive ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                            </div>
                            <p className="text-xs text-slate-500">
                              Enable to drag extracted images and drop them anywhere inside the document.
                            </p>
                          </div>

                          {/* Ordering Mode Toggle */}
                          <div className="border-t border-slate-100 pt-6">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-semibold text-slate-700 flex items-center">
                                <Layout className="w-4 h-4 mr-2 text-slate-500" />
                                Ordering Mode
                              </label>
                              <button
                                onClick={() => setIsOrderingMode(!isOrderingMode)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOrderingMode ? 'bg-blue-600' : 'bg-slate-200'}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOrderingMode ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                            </div>
                            <p className="text-xs text-slate-500">
                              Enable content reordering and image placement zones.
                            </p>
                          </div>

                           {/* Theme Selection */}
                           <div className="border-t border-slate-100 pt-6">
                            <label className="text-sm font-semibold text-slate-700 flex items-center mb-4">
                              <Layout className="w-4 h-4 mr-2 text-slate-500" />
                              Visual Theme
                            </label>
                             <div className="grid grid-cols-3 gap-2">
                              {mainThemes.map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => {
                                    setTheme(t.id as any);
                                    setIsGameThemeMenuOpen(false);
                                  }}
                                  className={cn(
                                    "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                                    theme === t.id ? "border-blue-500 bg-blue-50" : "border-slate-100 hover:border-slate-200"
                                  )}
                                >
                                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", t.color)}>
                                    <t.icon className="w-5 h-5" />
                                  </div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider">{t.name}</span>
                                </button>
                              ))}
                              
                              {/* Game Theme Category */}
                              <div className="relative col-span-3 mt-2">
                                <button
                                  onClick={() => setIsGameThemeMenuOpen(!isGameThemeMenuOpen)}
                                  className={cn(
                                    "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all",
                                    (theme === 'minecraft' || theme === 'undertale') ? "border-emerald-500 bg-emerald-50" : "border-slate-100 hover:border-slate-200"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                                      <Play className="w-6 h-6" />
                                    </div>
                                    <div className="text-left">
                                      <span className="block text-sm font-bold text-slate-800">Game Themes</span>
                                      <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold">Minecraft & Undertale</span>
                                    </div>
                                  </div>
                                  <motion.div
                                    animate={{ rotate: isGameThemeMenuOpen ? 180 : 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                  >
                                    <Plus className="w-5 h-5 text-slate-400" />
                                  </motion.div>
                                </button>

                                <AnimatePresence>
                                  {isGameThemeMenuOpen && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="grid grid-cols-2 gap-2 mt-2 p-2 bg-slate-50 rounded-2xl border border-slate-100">
                                        {gameThemes.map(t => (
                                          <button
                                            key={t.id}
                                            onClick={() => setTheme(t.id as any)}
                                            className={cn(
                                              "flex items-center gap-3 p-3 rounded-xl border-2 transition-all bg-white",
                                              theme === t.id ? "border-emerald-500 shadow-md scale-[1.02]" : "border-transparent hover:border-slate-200"
                                            )}
                                          >
                                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm", t.color)}>
                                              <t.icon className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-700">{t.name}</span>
                                          </button>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </div>

                           {/* Font Selection */}
                           <div className="border-t border-slate-100 pt-6">
                            <div className="flex items-center justify-between mb-4">
                              <label className="text-sm font-semibold text-slate-700 flex items-center">
                                <FontIcon className="w-4 h-4 mr-2 text-slate-500" />
                                Typography
                              </label>
                              <label className="cursor-pointer bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-blue-100 transition-colors">
                                <Plus className="w-3 h-3 inline mr-1" />
                                Upload Font
                                <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleFontUpload} />
                              </label>
                            </div>

                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                              <button
                                onClick={() => setSelectedFont('Inter')}
                                className={`w-full flex items-center justify-between p-2 rounded-xl border-2 transition-all ${
                                  selectedFont === 'Inter' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200'
                                }`}
                              >
                                <span className="text-sm font-medium">Inter (Default)</span>
                                {selectedFont === 'Inter' && <Check className="w-4 h-4 text-blue-500" />}
                              </button>

                              {uploadedFonts.map(font => (
                                <div key={font.name} className="flex items-center gap-2">
                                  <button
                                    onClick={() => setSelectedFont(font.name)}
                                    className={`flex-1 flex items-center justify-between p-2 rounded-xl border-2 transition-all ${
                                      selectedFont === font.name ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200'
                                    }`}
                                  >
                                    <span className="text-sm font-medium truncate max-w-[120px]" style={{ fontFamily: font.name }}>{font.name}</span>
                                    {selectedFont === font.name && <Check className="w-4 h-4 text-blue-500" />}
                                  </button>
                                  <button 
                                    onClick={() => handleRemoveFont(font.name)}
                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Color Cycle Customization */}
                          <div className="border-t border-slate-100 pt-6">
                            <div className="flex items-center justify-between mb-4">
                              <label className="text-sm font-semibold text-slate-700 flex items-center">
                                <Sparkles className="w-4 h-4 mr-2 text-blue-500" />
                                Color Cycle
                              </label>
                              <button 
                                onClick={() => setSelectedColors([])}
                                className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-red-500 transition-colors"
                              >
                                Clear All
                              </button>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mb-4">
                              {PRESET_COLORS.map(color => {
                                const count = selectedColors.filter(c => c === color.hex).length;
                                const isSelected = count > 0;
                                return (
                                  <button
                                    key={color.id}
                                    onClick={() => {
                                      setSelectedColors(prev => [...prev, color.hex]);
                                    }}
                                    className={`w-8 h-8 rounded-full border-2 transition-all relative flex items-center justify-center ${
                                      isSelected ? 'border-slate-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: color.hex }}
                                    title={color.name}
                                  >
                                    {isSelected && (
                                      <span className="absolute -top-2 -right-2 bg-slate-900 text-white text-[10px] min-w-[1rem] h-4 px-1 rounded-full flex items-center justify-center font-bold border border-white">
                                        {count}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            
                            {selectedColors.length > 0 ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Current Cycle (Click to remove)</span>
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {selectedColors.length} colors
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                                  {selectedColors.map((hex, i) => (
                                    <button 
                                      key={i} 
                                      onClick={() => {
                                        setSelectedColors(prev => prev.filter((_, idx) => idx !== i));
                                      }}
                                      className="group relative flex-shrink-0 w-6 h-6 rounded-full border border-white shadow-sm hover:scale-110 transition-transform" 
                                      style={{ backgroundColor: hex }} 
                                    >
                                      <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 rounded-full transition-opacity">
                                        <X className="w-3 h-3 text-white" />
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 italic">
                                Pick colors to create a custom theme cycle.
                              </p>
                            )}
                          </div>

                          <div className="border-t border-slate-100 pt-6 space-y-6">
                            <HtmlUploader onMetadataExtracted={(metadata) => {
                              handleHtmlMetadataExtracted(metadata);
                              setIsSettingsOpen(false);
                            }} />
                            <div className="border-t border-slate-100 pt-6">
                              <PdfUploader onImagesExtracted={(images) => {
                                setExtractedImages(prev => [...prev, ...images.map(url => ({ url, alignment: 'center' as const, size: 'medium' as const, hasBorder: false }))]);
                                setIsSettingsOpen(false); // Optionally close menu after upload
                              }} />
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-6 space-y-4">
                            <button 
                              onClick={() => navigate(`/fluid${noteId ? `?noteId=${noteId}` : ''}`)}
                              className="w-full flex items-center justify-center px-6 py-4 text-sm font-bold text-emerald-700 bg-emerald-50 border-2 border-emerald-100 rounded-2xl hover:bg-emerald-100 transition-all active:scale-95 shadow-sm mb-2"
                            >
                              <Sparkles className="w-5 h-5 mr-2 text-emerald-500" />
                              Enter Fluid Mode
                            </button>

                            <button 
                              onClick={() => {
                                setIsSettingsOpen(false);
                                setIsSaveModalOpen(true);
                              }}
                              disabled={!parsedData}
                              className="w-full flex items-center justify-center px-6 py-4 text-sm font-bold text-blue-700 bg-blue-50 border-2 border-blue-100 rounded-2xl hover:bg-blue-100 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                            >
                              <Save className="w-5 h-5 mr-2" />
                              Save Note
                            </button>

                            <button 
                              onClick={async () => {
                                setIsGenerating(true);
                                setIsSettingsOpen(false);
                                try {
                                  await generatePDF(
                                    parsedData, 
                                    imagePlacements, 
                                    selectedColors, 
                                    textSize,
                                    uploadedFonts.find(f => f.name === selectedFont),
                                    theme
                                  );
                                } catch (err) {
                                  console.error("PDF Export failed:", err);
                                  alert("Failed to export PDF. Check console for details.");
                                } finally {
                                  setIsGenerating(false);
                                }
                              }}
                              disabled={isGenerating || !parsedData}
                              className="w-full flex items-center justify-center px-6 py-4 text-sm font-bold text-white bg-orange-600 rounded-2xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isGenerating ? (
                                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                              ) : (
                                <Download className="w-5 h-5 mr-2" />
                              )}
                              Export PDF Now
                            </button>

                            <button 
                              onClick={async () => {
                                setIsGenerating(true);
                                setIsSettingsOpen(false);
                                try {
                                  await exportToHTML(
                                    parsedData, 
                                    imagePlacements, 
                                    selectedColors, 
                                    textSize,
                                    uploadedFonts.find(f => f.name === selectedFont),
                                    theme
                                  );
                                } catch (err) {
                                  console.error("HTML Export failed:", err);
                                  alert("Failed to export HTML. Check console for details.");
                                } finally {
                                  setIsGenerating(false);
                                }
                              }}
                              disabled={isGenerating || !parsedData}
                              className="w-full flex items-center justify-center px-6 py-4 text-sm font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isGenerating ? (
                                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                              ) : (
                                <FileCode className="w-5 h-5 mr-2" />
                              )}
                              Download HTML
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
                
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* Prompt Configuration Modal */}
      <AnimatePresence>
        {isPromptModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPromptModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 flex flex-col max-h-[80vh]"
            >
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center text-sm">
                  <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
                  Configure AI Prompt
                </h3>
                <button 
                  onClick={() => setIsPromptModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-5 overflow-y-auto bg-white flex-1 custom-scrollbar">
                <div className="mb-5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Output Format</h4>
                  <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg">
                    <button
                      onClick={() => setPromptFormat('CSV')}
                      className={`flex-1 py-1.5 px-3 rounded-md font-medium text-sm transition-all ${
                        promptFormat === 'CSV'
                          ? 'bg-white text-purple-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => setPromptFormat('JSON')}
                      className={`flex-1 py-1.5 px-3 rounded-md font-medium text-sm transition-all ${
                        promptFormat === 'JSON'
                          ? 'bg-white text-purple-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      JSON
                    </button>
                  </div>
                </div>

                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Content Types</h4>
                  <span className="text-xs text-slate-400">{selectedPromptTypes.length} selected</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_TYPES.map(type => {
                    const isSelected = selectedPromptTypes.includes(type.id);
                    return (
                      <button
                        key={type.id}
                        onClick={() => togglePromptType(type.id)}
                        className={`flex items-center p-2 rounded-lg border text-left transition-all ${
                          isSelected 
                            ? 'border-purple-200 bg-purple-50' 
                            : 'border-slate-100 hover:border-purple-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="mr-2 flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-purple-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`font-semibold text-xs truncate ${isSelected ? 'text-purple-900' : 'text-slate-700'}`}>
                            {type.id}
                          </div>
                          <div className={`text-[10px] truncate ${isSelected ? 'text-purple-600/80' : 'text-slate-400'}`}>
                            {type.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end items-center">
                <button
                  onClick={handleCopyPrompt}
                  disabled={selectedPromptTypes.length === 0}
                  className="flex items-center px-5 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isPromptCopied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" /> Copied!
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" /> Copy Prompt
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}

        {reorderGroupIndex !== null && parsedData && parsedData[reorderGroupIndex] && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReorderGroupIndex(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 flex flex-col max-h-[80vh]"
            >
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center text-sm">
                  <Settings className="w-4 h-4 mr-2 text-blue-500" />
                  Reorder: {parsedData[reorderGroupIndex].GROUP}
                </h3>
                <button 
                  onClick={() => setReorderGroupIndex(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-5 overflow-y-auto bg-white flex-1 custom-scrollbar">
                <div className="flex flex-col gap-2">
                  {parsedData[reorderGroupIndex].ITEMS.map((item: any, idx: number) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex flex-col min-w-0 flex-1 mr-4">
                        <span className="text-xs font-bold text-slate-500 uppercase">{item.TYPE}</span>
                        <span className="text-sm text-slate-800 truncate">{item.CONTENT}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => {
                            if (idx > 0) {
                              setParsedData((prev: any) => {
                                const newData = [...prev];
                                const group = { ...newData[reorderGroupIndex], ITEMS: [...newData[reorderGroupIndex].ITEMS] };
                                const temp = group.ITEMS[idx];
                                group.ITEMS[idx] = group.ITEMS[idx - 1];
                                group.ITEMS[idx - 1] = temp;
                                newData[reorderGroupIndex] = group;
                                return newData;
                              });
                            }
                          }}
                          disabled={idx === 0}
                          className="p-1 bg-slate-200 hover:bg-slate-300 disabled:opacity-30 disabled:hover:bg-slate-200 rounded transition-colors"
                        >
                          <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button
                          onClick={() => {
                            if (idx < parsedData[reorderGroupIndex].ITEMS.length - 1) {
                              setParsedData((prev: any) => {
                                const newData = [...prev];
                                const group = { ...newData[reorderGroupIndex], ITEMS: [...newData[reorderGroupIndex].ITEMS] };
                                const temp = group.ITEMS[idx];
                                group.ITEMS[idx] = group.ITEMS[idx + 1];
                                group.ITEMS[idx + 1] = temp;
                                newData[reorderGroupIndex] = group;
                                return newData;
                              });
                            }
                          }}
                          disabled={idx === parsedData[reorderGroupIndex].ITEMS.length - 1}
                          className="p-1 bg-slate-200 hover:bg-slate-300 disabled:opacity-30 disabled:hover:bg-slate-200 rounded transition-colors"
                        >
                          <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end items-center">
                <button
                  onClick={() => setReorderGroupIndex(null)}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Image Configuration Modal for New Images */}
      {pendingImage && (
        <ImageSettingsModal
          image={pendingImageSettings}
          onClose={() => setPendingImage(null)}
          onUpdate={(updates) => setPendingImageSettings(prev => ({ ...prev, ...updates }))}
          onConfirm={handleConfirmPendingImage}
          confirmLabel="Add to Document"
        />
      )}

      {/* Save Note Modal */}
      <AnimatePresence>
        {isSaveModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Save className="w-5 h-5 text-blue-500" />
                  Save Note
                </h3>
                <button 
                  onClick={() => setIsSaveModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">Note Name</label>
                <input
                  type="text"
                  value={noteName}
                  onChange={(e) => setNoteName(e.target.value)}
                  placeholder="e.g., Biology Chapter 4"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all text-slate-700 font-medium"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNote();
                  }}
                />
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  disabled={!noteName.trim()}
                  className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Note
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
