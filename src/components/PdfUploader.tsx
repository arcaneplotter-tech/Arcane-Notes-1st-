import React, { useState } from 'react';
import { UploadCloud, Loader2, Image as ImageIcon } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Use imported worker URL to avoid CDN and Vite bundling issues
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Props {
  onImagesExtracted: (images: string[]) => void;
}

export default function PdfUploader({ onImagesExtracted }: Props) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const images: string[] = [];

      // Extract embedded images from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const ops = await page.getOperatorList();
        
        for (let i = 0; i < ops.fnArray.length; i++) {
          const fn = ops.fnArray[i];
          
          if (
            fn === pdfjsLib.OPS.paintImageXObject ||
            // @ts-ignore
            fn === pdfjsLib.OPS.paintJpegXObject ||
            // @ts-ignore
            fn === pdfjsLib.OPS.paintInlineImageXObject
          ) {
            const objId = ops.argsArray[i][0];
            try {
              const imgObj = await page.objs.get(objId);

              if (!imgObj) continue;

              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) continue;

              canvas.width = imgObj.width;
              canvas.height = imgObj.height;

              if (imgObj.data && imgObj.data.length > 0) {
                const imgData = ctx.createImageData(imgObj.width, imgObj.height);
                
                if (imgObj.data.length === imgObj.width * imgObj.height * 3) {
                  // RGB
                  for (let j = 0, k = 0; j < imgObj.data.length; j += 3, k += 4) {
                    imgData.data[k] = imgObj.data[j];
                    imgData.data[k + 1] = imgObj.data[j + 1];
                    imgData.data[k + 2] = imgObj.data[j + 2];
                    imgData.data[k + 3] = 255;
                  }
                } else if (imgObj.data.length === imgObj.width * imgObj.height * 4) {
                  // RGBA
                  imgData.data.set(imgObj.data);
                } else if (imgObj.data.length === imgObj.width * imgObj.height) {
                  // Grayscale
                  for (let j = 0, k = 0; j < imgObj.data.length; j += 1, k += 4) {
                    const val = imgObj.data[j];
                    imgData.data[k] = val;
                    imgData.data[k + 1] = val;
                    imgData.data[k + 2] = val;
                    imgData.data[k + 3] = 255;
                  }
                } else {
                  if (imgObj.data.length === imgData.data.length) {
                    imgData.data.set(imgObj.data);
                  } else {
                    continue; // unsupported format
                  }
                }
                
                ctx.putImageData(imgData, 0, 0);
                images.push(canvas.toDataURL('image/jpeg', 0.8));
              } else if (imgObj.bitmap) {
                ctx.drawImage(imgObj.bitmap, 0, 0);
                images.push(canvas.toDataURL('image/jpeg', 0.8));
              } else if (imgObj instanceof HTMLImageElement || imgObj instanceof HTMLCanvasElement || imgObj instanceof ImageBitmap) {
                ctx.drawImage(imgObj, 0, 0);
                images.push(canvas.toDataURL('image/jpeg', 0.8));
              }
            } catch (e) {
              console.warn("Could not extract image", e);
            }
          }
        }
      }

      onImagesExtracted(images);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to extract images from PDF.');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
        <ImageIcon className="w-6 h-6 text-purple-600" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-2">Extract Images from PDF</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-md">
        Upload an existing PDF to automatically extract its pages as images and append them to your generated document preview.
      </p>

        <label className="relative cursor-pointer">
          <input 
            type="file" 
            accept="application/pdf" 
            className="hidden" 
            onChange={handleFileUpload}
            disabled={isExtracting}
          />
          <div className={`flex items-center px-6 py-3 rounded-lg font-medium text-white transition-all shadow-md ${isExtracting ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 hover:shadow-lg hover:-translate-y-0.5'}`}>
            {isExtracting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Extracting...
              </>
            ) : (
              <>
                <UploadCloud className="w-5 h-5 mr-2" /> Upload PDF
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
