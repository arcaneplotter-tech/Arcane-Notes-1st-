import React, { useState } from 'react';
import { UploadCloud, Loader2, FileCode } from 'lucide-react';

interface Props {
  onMetadataExtracted: (metadata: any) => void;
}

export default function HtmlUploader({ onMetadataExtracted }: Props) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/html' && !file.name.endsWith('.html')) {
      setError('Please upload a valid HTML file.');
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const text = await file.text();
      
      // Try to find metadata in script tag first
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const scriptTag = doc.getElementById('arcane-notes-metadata');
      
      let metadata: any = null;
      
      if (scriptTag) {
        try {
          metadata = JSON.parse(scriptTag.textContent || '');
        } catch (e) {
          console.warn('Failed to parse metadata from script tag', e);
        }
      }
      
      // Fallback: search for metadata in comments
      if (!metadata) {
        const startMarker = '<!-- ARCANE_NOTES_METADATA_START';
        const endMarker = 'ARCANE_NOTES_METADATA_END -->';
        
        const startIndex = text.indexOf(startMarker);
        const endIndex = text.indexOf(endMarker);
        
        if (startIndex !== -1 && endIndex !== -1) {
          const jsonStr = text.substring(startIndex + startMarker.length, endIndex).trim();
          try {
            metadata = JSON.parse(jsonStr);
          } catch (e) {
            console.warn('Failed to parse metadata from comment', e);
          }
        }
      }

      if (metadata) {
        onMetadataExtracted(metadata);
      } else {
        throw new Error('No Arcane Notes metadata found in this HTML file. Make sure it was exported from this app.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to extract data from HTML.');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
        <FileCode className="w-6 h-6 text-blue-600" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-2">Import from HTML</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-md">
        Upload a previously exported Arcane Notes HTML file to restore its content, images, and settings.
      </p>

        <label className="relative cursor-pointer">
          <input 
            type="file" 
            accept=".html,text/html" 
            className="hidden" 
            onChange={handleFileUpload}
            disabled={isExtracting}
          />
          <div className={`flex items-center px-6 py-3 rounded-lg font-medium text-white transition-all shadow-md ${isExtracting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5'}`}>
            {isExtracting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Importing...
              </>
            ) : (
              <>
                <UploadCloud className="w-5 h-5 mr-2" /> Upload HTML
              </>
            )}
          </div>
        </label>

        {error && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md border border-red-100">
            {error}
          </p>
        )}
    </div>
  );
}
