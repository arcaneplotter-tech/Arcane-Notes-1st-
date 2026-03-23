import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PlacedImage {
  url: string;
  size?: 'small' | 'medium' | 'large' | 'full';
  alignment: 'left' | 'center' | 'right';
  width?: number;
  hasBorder?: boolean;
  caption?: string;
}

export interface CustomFont {
  name: string;
  data: string;
  fileName: string;
}

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

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b];
}

const namedColors: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  purple: '#a855f7',
  pink: '#ec4899',
  orange: '#f97316',
  gray: '#64748b',
  black: '#000000',
  white: '#ffffff',
};

let currentFontName = 'helvetica';

function colorToRgb(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    return hexToRgb(color);
  }
  const hex = namedColors[color.toLowerCase()];
  if (hex) {
    return hexToRgb(hex);
  }
  return [0, 0, 0];
}

interface TextSegment {
  text: string;
  isBold: boolean;
  isItalic: boolean;
  isHighlight: boolean;
  isMemoryLink?: boolean;
  color?: string;
}

function stripMemoryLinks(text: string): string {
  return text.replace(/\[\[(.*?)\]\]/g, '$1');
}

function parseRichText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentText = '';
  let isBold = false;
  let isItalic = false;
  let isHighlight = false;
  let colorStack: string[] = [];

  let i = 0;
  while (i < text.length) {
    if (text.startsWith('**', i) || text.startsWith('__', i)) {
      if (currentText) segments.push({ text: currentText, isBold, isItalic, isHighlight, color: colorStack[colorStack.length - 1] });
      currentText = '';
      isBold = !isBold;
      i += 2;
    } else if (text.startsWith('*', i) || text.startsWith('_', i)) {
      if (currentText) segments.push({ text: currentText, isBold, isItalic, isHighlight, color: colorStack[colorStack.length - 1] });
      currentText = '';
      isItalic = !isItalic;
      i += 1;
    } else if (text.startsWith('==', i)) {
      if (currentText) segments.push({ text: currentText, isBold, isItalic, isHighlight, color: colorStack[colorStack.length - 1] });
      currentText = '';
      isHighlight = !isHighlight;
      i += 2;
    } else if (text.startsWith('[c:', i)) {
      const closeBracket = text.indexOf(']', i);
      if (closeBracket !== -1) {
        if (currentText) segments.push({ text: currentText, isBold, isItalic, isHighlight, color: colorStack[colorStack.length - 1] });
        currentText = '';
        const color = text.substring(i + 3, closeBracket);
        colorStack.push(color);
        i = closeBracket + 1;
      } else {
        currentText += text[i];
        i++;
      }
    } else if (text.startsWith('[/c]', i)) {
      if (currentText) segments.push({ text: currentText, isBold, isItalic, isHighlight, color: colorStack[colorStack.length - 1] });
      currentText = '';
      if (colorStack.length > 0) colorStack.pop();
      i += 4;
    } else if (text.startsWith('[[', i)) {
      const closeBracket = text.indexOf(']]', i);
      if (closeBracket !== -1) {
        if (currentText) segments.push({ text: currentText, isBold, isItalic, isHighlight, color: colorStack[colorStack.length - 1] });
        currentText = '';
        const concept = text.substring(i + 2, closeBracket);
        segments.push({ text: concept, isBold, isItalic, isHighlight, color: colorStack[colorStack.length - 1], isMemoryLink: true });
        i = closeBracket + 2;
      } else {
        currentText += text[i];
        i++;
      }
    } else if (text.startsWith('[', i)) {
      const closeBracket = text.indexOf(']', i);
      const openBrace = text.indexOf('{', closeBracket);
      const closeBrace = text.indexOf('}', openBrace);
      
      if (closeBracket !== -1 && openBrace === closeBracket + 1 && closeBrace !== -1) {
        if (currentText) segments.push({ text: currentText, isBold, isItalic, isHighlight, color: colorStack[colorStack.length - 1] });
        currentText = '';
        const term = text.substring(i + 1, closeBracket);
        // Render the term as bold
        segments.push({ text: term, isBold: true, isItalic, isHighlight, color: colorStack[colorStack.length - 1] });
        i = closeBrace + 1;
      } else {
        currentText += text[i];
        i++;
      }
    } else {
      currentText += text[i];
      i++;
    }
  }
  if (currentText) segments.push({ text: currentText, isBold, isItalic, isHighlight, color: colorStack[colorStack.length - 1] });
  return segments;
}

function drawRichText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number = 1.2,
  align: 'left' | 'center' | 'right' = 'left',
  groupColor: string = '#3b82f6',
  baseStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal',
  defaultTextColor: [number, number, number] = [15, 23, 42],
  theme: string = 'modern'
): number {
  const segments = parseRichText(text);
  const words: { text: string; isBold: boolean; isItalic: boolean; isHighlight: boolean; isMemoryLink?: boolean; color?: string; width: number }[] = [];

  // Theme-specific font selection
  let themeFont = currentFontName;
  if (theme === 'cyberpunk' && currentFontName === 'helvetica') themeFont = 'courier';
  if (theme === 'vintage' && currentFontName === 'helvetica') themeFont = 'times';
  if (theme === 'terminal' && currentFontName === 'helvetica') themeFont = 'courier';
  if (theme === 'ethereal' && currentFontName === 'helvetica') themeFont = 'times';
  if (theme === 'prism' && currentFontName === 'helvetica') themeFont = 'helvetica';
  if (theme === 'minecraft' && currentFontName === 'helvetica') themeFont = 'courier';
  if (theme === 'undertale' && currentFontName === 'helvetica') themeFont = 'courier';
  if (theme === 'god-of-war' && currentFontName === 'helvetica') themeFont = 'times';
  if (theme === 'cuphead' && currentFontName === 'helvetica') themeFont = 'helvetica';

  // Split segments into words while preserving styles
  segments.forEach(seg => {
    const segWords = seg.text.split(/(\s+)/);
    segWords.forEach(word => {
      if (word === '') return;
      
      let style = baseStyle;
      const bold = seg.isBold || baseStyle.includes('bold');
      const italic = seg.isItalic || baseStyle.includes('italic');
      
      if (bold && italic) style = 'bolditalic';
      else if (bold) style = 'bold';
      else if (italic) style = 'italic';
      else style = 'normal';
      
      // If using custom font, we might not have bold/italic variants
      const currentFont = themeFont;
      const currentStyle = (themeFont === 'helvetica' || themeFont === 'times' || themeFont === 'courier') ? style : 'normal';

      doc.setFont(currentFont, currentStyle);
      doc.setFontSize(fontSize);
      const width = doc.getTextWidth(word);
      words.push({ text: word, isBold: bold, isItalic: italic, isHighlight: seg.isHighlight, isMemoryLink: seg.isMemoryLink, color: seg.color, width });
    });
  });

  // Wrap words into lines
  const lines: typeof words[] = [];
  let currentLine: typeof words = [];
  let currentLineWidth = 0;

  words.forEach(word => {
    if (word.text === '\n') {
      lines.push(currentLine);
      currentLine = [];
      currentLineWidth = 0;
      return;
    }

    if (currentLineWidth + word.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
      currentLineWidth = 0;
    }

    // Skip leading spaces on new lines
    if (currentLine.length === 0 && word.text.trim() === '') return;

    currentLine.push(word);
    currentLineWidth += word.width;
  });
  if (currentLine.length > 0) lines.push(currentLine);

  // Render lines
  let currentY = y;
  const fontHeight = (fontSize * 0.3527); // mm

  lines.forEach(line => {
    let currentX = x;
    const lineWidth = line.reduce((sum, w) => sum + w.width, 0);

    if (align === 'center') {
      currentX = x + (maxWidth - lineWidth) / 2;
    } else if (align === 'right') {
      currentX = x + (maxWidth - lineWidth);
    }

    line.forEach(word => {
      let style = 'normal';
      if (word.isBold && word.isItalic) style = 'bolditalic';
      else if (word.isBold) style = 'bold';
      else if (word.isItalic) style = 'italic';

      const currentStyle = (themeFont === 'helvetica' || themeFont === 'times' || themeFont === 'courier') ? style : 'normal';

      doc.setFont(themeFont, currentStyle);
      doc.setFontSize(fontSize);

      if (word.isMemoryLink) {
        // Apply group color to memory links (overrides explicit color blocks to match UI behavior)
        const memoryLinkColor = groupColor || (theme === 'cyberpunk' ? '#22d3ee' : (theme === 'terminal' ? '#22c55e' : (theme === 'god-of-war' ? '#ffd700' : (theme === 'undertale' ? '#ffff00' : (theme === 'cuphead' ? '#2563eb' : '#2563eb')))));
        doc.setTextColor(...hexToRgb(memoryLinkColor));
      } else if (word.color) {
        doc.setTextColor(...colorToRgb(word.color));
      } else if (word.isBold || word.isItalic) {
        // Apply group color to bold/italic text if no explicit color is set
        doc.setTextColor(...hexToRgb(getShade(groupColor, -0.2)));
      } else {
        doc.setTextColor(...defaultTextColor);
      }

      if (word.isHighlight) {
        let highlightColor: [number, number, number] = hexToRgb(getShade(groupColor, 0.8));
        if (theme === 'cyberpunk') highlightColor = [250, 204, 21]; // Semi-transparent yellow (jsPDF doesn't support alpha in rect easily with RGB, but we can use a lighter yellow)
        if (theme === 'vintage') highlightColor = [244, 236, 216];
        if (theme === 'terminal') highlightColor = [0, 64, 0];
        if (theme === 'ethereal') highlightColor = [238, 242, 255];
        if (theme === 'prism') highlightColor = [245, 243, 255]; // Light indigo
        
        doc.setFillColor(...highlightColor);
        doc.rect(currentX, currentY - fontHeight * 0.8, word.width, fontHeight * 1.1, 'F');
      }

      doc.text(word.text, currentX, currentY);
      currentX += word.width;
    });
    currentY += fontHeight * lineHeight;
  });

  return currentY - y;
}

const loadImage = (url: string): Promise<{ data: string, width: number, height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      // Use JPEG with 0.8 quality to reduce file size significantly compared to PNG
      resolve({
        data: canvas.toDataURL('image/jpeg', 0.8),
        width: img.width,
        height: img.height
      });
    };
    img.onerror = reject;
    img.src = url;
  });
};

export const generatePDF = async (
  parsedData: any[],
  imagePlacements: Record<string, PlacedImage[]>,
  selectedColors: string[],
  baseTextSize: number,
  customFont?: CustomFont,
  theme: string = 'modern'
) => {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = 20;

  currentFontName = customFont ? customFont.name : 'helvetica';

  // Theme-specific settings
  const themeSettings = {
    modern: {
      bg: [255, 255, 255] as [number, number, number],
      text: [15, 23, 42] as [number, number, number],
      accent: [59, 130, 246] as [number, number, number],
      font: 'helvetica'
    },
    cyberpunk: {
      bg: [10, 10, 15] as [number, number, number],
      text: [0, 255, 255] as [number, number, number],
      accent: [168, 85, 247] as [number, number, number],
      font: 'courier'
    },
    vintage: {
      bg: [253, 251, 247] as [number, number, number],
      text: [74, 55, 40] as [number, number, number],
      accent: [212, 197, 161] as [number, number, number],
      font: 'times'
    },
    terminal: {
      bg: [0, 0, 0] as [number, number, number],
      text: [34, 197, 94] as [number, number, number],
      accent: [34, 197, 94] as [number, number, number],
      font: 'courier'
    },
    ethereal: {
      bg: [255, 255, 255] as [number, number, number],
      text: [49, 46, 129] as [number, number, number],
      accent: [99, 102, 241] as [number, number, number],
      font: 'times'
    },
    prism: {
      bg: [255, 255, 255] as [number, number, number],
      text: [15, 23, 42] as [number, number, number],
      accent: [99, 102, 241] as [number, number, number],
      font: 'helvetica'
    },
    minecraft: {
      bg: [255, 255, 255] as [number, number, number],
      text: [55, 55, 55] as [number, number, number],
      accent: [85, 85, 85] as [number, number, number],
      font: 'courier'
    },
    undertale: {
      bg: [0, 0, 0] as [number, number, number],
      text: [255, 255, 255] as [number, number, number],
      accent: [255, 0, 0] as [number, number, number],
      font: 'courier'
    },
    'god-of-war': {
      bg: [10, 10, 10] as [number, number, number],
      text: [203, 213, 225] as [number, number, number],
      accent: [139, 0, 0] as [number, number, number],
      font: 'times'
    },
    cuphead: {
      bg: [245, 245, 220] as [number, number, number],
      text: [0, 0, 0] as [number, number, number],
      accent: [0, 0, 0] as [number, number, number],
      font: 'helvetica'
    }
  };

  const currentTheme = themeSettings[theme as keyof typeof themeSettings] || themeSettings.modern;

  if (customFont) {
    try {
      const base64 = customFont.data.split(',')[1];
      doc.addFileToVFS(customFont.fileName, base64);
      doc.addFont(customFont.fileName, customFont.name, 'normal');
      doc.setFont(customFont.name);
    } catch (e) {
      console.error('Error adding custom font to PDF:', e);
      currentFontName = 'helvetica';
    }
  }

  // Find document title for filename
  let docTitle = 'Arcane Notes';
  for (const group of parsedData) {
    const titleItem = group.ITEMS.find((item: any) => String(item.TYPE).toUpperCase() === 'TITLE');
    if (titleItem) {
      docTitle = String(titleItem.CONTENT).replace(/[\\/:*?"<>|]/g, '').substring(0, 50);
      break;
    }
  }

  doc.setProperties({
    title: docTitle,
    subject: 'Generated by Arcane Notes',
    creator: 'Arcane Notes'
  });

  let floatingArea: { x: number, y: number, w: number, h: number, side: 'left' | 'right' } | null = null;

  const checkPageBreak = (heightNeeded: number) => {
    if (yPos + heightNeeded > pageHeight - margin) {
      doc.addPage();
      yPos = 20;
      floatingArea = null;
      
      // Re-apply background on new page
      if (theme !== 'modern') {
        doc.setFillColor(...currentTheme.bg);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
      }
    }
  };

  // Initial background
  if (theme !== 'modern') {
    doc.setFillColor(...currentTheme.bg);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  }

  const defaultColors = [
    '#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#f43f5e', '#06b6d4'
  ];
  const colorsToUse = selectedColors.length > 0 ? selectedColors : defaultColors;

  const renderImages = async (path: string) => {
    const images = imagePlacements[path];
    if (!images || images.length === 0) return;

    for (const img of images) {
      try {
        const { data, width, height } = await loadImage(img.url);
        const aspectRatio = height / width;
        
        // Natural size at 96 DPI
        const naturalWidthMm = (width / 96) * 25.4;
        
        // Use the width percentage directly (e.g., 100 means 100% of content width)
        const targetWidthPercent = img.width || 100;
        let targetWidthMm = (contentWidth * targetWidthPercent) / 100;
        
        // Ensure it doesn't exceed content width
        targetWidthMm = Math.min(targetWidthMm, contentWidth);
        const targetHeightMm = targetWidthMm * aspectRatio;

        let totalHeightMm = targetHeightMm;
        let captionHeightMm = 0;
        let captionLines: string[] = [];

        if (img.hasBorder) {
          totalHeightMm += 2; // 1mm border top and bottom
        }

        if (img.caption) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'italic');
          const strippedCaption = stripMemoryLinks(img.caption);
          captionLines = doc.splitTextToSize(strippedCaption, targetWidthMm);
          captionHeightMm = captionLines.length * 4;
          totalHeightMm += captionHeightMm + 2;
        }

        const isFloating = (img.alignment === 'left' || img.alignment === 'right') && targetWidthPercent <= 65;

        // If floating area is active, and we are not floating on the opposite side,
        // we should push yPos down to avoid overlap.
        if (floatingArea) {
          // If we are not floating, or we are floating on the same side, we must move down
          if (!isFloating || floatingArea.side === img.alignment) {
            yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
            floatingArea = null;
          }
        }

        checkPageBreak(totalHeightMm + 5);

        let xOffset = margin;
        if (img.alignment === 'center') {
          xOffset = margin + (contentWidth - targetWidthMm) / 2;
        } else if (img.alignment === 'right') {
          xOffset = margin + (contentWidth - targetWidthMm);
        }

        let currentY = yPos;

        // Border
        if (img.hasBorder) {
          doc.setDrawColor(30, 41, 59); // slate-800
          doc.setLineWidth(1);
          doc.rect(xOffset - 1, currentY - 1, targetWidthMm + 2, targetHeightMm + 2);
        }

        doc.addImage(data, 'JPEG', xOffset, currentY, targetWidthMm, targetHeightMm, undefined, 'FAST');
        
        // Caption
        if (img.caption) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(71, 85, 105); // slate-600
          
          if (img.hasBorder) {
            doc.setFillColor(248, 250, 252); // slate-50
            doc.rect(xOffset - 1, currentY + targetHeightMm + 1, targetWidthMm + 2, captionHeightMm + 2, 'F');
            
            // Draw outer border for caption area
            doc.setDrawColor(30, 41, 59); // slate-800
            doc.setLineWidth(1);
            doc.rect(xOffset - 1, currentY + targetHeightMm + 1, targetWidthMm + 2, captionHeightMm + 2);
          }
          
          doc.text(captionLines, xOffset + targetWidthMm / 2, currentY + targetHeightMm + (img.hasBorder ? 4 : 3), { align: 'center' });
        }

        if (isFloating) {
          floatingArea = {
            x: xOffset,
            y: yPos,
            w: targetWidthMm,
            h: totalHeightMm,
            side: img.alignment as 'left' | 'right'
          };
          // Don't increment yPos yet, let text wrap
        } else {
          yPos += totalHeightMm + 5;
          floatingArea = null;
        }
      } catch (e) {
        console.error('Failed to load image for PDF:', img.url, e);
      }
    }
  };

  const renderItem = async (item: any, path: string, groupColor: string) => {
    await renderImages(`${path}.before`);

    const type = String(item.TYPE).toUpperCase();
    const content = String(item.CONTENT);
    const scale = baseTextSize / 16;

    let currentX = margin;
    let currentMaxWidth = contentWidth;

    if (floatingArea) {
      if (floatingArea.side === 'left') {
        currentX = margin + floatingArea.w + 5;
        currentMaxWidth = contentWidth - floatingArea.w - 5;
      } else {
        currentX = margin;
        currentMaxWidth = contentWidth - floatingArea.w - 5;
      }
    }

    switch (type) {
      case 'TITLE': {
        const fontSize = 24 * scale;
        let titleColor = hexToRgb(getShade(groupColor, -0.4));
        if (theme === 'cyberpunk') titleColor = [255, 255, 255];
        if (theme === 'vintage') titleColor = [44, 30, 20];
        if (theme === 'terminal') titleColor = [34, 197, 94];
        if (theme === 'ethereal') titleColor = [49, 46, 129];
        if (theme === 'prism') titleColor = [79, 70, 229];
        if (theme === 'minecraft') titleColor = [55, 55, 55];
        if (theme === 'undertale') titleColor = [250, 204, 21]; // yellow-400
        if (theme === 'god-of-war') titleColor = [255, 215, 0]; // gold
        if (theme === 'cuphead') titleColor = [0, 0, 0]; // black

        const tempDoc = new jsPDF();
        const height = drawRichText(tempDoc, content.toUpperCase(), 0, 0, currentMaxWidth - (theme === 'cyberpunk' || theme === 'terminal' || theme === 'god-of-war' ? 10 : 0), fontSize, 1.2, 'left', groupColor, 'bold', titleColor, theme);
        
        checkPageBreak(height + 15);
        
        // If floating, check if we fit next to the image
        if (floatingArea && height > floatingArea.h) {
          yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
          floatingArea = null;
          currentX = margin;
          currentMaxWidth = contentWidth;
        }

        if (theme === 'cyberpunk') {
          doc.setFillColor(168, 85, 247, 0.1); // purple-900/10
          doc.rect(currentX, yPos, currentMaxWidth, height + 4, 'F');
          doc.setFillColor(...hexToRgb(groupColor || '#a855f7'));
          doc.rect(currentX, yPos, 2, height + 4, 'F');
          drawRichText(doc, content.toUpperCase(), currentX + 6, yPos + 2 + (fontSize * 0.3527) * 0.7, currentMaxWidth - 10, fontSize, 1.2, 'left', groupColor, 'bold', titleColor, theme);
          yPos += height + 6;
        } else if (theme === 'terminal') {
          doc.setDrawColor(34, 197, 94);
          doc.setLineWidth(0.5);
          doc.rect(currentX, yPos, currentMaxWidth, height + 4, 'D');
          drawRichText(doc, `> ${content.toUpperCase()}`, currentX + 4, yPos + 2 + (fontSize * 0.3527) * 0.7, currentMaxWidth - 10, fontSize, 1.2, 'left', groupColor, 'bold', titleColor, theme);
          yPos += height + 8;
        } else if (theme === 'god-of-war') {
          doc.setFillColor(139, 0, 0, 0.1); // darkred
          doc.rect(currentX, yPos, currentMaxWidth, height + 4, 'F');
          doc.setDrawColor(139, 0, 0);
          doc.setLineWidth(1);
          doc.rect(currentX, yPos, currentMaxWidth, height + 4, 'D');
          drawRichText(doc, content.toUpperCase(), currentX + 5, yPos + 2 + (fontSize * 0.3527) * 0.7, currentMaxWidth - 10, fontSize, 1.2, 'left', groupColor, 'bold', titleColor, theme);
          yPos += height + 8;
        } else if (theme === 'cuphead') {
          doc.setFillColor(255, 255, 255);
          doc.rect(currentX, yPos, currentMaxWidth, height + 8, 'F');
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(1.5);
          doc.rect(currentX, yPos, currentMaxWidth, height + 8, 'D');
          drawRichText(doc, content.toUpperCase(), currentX, yPos + 4 + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.2, 'center', groupColor, 'bold', titleColor, theme);
          yPos += height + 12;
        } else if (theme === 'ethereal') {
          drawRichText(doc, content.toUpperCase(), currentX, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.2, 'center', groupColor, 'normal', titleColor, theme);
          yPos += height + 4;
          doc.setDrawColor(99, 102, 241, 0.2);
          doc.setLineWidth(0.1);
          doc.line(margin + contentWidth * 0.2, yPos, margin + contentWidth * 0.8, yPos);
          yPos += 8;
        } else if (theme === 'vintage') {
          drawRichText(doc, content.toUpperCase(), currentX, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.2, 'center', groupColor, 'bold', titleColor, theme);
          yPos += height + 2;
          doc.setDrawColor(212, 197, 161);
          doc.setLineWidth(0.5);
          doc.line(margin, yPos, margin + contentWidth, yPos);
          doc.line(margin, yPos + 1.5, margin + contentWidth, yPos + 1.5);
          yPos += 8;
        } else if (theme === 'prism') {
          // Prism title with underline and accent
          drawRichText(doc, content.toUpperCase(), currentX, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.2, 'left', groupColor, 'bold', titleColor, theme);
          yPos += height + 2;
          doc.setDrawColor(99, 102, 241);
          doc.setLineWidth(0.8);
          doc.line(margin, yPos, margin + 40, yPos);
          doc.setDrawColor(236, 72, 153);
          doc.line(margin + 40, yPos, margin + 60, yPos);
          yPos += 8;
        } else if (theme === 'minecraft') {
          doc.setFillColor(198, 198, 198); // #c6c6c6
          doc.rect(currentX, yPos, currentMaxWidth, height + 16, 'F');
          doc.setDrawColor(55, 55, 55); // #373737
          doc.setLineWidth(1.5);
          doc.rect(currentX, yPos, currentMaxWidth, height + 16, 'D');
          
          // Minecraft inner shadows
          doc.setDrawColor(255, 255, 255);
          doc.line(currentX + 1, yPos + 1, currentX + currentMaxWidth - 1, yPos + 1);
          doc.line(currentX + 1, yPos + 1, currentX + 1, yPos + height + 15);
          doc.setDrawColor(85, 85, 85);
          doc.line(currentX + 1, yPos + height + 15, currentX + currentMaxWidth - 1, yPos + height + 15);
          doc.line(currentX + currentMaxWidth - 1, yPos + 1, currentX + currentMaxWidth - 1, yPos + height + 15);
          
          drawRichText(doc, content.toUpperCase(), currentX, yPos + 8 + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.2, 'center', groupColor, 'bold', titleColor, theme);
          yPos += height + 24;
        } else if (theme === 'undertale') {
          drawRichText(doc, content.toUpperCase(), currentX, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.2, 'center', groupColor, 'bold', titleColor, theme);
          yPos += height + 16;
        } else {
          drawRichText(doc, content.toUpperCase(), currentX, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.2, 'left', groupColor, 'bold', titleColor, theme);
          yPos += height + 2;
          doc.setDrawColor(...hexToRgb(getShade(groupColor, 0.8)));
          doc.setLineWidth(1);
          doc.line(margin, yPos, margin + contentWidth, yPos);
          yPos += 8;
        }
        break;
      }
      case 'SUBHEADER': {
        const fontSize = 18 * scale;
        let subColor = hexToRgb(getShade(groupColor, -0.2));
        if (theme === 'cyberpunk') subColor = [6, 182, 212]; // cyan-400
        if (theme === 'vintage') subColor = [74, 55, 40]; // #4a3728
        if (theme === 'terminal') subColor = [245, 158, 11]; // amber-500
        if (theme === 'ethereal') subColor = [49, 46, 129]; // indigo-900
        if (theme === 'prism') subColor = [79, 70, 229];
        if (theme === 'minecraft') subColor = [55, 55, 55];
        if (theme === 'undertale') subColor = [255, 255, 255];
        if (theme === 'god-of-war') subColor = [255, 215, 0];
        if (theme === 'cuphead') subColor = [0, 0, 0];

        const tempDoc = new jsPDF();
        const height = drawRichText(tempDoc, content, 0, 0, currentMaxWidth - 10, fontSize, 1.2, 'left', groupColor, 'bold', subColor, theme);
        
        checkPageBreak(height + 5);

        if (floatingArea && yPos + height > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }

        if (theme === 'modern') {
          doc.setFillColor(...hexToRgb(groupColor || '#cbd5e1'));
          doc.roundedRect(currentX, yPos, 2, height, 1, 1, 'F');
          drawRichText(doc, content, currentX + 5, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth - 5, fontSize, 1.2, 'left', groupColor, 'bold', subColor, theme);
        } else if (theme === 'terminal') {
          doc.setDrawColor(245, 158, 11);
          doc.setLineWidth(0.3);
          doc.line(currentX, yPos + height + 1, currentX + 30, yPos + height + 1);
          drawRichText(doc, content.toUpperCase(), currentX, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.2, 'left', groupColor, 'bold', subColor, theme);
        } else if (theme === 'god-of-war') {
          doc.setDrawColor(139, 0, 0);
          doc.setLineWidth(0.5);
          doc.line(currentX, yPos + height + 1, currentX + currentMaxWidth, yPos + height + 1);
          drawRichText(doc, content.toUpperCase(), currentX, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.2, 'left', groupColor, 'bold', subColor, theme);
        } else if (theme === 'cuphead') {
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(1);
          doc.line(currentX, yPos + height + 1, currentX + currentMaxWidth, yPos + height + 1);
          drawRichText(doc, content.toUpperCase(), currentX, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.2, 'center', groupColor, 'bold', subColor, theme);
        } else if (theme === 'ethereal') {
          drawRichText(doc, content, currentX, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.2, 'left', groupColor, 'bold', subColor, theme);
        } else if (theme === 'cyberpunk') {
          doc.setDrawColor(6, 182, 212, 0.3);
          doc.setLineWidth(0.2);
          doc.line(currentX, yPos + height + 1, currentX + currentMaxWidth, yPos + height + 1);
          
          doc.setFillColor(...hexToRgb(groupColor || '#22d3ee'));
          doc.rect(currentX, yPos + 1, 3, 3, 'F');
          
          drawRichText(doc, content, currentX + 6, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth - 6, fontSize, 1.2, 'left', groupColor, 'bold', subColor, theme);
        } else if (theme === 'vintage') {
          doc.setDrawColor(212, 197, 161);
          doc.setLineWidth(0.2);
          doc.line(currentX, yPos + height + 1, currentX + currentMaxWidth, yPos + height + 1);
          drawRichText(doc, content, currentX, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.2, 'left', groupColor, 'bold', subColor, theme);
        } else if (theme === 'prism') {
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(currentX, yPos + height + 1, currentX + currentMaxWidth, yPos + height + 1);
          doc.setFillColor(168, 85, 247);
          doc.circle(currentX + 1.5, yPos + (fontSize * 0.3527) * 0.35, 1, 'F');
          drawRichText(doc, content, currentX + 5, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth - 5, fontSize, 1.2, 'left', groupColor, 'bold', subColor, theme);
        } else if (theme === 'minecraft') {
          doc.setDrawColor(55, 55, 55);
          doc.setLineWidth(1);
          doc.line(currentX, yPos + height + 1, currentX + currentMaxWidth, yPos + height + 1);
          drawRichText(doc, content.toUpperCase(), currentX, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.2, 'left', groupColor, 'bold', subColor, theme);
        } else if (theme === 'undertale') {
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.5);
          doc.line(currentX, yPos + height + 1, currentX + currentMaxWidth, yPos + height + 1);
          
          // Undertale heart icon
          doc.setTextColor(255, 0, 0);
          doc.setFont('courier', 'bold');
          doc.text('❤', currentX, yPos + (fontSize * 0.3527) * 0.7);
          
          drawRichText(doc, content.toUpperCase(), currentX + 6, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth - 6, fontSize, 1.2, 'left', groupColor, 'bold', subColor, theme);
        }
        
        yPos += height + 4;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'BULLET': {
        const fontSize = baseTextSize * scale;
        doc.setFontSize(fontSize);
        doc.setTextColor(...currentTheme.text);
        
        const tempDoc = new jsPDF();
        const height = drawRichText(tempDoc, content, 0, 0, currentMaxWidth - 10, fontSize, 1.2, 'left', groupColor, 'normal', currentTheme.text, theme);
        
        checkPageBreak(height + 2);

        if (floatingArea && yPos + height > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }

        let bulletChar = '•';
        if (theme === 'cyberpunk') bulletChar = '■';
        if (theme === 'vintage') bulletChar = '~';
        if (theme === 'terminal') bulletChar = '>';
        if (theme === 'ethereal') bulletChar = '○';
        if (theme === 'prism') bulletChar = '✦';
        if (theme === 'minecraft') bulletChar = '■';
        if (theme === 'undertale') bulletChar = '❤';
        if (theme === 'god-of-war') bulletChar = '⚔';
        if (theme === 'cuphead') bulletChar = '•';

        doc.setTextColor(...colorToRgb(groupColor));
        if (theme === 'undertale') doc.setTextColor(255, 0, 0);
        if (theme === 'god-of-war') doc.setTextColor(255, 215, 0);
        if (theme === 'cuphead') doc.setTextColor(0, 0, 0);
        
        doc.setFont(theme === 'vintage' || theme === 'ethereal' || theme === 'god-of-war' ? 'times' : (theme === 'cyberpunk' || theme === 'terminal' || theme === 'minecraft' || theme === 'undertale' ? 'courier' : 'helvetica'), 'bold');
        doc.text(bulletChar, currentX + 2, yPos + (fontSize * 0.3527) * 0.7);
        
        const renderedHeight = drawRichText(doc, content, currentX + 8, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth - 10, fontSize, 1.2, 'left', groupColor, 'normal', currentTheme.text, theme);
        yPos += renderedHeight + 2;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'WARNING':
      case 'TIP':
      case 'IMPORTANT': {
        const fontSize = baseTextSize * scale;
        doc.setFontSize(fontSize);
        const padding = 5;
        
        let bgColor = getShade(groupColor, 0.92);
        let borderColor = groupColor;
        let textColor: [number, number, number] = hexToRgb(getShade(groupColor, -0.6));

        if (type === 'TIP') {
          if (theme === 'cyberpunk') {
            bgColor = '#062016'; // emerald-950/20
            borderColor = '#10b981';
            textColor = [167, 243, 208]; // emerald-200
          } else if (theme === 'terminal') {
            bgColor = '#000000';
            borderColor = '#22c55e';
            textColor = [34, 197, 94];
          } else if (theme === 'ethereal') {
            bgColor = '#ecfdf5';
            borderColor = '#10b981';
            textColor = [6, 78, 59];
          } else if (theme === 'vintage') {
            bgColor = '#f0f9f0';
            borderColor = '#8fb38f';
            textColor = [45, 74, 45];
          } else if (theme === 'prism') {
            bgColor = '#ffffff';
            borderColor = '#e2e8f0';
            textColor = [5, 150, 105];
          } else if (theme === 'minecraft') {
            bgColor = '#c6c6c6';
            borderColor = '#373737';
            textColor = [55, 55, 55];
          } else if (theme === 'undertale') {
            bgColor = '#000000';
            borderColor = '#ffffff';
            textColor = [255, 255, 255];
          } else if (theme === 'god-of-war') {
            bgColor = '#1a1a1a';
            borderColor = '#ffd700';
            textColor = [255, 215, 0];
          } else if (theme === 'cuphead') {
            bgColor = '#f5f5dc';
            borderColor = '#000000';
            textColor = [0, 0, 0];
          } else {
            bgColor = groupColor ? getShade(groupColor, 0.92) : '#f0fdf4';
            borderColor = groupColor || '#22c55e';
          }
        } else if (type === 'IMPORTANT') {
          if (theme === 'cyberpunk') {
            bgColor = '#2d0a0a'; // red-950/30
            borderColor = '#ef4444';
            textColor = [254, 202, 202]; // red-200
          } else if (theme === 'terminal') {
            bgColor = '#ef4444';
            borderColor = '#000000';
            textColor = [0, 0, 0];
          } else if (theme === 'ethereal') {
            bgColor = '#eef2ff';
            borderColor = '#6366f1';
            textColor = [49, 46, 129];
          } else if (theme === 'vintage') {
            bgColor = '#fff5f5';
            borderColor = '#c0392b';
            textColor = [192, 57, 43];
          } else if (theme === 'prism') {
            bgColor = '#ffffff';
            borderColor = '#e2e8f0';
            textColor = [79, 70, 229];
          } else if (theme === 'minecraft') {
            bgColor = '#c6c6c6';
            borderColor = '#373737';
            textColor = [55, 55, 55];
          } else if (theme === 'undertale') {
            bgColor = '#000000';
            borderColor = '#ffffff';
            textColor = [255, 255, 255];
          } else if (theme === 'god-of-war') {
            bgColor = '#1a1a1a';
            borderColor = '#8b0000';
            textColor = [203, 213, 225];
          } else if (theme === 'cuphead') {
            bgColor = '#f5f5dc';
            borderColor = '#000000';
            textColor = [0, 0, 0];
          } else {
            bgColor = groupColor ? getShade(groupColor, 0.92) : '#fef2f2';
            borderColor = groupColor || '#ef4444';
          }
        } else { // WARNING
          if (theme === 'cyberpunk') {
            bgColor = '#2d0a0a';
            borderColor = '#ef4444';
            textColor = [254, 202, 202];
          } else if (theme === 'terminal') {
            bgColor = '#000000';
            borderColor = '#ef4444';
            textColor = [239, 68, 68];
          } else if (theme === 'ethereal') {
            bgColor = '#fff1f2';
            borderColor = '#f43f5e';
            textColor = [136, 19, 55];
          } else if (theme === 'vintage') {
            bgColor = '#fff9f0';
            borderColor = '#d4a373';
            textColor = [93, 64, 55];
          } else if (theme === 'prism') {
            bgColor = '#ffffff';
            borderColor = '#e2e8f0';
            textColor = [220, 38, 38];
          } else if (theme === 'minecraft') {
            bgColor = '#c6c6c6';
            borderColor = '#373737';
            textColor = [55, 55, 55];
          } else if (theme === 'undertale') {
            bgColor = '#000000';
            borderColor = '#ffffff';
            textColor = [255, 255, 255];
          } else if (theme === 'god-of-war') {
            bgColor = '#1a1a1a';
            borderColor = '#ffd700';
            textColor = [255, 215, 0];
          } else if (theme === 'cuphead') {
            bgColor = '#f5f5dc';
            borderColor = '#000000';
            textColor = [0, 0, 0];
          } else {
            bgColor = groupColor ? getShade(groupColor, 0.92) : '#fffbeb';
            borderColor = groupColor || '#facc15';
          }
        }

        const tempDoc = new jsPDF();
        const textHeight = drawRichText(tempDoc, content, 0, 0, currentMaxWidth - (padding * 2) - 10, fontSize, 1.2, 'left', groupColor, 'normal', textColor, theme);
        const height = textHeight + (padding * 2);
        
        checkPageBreak(height + 5);

        if (floatingArea && yPos + height > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }
        
        doc.setFillColor(...hexToRgb(bgColor));
        if (theme === 'modern') {
          doc.roundedRect(currentX, yPos, currentMaxWidth, height, 2, 2, 'F');
        } else {
          doc.rect(currentX, yPos, currentMaxWidth, height, 'F');
        }
        doc.setFillColor(...hexToRgb(borderColor));
        doc.rect(currentX, yPos, 1.5, height, 'F');
        
        if (theme === 'cyberpunk') {
          doc.rect(currentX + currentMaxWidth - 1.5, yPos, 1.5, height, 'F');
        } else if (theme === 'prism') {
          doc.roundedRect(currentX, yPos, currentMaxWidth, height, 3, 3, 'FD');
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.1);
          doc.roundedRect(currentX, yPos, currentMaxWidth, height, 3, 3, 'D');
          
          // Prism accent
          let accentColor: [number, number, number] = [99, 102, 241];
          if (type === 'TIP') accentColor = [16, 185, 129];
          else if (type === 'WARNING') accentColor = [239, 68, 68];
          
          doc.setFillColor(...accentColor);
          doc.rect(currentX, yPos + 2, 1.5, height - 4, 'F');
        } else if (theme === 'minecraft') {
          doc.rect(currentX, yPos, currentMaxWidth, height, 'FD');
          doc.setDrawColor(85, 85, 85);
          doc.setLineWidth(0.5);
          doc.line(currentX + 1, yPos + height - 0.5, currentX + currentMaxWidth - 1, yPos + height - 0.5);
          doc.line(currentX + currentMaxWidth - 0.5, yPos + 1, currentX + currentMaxWidth - 0.5, yPos + height - 1);
        } else if (theme === 'undertale') {
          doc.rect(currentX, yPos, currentMaxWidth, height, 'FD');
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.5);
          doc.rect(currentX, yPos, currentMaxWidth, height, 'D');
        } else if (theme === 'vintage') {
          doc.setDrawColor(...hexToRgb(borderColor));
          doc.setLineWidth(0.2);
          doc.rect(currentX, yPos, currentMaxWidth, height, 'D');
        }
        
        drawRichText(doc, content, currentX + padding + 5, yPos + padding + (fontSize * 0.3527) * 0.7, currentMaxWidth - (padding * 2) - 10, fontSize, 1.2, 'left', groupColor, 'normal', textColor, theme);
        yPos += height + 5;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'DEFINITION': {
        const fontSize = baseTextSize * scale;
        const colonIndex = content.indexOf(':');
        const term = colonIndex !== -1 ? content.substring(0, colonIndex).trim() : content;
        const definition = colonIndex !== -1 ? content.substring(colonIndex + 1).trim() : '';
        
        const richContent = `**${term}:** ${definition}`;
        
        let bgColor = getShade(groupColor, 0.98);
        let borderColor = getShade(groupColor, 0.85);
        let textColor = currentTheme.text;

        if (theme === 'cyberpunk') {
          bgColor = '#0a0a0f';
          borderColor = '#06b6d4';
          textColor = [6, 182, 212];
        } else if (theme === 'terminal') {
          bgColor = '#000000';
          borderColor = '#22c55e';
          textColor = [34, 197, 94];
        } else if (theme === 'ethereal') {
          bgColor = '#f5f3ff';
          borderColor = '#6366f1';
          textColor = [49, 46, 129];
        } else if (theme === 'vintage') {
          bgColor = '#fdfbf7';
          borderColor = '#d4c5a1';
          textColor = [74, 55, 40];
        } else if (theme === 'prism') {
          bgColor = '#ffffff';
          borderColor = '#e2e8f0';
          textColor = [15, 23, 42];
        } else if (theme === 'minecraft') {
          bgColor = '#c6c6c6';
          borderColor = '#373737';
          textColor = [55, 55, 55];
        } else if (theme === 'undertale') {
          bgColor = '#000000';
          borderColor = '#ffffff';
          textColor = [255, 255, 255];
        } else if (theme === 'god-of-war') {
          bgColor = '#1a1a1a';
          borderColor = '#ffd700';
          textColor = [203, 213, 225];
        } else if (theme === 'cuphead') {
          bgColor = '#f5f5dc';
          borderColor = '#000000';
          textColor = [0, 0, 0];
        }

        const tempDoc = new jsPDF();
        const height = drawRichText(tempDoc, richContent, 0, 0, currentMaxWidth - 12, fontSize, 1.2, 'left', groupColor, 'normal', textColor, theme);
        const boxHeight = height + 6;
        
        checkPageBreak(boxHeight + 4);

        if (floatingArea && yPos + boxHeight > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }
        
        doc.setFillColor(...hexToRgb(bgColor));
        doc.setDrawColor(...hexToRgb(borderColor));
        
        if (theme === 'cyberpunk') {
          doc.rect(currentX, yPos, currentMaxWidth, boxHeight, 'FD');
          doc.setFillColor(6, 182, 212);
          doc.rect(currentX, yPos, 2, boxHeight, 'F');
        } else if (theme === 'vintage') {
          doc.rect(currentX, yPos, currentMaxWidth, boxHeight, 'FD');
          doc.setDrawColor(212, 197, 161);
          doc.setLineWidth(0.1);
          doc.rect(currentX + 1, yPos + 1, currentMaxWidth - 2, boxHeight - 2, 'D');
        } else if (theme === 'prism') {
          doc.roundedRect(currentX, yPos, currentMaxWidth, boxHeight, 3, 3, 'FD');
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.1);
          doc.roundedRect(currentX, yPos, currentMaxWidth, boxHeight, 3, 3, 'D');
          
          // Prism gradient bar
          doc.setFillColor(99, 102, 241); // indigo-500
          doc.rect(currentX, yPos + 2, 1.5, boxHeight - 4, 'F');
        } else if (theme === 'minecraft') {
          doc.rect(currentX, yPos, currentMaxWidth, boxHeight, 'FD');
          doc.setDrawColor(85, 85, 85);
          doc.setLineWidth(0.5);
          doc.line(currentX + 1, yPos + boxHeight - 0.5, currentX + currentMaxWidth - 1, yPos + boxHeight - 0.5);
          doc.line(currentX + currentMaxWidth - 0.5, yPos + 1, currentX + currentMaxWidth - 0.5, yPos + boxHeight - 1);
        } else if (theme === 'undertale') {
          doc.rect(currentX, yPos, currentMaxWidth, boxHeight, 'FD');
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.5);
          doc.rect(currentX, yPos, currentMaxWidth, boxHeight, 'D');
        } else {
          doc.roundedRect(currentX, yPos, currentMaxWidth, boxHeight, 2, 2, 'FD');
        }
        
        drawRichText(doc, richContent, currentX + 6, yPos + 5, currentMaxWidth - 12, fontSize, 1.2, 'left', groupColor, 'normal', textColor, theme);
        
        yPos += boxHeight + 4;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'CODE': {
        const fontSize = (baseTextSize - 2) * scale;
        doc.setFontSize(fontSize);
        
        let fontName = 'courier';
        let textColor: [number, number, number] = hexToRgb(getShade(groupColor, 0.9));
        let bgColor = getShade(groupColor, -0.6);

        if (theme === 'cyberpunk') {
          textColor = [6, 182, 212];
          bgColor = '#000000';
        } else if (theme === 'terminal') {
          textColor = [34, 197, 94];
          bgColor = '#000000';
        } else if (theme === 'ethereal') {
          textColor = [49, 46, 129];
          bgColor = '#f8fafc';
          fontName = 'times';
        } else if (theme === 'vintage') {
          textColor = [74, 55, 40];
          bgColor = '#f4f1ea';
          fontName = 'times';
        } else if (theme === 'prism') {
          textColor = [71, 85, 105];
          bgColor = '#f8fafc';
          fontName = 'courier';
        } else if (theme === 'minecraft') {
          textColor = [255, 255, 255];
          bgColor = '#373737';
          fontName = 'courier';
        } else if (theme === 'undertale') {
          textColor = [255, 255, 255];
          bgColor = '#000000';
          fontName = 'courier';
        } else if (theme === 'god-of-war') {
          textColor = [203, 213, 225];
          bgColor = '#1a1a1a';
          fontName = 'times';
        } else if (theme === 'cuphead') {
          textColor = [0, 0, 0];
          bgColor = '#ffffff';
          fontName = 'helvetica';
        }

        doc.setFont(fontName, 'normal');
        const strippedContent = stripMemoryLinks(content.replace(/\[([^\]]+)\]\{([^}]+)\}/g, '$1'));
        const lines = doc.splitTextToSize(strippedContent, currentMaxWidth - 10);
        const height = lines.length * (fontSize * 0.3527) * 1.2 + 8;
        checkPageBreak(height + 4);

        if (floatingArea && yPos + height > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }
        
        doc.setFillColor(...hexToRgb(bgColor));
        if (theme === 'modern') {
          doc.roundedRect(currentX, yPos, currentMaxWidth, height, 2, 2, 'F');
        } else {
          doc.rect(currentX, yPos, currentMaxWidth, height, 'F');
        }
        
        if (theme === 'cyberpunk') {
          doc.setDrawColor(6, 182, 212, 0.5);
          doc.setLineWidth(0.2);
          doc.rect(currentX, yPos, currentMaxWidth, height, 'D');
        } else if (theme === 'vintage') {
          doc.setDrawColor(212, 197, 161);
          doc.setLineWidth(0.1);
          doc.rect(currentX, yPos, currentMaxWidth, height, 'D');
        } else if (theme === 'prism') {
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.1);
          doc.rect(currentX, yPos, currentMaxWidth, height, 'D');
        } else if (theme === 'minecraft') {
          doc.setDrawColor(85, 85, 85);
          doc.setLineWidth(1);
          doc.rect(currentX, yPos, currentMaxWidth, height, 'D');
        } else if (theme === 'undertale') {
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(1);
          doc.rect(currentX, yPos, currentMaxWidth, height, 'D');
        }

        doc.setTextColor(...textColor);
        doc.text(lines, currentX + 5, yPos + 6);
        yPos += height + 4;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'QUOTE': {
        const fontSize = baseTextSize * scale;
        doc.setFontSize(fontSize);
        
        let bgColor = getShade(groupColor, 0.95);
        let barColor = hexToRgb(groupColor);
        let textColor: [number, number, number] = [71, 85, 105];

        if (theme === 'cyberpunk') {
          bgColor = '#1a0a1e'; // purple-900/10
          barColor = [168, 85, 247];
          textColor = [232, 121, 249]; // purple-200
        } else if (theme === 'terminal') {
          bgColor = '#22c55e';
          barColor = [0, 0, 0];
          textColor = [0, 0, 0];
        } else if (theme === 'ethereal') {
          bgColor = '#ffffff';
          barColor = [99, 102, 241];
          textColor = [49, 46, 129];
        } else if (theme === 'minecraft') {
          bgColor = '#c6c6c6';
          barColor = [55, 55, 55];
          textColor = [55, 55, 55];
        } else if (theme === 'undertale') {
          bgColor = '#000000';
          barColor = [255, 255, 255];
          textColor = [255, 255, 255];
        } else if (theme === 'god-of-war') {
          bgColor = '#1a1a1a';
          barColor = [139, 0, 0];
          textColor = [203, 213, 225];
        } else if (theme === 'cuphead') {
          bgColor = '#f5f5dc';
          barColor = [0, 0, 0];
          textColor = [0, 0, 0];
        } else if (theme === 'vintage') {
          bgColor = '#fdfbf7';
          barColor = [139, 69, 19];
          textColor = [93, 64, 55];
        } else if (theme === 'prism') {
          bgColor = '#ffffff';
          barColor = [168, 85, 247]; // purple-500
          textColor = [71, 85, 105];
        } else if (theme === 'modern') {
          bgColor = groupColor ? getShade(groupColor, 0.98) : '#f8fafc';
          barColor = hexToRgb(groupColor ? getShade(groupColor, 0.9) : '#e2e8f0');
        }

        const tempDoc = new jsPDF();
        const textHeight = drawRichText(tempDoc, content, 0, 0, currentMaxWidth - 15, fontSize, 1.2, 'left', groupColor, 'italic', textColor, theme);
        const height = textHeight + 4;
        
        checkPageBreak(height + 4);

        if (floatingArea && yPos + height > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }
        
        doc.setFillColor(...hexToRgb(bgColor));
        if (theme === 'modern') {
          doc.roundedRect(currentX, yPos, currentMaxWidth, height, 2, 2, 'F');
        } else {
          doc.rect(currentX, yPos, currentMaxWidth, height, 'F');
        }
        doc.setFillColor(...barColor);
        doc.rect(currentX + 2, yPos, 1, height, 'F');
        
        if (theme === 'vintage') {
          doc.setDrawColor(139, 69, 19);
          doc.setLineWidth(0.2);
          doc.line(currentX, yPos, currentX + currentMaxWidth, yPos);
          doc.line(currentX, yPos + height, currentX + currentMaxWidth, yPos + height);
          doc.line(currentX + currentMaxWidth, yPos, currentX + currentMaxWidth, yPos + height);
        }

        drawRichText(doc, content, currentX + 8, yPos + 5, currentMaxWidth - 15, fontSize, 1.2, 'left', groupColor, 'italic', textColor, theme);
        yPos += height + 4;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'CHECKLIST': {
        const fontSize = baseTextSize * scale;
        doc.setFontSize(fontSize);
        doc.setTextColor(...currentTheme.text);
        
        const tempDoc = new jsPDF();
        const height = drawRichText(tempDoc, content, 0, 0, currentMaxWidth - 10, fontSize, 1.2, 'left', groupColor, 'normal', currentTheme.text, theme);
        
        checkPageBreak(height + 2);

        if (floatingArea && yPos + height > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }
        
        doc.setDrawColor(...currentTheme.accent);
        doc.setLineWidth(0.3);
        
        if (theme === 'cyberpunk') {
          doc.setFillColor(6, 182, 212, 0.1);
          doc.rect(currentX, yPos + 1, 4, 4, 'FD');
          doc.setDrawColor(6, 182, 212);
          doc.setLineWidth(0.5);
          doc.rect(currentX, yPos + 1, 4, 4, 'D');
        } else if (theme === 'terminal') {
          doc.setDrawColor(34, 197, 94);
          doc.setLineWidth(0.5);
          doc.rect(currentX, yPos + 1, 4, 4, 'D');
        } else if (theme === 'ethereal') {
          doc.setFillColor(238, 242, 255);
          doc.circle(currentX + 2, yPos + 3, 2, 'F');
          doc.setDrawColor(99, 102, 241);
          doc.setLineWidth(0.2);
          doc.circle(currentX + 2, yPos + 3, 2, 'D');
        } else if (theme === 'vintage') {
          doc.setDrawColor(139, 69, 19);
          doc.rect(currentX, yPos + 1, 4, 4, 'D');
        } else if (theme === 'prism') {
          doc.setDrawColor(168, 85, 247);
          doc.setLineWidth(0.4);
          doc.roundedRect(currentX, yPos + 1, 4, 4, 1, 1, 'D');
        } else if (theme === 'modern') {
          doc.setDrawColor(...hexToRgb(groupColor ? getShade(groupColor, 0.8) : '#cbd5e1'));
          doc.setLineWidth(0.2);
          doc.roundedRect(currentX, yPos + 1, 4, 4, 1, 1, 'D');
        } else if (theme === 'god-of-war') {
          doc.setDrawColor(255, 215, 0);
          doc.setLineWidth(0.5);
          doc.rect(currentX, yPos + 1, 4, 4, 'D');
        } else if (theme === 'cuphead') {
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(1);
          doc.rect(currentX, yPos + 1, 4, 4, 'D');
        } else {
          doc.rect(currentX, yPos + 1, 4, 4);
        }
        
        const renderedHeight = drawRichText(doc, content, currentX + 8, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth - 10, fontSize, 1.2, 'left', groupColor, 'normal', currentTheme.text, theme);
        yPos += renderedHeight + 2;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'EXAMPLE': {
        const fontSize = baseTextSize * scale;
        doc.setFontSize(fontSize);
        const padding = 5;
        
        let bgColor = getShade(groupColor, 0.98);
        let barColor: [number, number, number] = hexToRgb(groupColor);
        let textColor: [number, number, number] = [71, 85, 105];
        let labelColor: [number, number, number] = hexToRgb(getShade(groupColor, -0.4));

        if (theme === 'cyberpunk') {
          bgColor = '#061a10'; // emerald-950/10
          barColor = [16, 185, 129];
          textColor = [209, 250, 229]; // emerald-50
          labelColor = [52, 211, 153]; // emerald-400
        } else if (theme === 'terminal') {
          bgColor = '#000000';
          barColor = [245, 158, 11];
          textColor = [245, 158, 11];
          labelColor = [245, 158, 11];
        } else if (theme === 'ethereal') {
          bgColor = '#fffbeb';
          barColor = [251, 191, 36];
          textColor = [120, 53, 15];
          labelColor = [180, 83, 9];
        } else if (theme === 'vintage') {
          bgColor = '#fdfbf7';
          barColor = [212, 197, 161];
          textColor = [93, 64, 55];
          labelColor = [139, 69, 19];
        } else if (theme === 'prism') {
          bgColor = '#ffffff';
          barColor = [99, 102, 241];
          textColor = [71, 85, 105];
          labelColor = [79, 70, 229];
        } else if (theme === 'god-of-war') {
          bgColor = '#1a1a1a';
          barColor = [255, 215, 0];
          textColor = [203, 213, 225];
          labelColor = [255, 215, 0];
        } else if (theme === 'cuphead') {
          bgColor = '#f5f5dc';
          barColor = [0, 0, 0];
          textColor = [0, 0, 0];
          labelColor = [0, 0, 0];
        } else if (theme === 'modern') {
          bgColor = groupColor ? getShade(groupColor, 0.98) : '#f8fafc';
          barColor = hexToRgb(groupColor ? getShade(groupColor, 0.9) : '#e2e8f0');
        }

        const tempDoc = new jsPDF();
        const textHeight = drawRichText(tempDoc, content, 0, 0, currentMaxWidth - (padding * 2) - 5, fontSize, 1.2, 'left', groupColor, 'normal', textColor, theme);
        const height = textHeight + (padding * 2) + 5;
        
        checkPageBreak(height + 5);

        if (floatingArea && yPos + height > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }
        
        doc.setFillColor(...hexToRgb(bgColor));
        if (theme === 'modern') {
          doc.setDrawColor(...barColor);
          doc.setLineWidth(0.1);
          doc.roundedRect(currentX, yPos, currentMaxWidth, height, 2, 2, 'FD');
        } else {
          doc.rect(currentX, yPos, currentMaxWidth, height, 'F');
          doc.setFillColor(...barColor);
          doc.rect(currentX, yPos, 1.5, height, 'F');
        }
        
        if (theme === 'vintage') {
          doc.setDrawColor(212, 197, 161);
          doc.setLineWidth(0.2);
          doc.setLineDashPattern([2, 2], 0);
          doc.rect(currentX, yPos, currentMaxWidth, height, 'D');
          doc.setLineDashPattern([], 0);
        }

        doc.setFontSize(8);
        doc.setTextColor(...labelColor);
        doc.setFont(theme === 'vintage' ? 'times' : (theme === 'cyberpunk' ? 'courier' : 'helvetica'), 'bold');
        doc.text('EXAMPLE', currentX + padding + 5, yPos + 4);
        
        drawRichText(doc, content, currentX + padding + 5, yPos + padding + 7, currentMaxWidth - (padding * 2) - 5, fontSize, 1.2, 'left', groupColor, 'normal', textColor, theme);
        yPos += height + 5;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'FORMULA': {
        const fontSize = (baseTextSize + 4) * scale;
        doc.setFontSize(fontSize);
        
        let textColor = currentTheme.text;
        if (theme === 'cyberpunk') textColor = [6, 182, 212];
        if (theme === 'vintage') textColor = [44, 30, 20];

        const tempDoc = new jsPDF();
        const height = drawRichText(tempDoc, content, 0, 0, currentMaxWidth - 20, fontSize, 1.4, 'center', groupColor, 'normal', textColor, theme);
        const boxHeight = height + 10;
        
        checkPageBreak(boxHeight + 6);

        if (floatingArea && yPos + boxHeight > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }
        
        if (theme === 'cyberpunk') {
          doc.setFillColor(0, 0, 0);
          doc.setDrawColor(6, 182, 212);
          doc.setLineWidth(0.5);
          doc.rect(currentX + 10, yPos, currentMaxWidth - 20, boxHeight, 'FD');
        } else if (theme === 'terminal') {
          doc.setFillColor(0, 0, 0);
          doc.setDrawColor(34, 197, 94);
          doc.setLineWidth(0.5);
          doc.rect(currentX + 10, yPos, currentMaxWidth - 20, boxHeight, 'FD');
        } else if (theme === 'ethereal') {
          doc.setFillColor(238, 242, 255, 0.2);
          doc.setDrawColor(99, 102, 241, 0.2);
          doc.setLineWidth(0.1);
          doc.roundedRect(currentX + 10, yPos, currentMaxWidth - 20, boxHeight, 10, 10, 'FD');
        } else if (theme === 'vintage') {
          doc.setFillColor(253, 251, 247);
          doc.setDrawColor(212, 197, 161);
          doc.setLineWidth(0.2);
          doc.rect(currentX + 10, yPos, currentMaxWidth - 20, boxHeight, 'FD');
        } else if (theme === 'prism') {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.1);
          doc.roundedRect(currentX + 10, yPos, currentMaxWidth - 20, boxHeight, 4, 4, 'FD');
          
          // Prism accent for formula
          doc.setFillColor(236, 72, 153); // pink-500
          doc.circle(currentX + 15, yPos + 5, 1, 'F');
          doc.setFillColor(168, 85, 247); // purple-500
          doc.circle(currentX + currentMaxWidth - 15, yPos + boxHeight - 5, 1, 'F');
        } else if (theme === 'modern') {
          doc.setFillColor(...hexToRgb(groupColor ? getShade(groupColor, 0.96) : '#eff6ff'));
          doc.setDrawColor(...hexToRgb(groupColor ? getShade(groupColor, 0.9) : '#dbeafe'));
          doc.setLineWidth(0.2);
          doc.roundedRect(currentX + 10, yPos, currentMaxWidth - 20, boxHeight, 2, 2, 'FD');
        } else if (theme === 'god-of-war') {
          doc.setFillColor(26, 26, 26);
          doc.setDrawColor(255, 215, 0);
          doc.setLineWidth(0.5);
          doc.rect(currentX + 10, yPos, currentMaxWidth - 20, boxHeight, 'FD');
        } else if (theme === 'cuphead') {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(1.5);
          doc.rect(currentX + 10, yPos, currentMaxWidth - 20, boxHeight, 'FD');
        } else {
          doc.setDrawColor(...hexToRgb(getShade(groupColor, 0.85)));
          doc.setLineWidth(0.2);
          doc.roundedRect(currentX + 10, yPos, currentMaxWidth - 20, boxHeight, 2, 2, 'S');
        }
        
        drawRichText(doc, content, currentX + 10, yPos + 5 + (fontSize * 0.3527) * 0.7, currentMaxWidth - 20, fontSize, 1.4, 'center', groupColor, 'normal', textColor, theme);
        yPos += boxHeight + 6;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'EXPLANATION': {
        const fontSize = baseTextSize * scale;
        const textColor = currentTheme.text;
        
        let themeFont = currentFontName;
        if (theme === 'cyberpunk' && currentFontName === 'helvetica') themeFont = 'courier';
        if (theme === 'vintage' && currentFontName === 'helvetica') themeFont = 'times';
        if (theme === 'terminal' && currentFontName === 'helvetica') themeFont = 'courier';
        if (theme === 'ethereal' && currentFontName === 'helvetica') themeFont = 'times';
        if (theme === 'prism' && currentFontName === 'helvetica') themeFont = 'helvetica';
        if (theme === 'minecraft' && currentFontName === 'helvetica') themeFont = 'courier';
        if (theme === 'undertale' && currentFontName === 'helvetica') themeFont = 'courier';
        if (theme === 'god-of-war' && currentFontName === 'helvetica') themeFont = 'times';
        if (theme === 'cuphead' && currentFontName === 'helvetica') themeFont = 'helvetica';

        const tempDoc = new jsPDF();
        const height = drawRichText(tempDoc, content, 0, 0, currentMaxWidth, fontSize, 1.5, 'left', groupColor, 'normal', textColor, theme);
        
        checkPageBreak(height + 2);
        drawRichText(doc, content, currentX, yPos, currentMaxWidth, fontSize, 1.5, 'left', groupColor, 'normal', textColor, theme);
        yPos += height + 4;

        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'CALLOUT': {
        const fontSize = baseTextSize * scale;
        doc.setFontSize(fontSize);
        const padding = 5;
        
        let bgColor = getShade(groupColor, 0.95);
        let borderColor = getShade(groupColor, 0.8);
        let textColor: [number, number, number] = [30, 41, 59];
        let labelColor: [number, number, number] = hexToRgb(groupColor);

        if (theme === 'cyberpunk') {
          bgColor = '#1a0a2e'; // purple-950/20
          borderColor = '#a855f7';
          textColor = [243, 232, 255]; // purple-100
          labelColor = [168, 85, 247];
        } else if (theme === 'terminal') {
          bgColor = '#000000';
          borderColor = '#22c55e';
          textColor = [34, 197, 94];
          labelColor = [34, 197, 94];
        } else if (theme === 'ethereal') {
          bgColor = '#f5f3ff';
          borderColor = '#6366f1';
          textColor = [49, 46, 129];
          labelColor = [99, 102, 241];
        } else if (theme === 'vintage') {
          bgColor = '#fdfbf7';
          borderColor = '#d4c5a1';
          textColor = [74, 55, 40];
          labelColor = [93, 64, 55];
        } else if (theme === 'prism') {
          bgColor = '#ffffff';
          borderColor = '#e2e8f0';
          textColor = [15, 23, 42];
          labelColor = [99, 102, 241];
        } else if (theme === 'god-of-war') {
          bgColor = '#1a1a1a';
          borderColor = '#ffd700';
          textColor = [203, 213, 225];
          labelColor = [255, 215, 0];
        } else if (theme === 'cuphead') {
          bgColor = '#f5f5dc';
          borderColor = '#000000';
          textColor = [0, 0, 0];
          labelColor = [0, 0, 0];
        } else if (theme === 'modern') {
          bgColor = groupColor ? getShade(groupColor, 0.92) : '#faf5ff';
          borderColor = groupColor || '#a855f7';
        }

        const tempDoc = new jsPDF();
        const textHeight = drawRichText(tempDoc, content, 0, 0, currentMaxWidth - (padding * 2), fontSize, 1.2, 'left', groupColor, 'normal', textColor, theme);
        const height = textHeight + (padding * 2) + 6;
        
        checkPageBreak(height + 5);

        if (floatingArea && yPos + height > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }
        
        doc.setFillColor(...hexToRgb(bgColor));
        if (theme === 'modern') {
          doc.roundedRect(currentX, yPos, currentMaxWidth, height, 2, 2, 'F');
          doc.setFillColor(...hexToRgb(borderColor));
          doc.rect(currentX, yPos, 1.5, height, 'F');
        } else {
          doc.setDrawColor(...hexToRgb(borderColor));
          doc.roundedRect(currentX, yPos, currentMaxWidth, height, theme === 'ethereal' ? 2 : 0, theme === 'ethereal' ? 2 : 0, 'FD');
        }
        
        if (theme === 'cyberpunk') {
          doc.setFillColor(...hexToRgb(borderColor));
          doc.rect(currentX + currentMaxWidth - 1.5, yPos, 1.5, height, 'F');
        } else if (theme === 'prism') {
          // Prism vertical gradient simulation
          doc.setFillColor(99, 102, 241); // indigo
          doc.rect(currentX, yPos, 1.5, height / 3, 'F');
          doc.setFillColor(168, 85, 247); // purple
          doc.rect(currentX, yPos + height / 3, 1.5, height / 3, 'F');
          doc.setFillColor(236, 72, 153); // pink
          doc.rect(currentX, yPos + (2 * height) / 3, 1.5, height / 3, 'F');
        }

        doc.setFontSize(8);
        doc.setTextColor(...labelColor);
        doc.setFont(theme === 'vintage' ? 'times' : (theme === 'cyberpunk' ? 'courier' : 'helvetica'), 'bold');
        doc.text('NOTE', currentX + padding, yPos + 4);
        
        drawRichText(doc, content, currentX + padding, yPos + padding + 7, currentMaxWidth - (padding * 2), fontSize, 1.2, 'left', groupColor, 'normal', textColor, theme);
        yPos += height + 5;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'CONCEPT':
      case 'MNEMONIC':
      case 'KEY_POINT':
      case 'SUMMARY': {
        const fontSize = baseTextSize * scale;
        doc.setFontSize(fontSize);
        const padding = 5;
        
        let bgColor = getShade(groupColor, 0.92);
        let borderColor = groupColor;
        let textColor: [number, number, number] = [30, 41, 59];

        if (type === 'CONCEPT') {
          bgColor = groupColor ? getShade(groupColor, 0.92) : '#f0f9ff';
          borderColor = groupColor || '#3b82f6';
        } else if (type === 'MNEMONIC') {
          bgColor = groupColor ? getShade(groupColor, 0.92) : '#eef2ff';
          borderColor = groupColor || '#6366f1';
        } else if (type === 'KEY_POINT') {
          bgColor = groupColor ? getShade(groupColor, 0.92) : '#fffbeb';
          borderColor = groupColor || '#f59e0b';
        } else if (type === 'SUMMARY') {
          bgColor = groupColor ? getShade(groupColor, 0.92) : '#f8fafc';
          borderColor = groupColor || '#64748b';
        }

        if (theme === 'cyberpunk') {
          textColor = [255, 255, 255];
          if (type === 'CONCEPT') {
            bgColor = '#082f49'; // cyan-950
            borderColor = '#06b6d4';
            textColor = [164, 245, 255];
          } else if (type === 'MNEMONIC') {
            bgColor = '#1e1b4b'; // indigo-950
            borderColor = '#6366f1';
            textColor = [224, 231, 255];
          } else if (type === 'KEY_POINT') {
            bgColor = '#451a03'; // amber-950
            borderColor = '#f59e0b';
            textColor = [254, 243, 199];
          } else if (type === 'SUMMARY') {
            bgColor = '#0f172a'; // slate-900
            borderColor = '#64748b';
            textColor = [241, 245, 249];
          }
        } else if (theme === 'terminal') {
          bgColor = '#000000';
          borderColor = '#22c55e';
          textColor = [34, 197, 94];
        } else if (theme === 'ethereal') {
          textColor = [49, 46, 129];
          if (type === 'CONCEPT') {
            bgColor = '#f0f9ff';
            borderColor = '#0ea5e9';
          } else if (type === 'MNEMONIC') {
            bgColor = '#eef2ff';
            borderColor = '#6366f1';
          } else if (type === 'KEY_POINT') {
            bgColor = '#fffbeb';
            borderColor = '#f59e0b';
          } else if (type === 'SUMMARY') {
            bgColor = '#f8fafc';
            borderColor = '#64748b';
          }
        } else if (theme === 'vintage') {
          bgColor = '#fdfbf7';
          borderColor = '#d4c5a1';
          textColor = [74, 55, 40];
          
          if (type === 'CONCEPT') bgColor = '#f0f7ff';
          else if (type === 'MNEMONIC') bgColor = '#f5f3ff';
          else if (type === 'KEY_POINT') bgColor = '#fffbeb';
          else if (type === 'SUMMARY') bgColor = '#f8fafc';
        } else if (theme === 'prism') {
          bgColor = '#ffffff';
          borderColor = '#e2e8f0';
          textColor = [15, 23, 42];
          
          if (type === 'CONCEPT') borderColor = '#0ea5e9';
          else if (type === 'MNEMONIC') borderColor = '#6366f1';
          else if (type === 'KEY_POINT') borderColor = '#f59e0b';
          else if (type === 'SUMMARY') borderColor = '#64748b';
        } else if (theme === 'god-of-war') {
          bgColor = '#1a1a1a';
          borderColor = '#ffd700';
          textColor = [203, 213, 225];
        } else if (theme === 'cuphead') {
          bgColor = '#f5f5dc';
          borderColor = '#000000';
          textColor = [0, 0, 0];
        }

        const tempDoc = new jsPDF();
        const textHeight = drawRichText(tempDoc, content, 0, 0, currentMaxWidth - (padding * 2) - 10, fontSize, 1.2, 'left', groupColor, 'normal', textColor, theme);
        const height = textHeight + (padding * 2);
        
        checkPageBreak(height + 5);

        if (floatingArea && yPos + height > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }
        
        doc.setFillColor(...hexToRgb(bgColor));
        if (theme === 'modern') {
          doc.roundedRect(currentX, yPos, currentMaxWidth, height, 2, 2, 'F');
        } else {
          doc.rect(currentX, yPos, currentMaxWidth, height, 'F');
        }
        doc.setFillColor(...hexToRgb(borderColor));
        doc.rect(currentX, yPos, 1.5, height, 'F');
        
        if (theme === 'cyberpunk') {
          doc.rect(currentX + currentMaxWidth - 1.5, yPos, 1.5, height, 'F');
        } else if (theme === 'prism') {
          // Prism vertical gradient simulation
          doc.setFillColor(99, 102, 241); // indigo
          doc.rect(currentX, yPos, 1.5, height / 3, 'F');
          doc.setFillColor(168, 85, 247); // purple
          doc.rect(currentX, yPos + height / 3, 1.5, height / 3, 'F');
          doc.setFillColor(236, 72, 153); // pink
          doc.rect(currentX, yPos + (2 * height) / 3, 1.5, height / 3, 'F');
        } else if (theme === 'vintage') {
          doc.setDrawColor(...hexToRgb(borderColor));
          doc.setLineWidth(0.2);
          doc.rect(currentX, yPos, currentMaxWidth, height, 'D');
        }
        
        drawRichText(doc, content, currentX + padding + 5, yPos + padding + (fontSize * 0.3527) * 0.7, currentMaxWidth - (padding * 2) - 10, fontSize, 1.2, 'left', groupColor, 'normal', textColor, theme);
        yPos += height + 5;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'STEP': {
        const fontSize = baseTextSize * scale;
        doc.setFontSize(fontSize);
        doc.setTextColor(...currentTheme.text);
        
        const tempDoc = new jsPDF();
        const height = drawRichText(tempDoc, content, 0, 0, currentMaxWidth - 12, fontSize, 1.2, 'left', groupColor, 'normal', currentTheme.text, theme);
        
        checkPageBreak(height + 3);

        if (floatingArea && yPos + height > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }
        
        if (theme === 'cyberpunk') {
          doc.setFillColor(...hexToRgb(groupColor || '#06b6d4'));
          doc.rect(currentX, yPos + 1, 6, 6, 'F');
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(6);
          doc.setFont('courier', 'bold');
          doc.text('>', currentX + 2, yPos + 5.5);
        } else if (theme === 'terminal') {
          doc.setFillColor(0, 0, 0);
          doc.setDrawColor(34, 197, 94);
          doc.setLineWidth(0.5);
          doc.rect(currentX, yPos + 1, 6, 6, 'FD');
          doc.setTextColor(34, 197, 94);
          doc.setFontSize(6);
          doc.setFont('courier', 'bold');
          doc.text('>', currentX + 2, yPos + 5.5);
        } else if (theme === 'ethereal') {
          doc.setFillColor(238, 242, 255);
          doc.circle(currentX + 3, yPos + (fontSize * 0.3527) * 0.4, 2.5, 'F');
          doc.setTextColor(99, 102, 241);
          doc.setFontSize(6);
          doc.setFont('times', 'bold');
          doc.text('>', currentX + 2.2, yPos + (fontSize * 0.3527) * 0.4 + 0.8);
        } else if (theme === 'vintage') {
          doc.setDrawColor(139, 69, 19); // #8b4513
          doc.setLineWidth(0.5);
          doc.line(currentX, yPos + (fontSize * 0.3527) * 0.8, currentX + 6, yPos + (fontSize * 0.3527) * 0.8);
        } else if (theme === 'prism') {
          doc.setFillColor(168, 85, 247);
          doc.roundedRect(currentX, yPos + 1, 6, 6, 1.5, 1.5, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.text('>', currentX + 2.2, yPos + 5.5);
        } else if (theme === 'modern') {
          doc.setFillColor(...hexToRgb(groupColor ? getShade(groupColor, 0.9) : '#f1f5f9'));
          doc.roundedRect(currentX, yPos + 1, 6, 6, 1.5, 1.5, 'F');
          doc.setTextColor(...hexToRgb(groupColor ? getShade(groupColor, 0.4) : '#475569'));
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.text('>', currentX + 2.2, yPos + 5.5);
        } else {
          doc.setFillColor(...hexToRgb(groupColor || '#3b82f6'));
          doc.circle(currentX + 3, yPos + (fontSize * 0.3527) * 0.4, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.text('>', currentX + 2.2, yPos + (fontSize * 0.3527) * 0.4 + 0.8);
        }
        
        const renderedHeight = drawRichText(doc, content, currentX + 10, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth - 12, fontSize, 1.2, 'left', groupColor, 'normal', currentTheme.text, theme);
        yPos += renderedHeight + 3;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'TIMELINE': {
        const fontSize = baseTextSize * scale;
        const pipeIndex = content.indexOf('|');
        const time = pipeIndex !== -1 ? content.substring(0, pipeIndex).trim() : 'Date';
        const event = pipeIndex !== -1 ? content.substring(pipeIndex + 1).trim() : content;
        
        const leftColWidth = 35;
        const rightColWidth = currentMaxWidth - leftColWidth - 5;
        let timeColor = hexToRgb(getShade(groupColor, -0.2));
        if (theme === 'cyberpunk') timeColor = [168, 85, 247]; // purple-500
        if (theme === 'terminal') timeColor = [34, 197, 94];
        if (theme === 'ethereal') timeColor = [99, 102, 241];
        if (theme === 'vintage') timeColor = [139, 69, 19]; // #8b4513
        if (theme === 'prism') timeColor = [79, 70, 229];
        
        const tempDoc = new jsPDF();
        const eventHeight = drawRichText(tempDoc, event, 0, 0, rightColWidth, fontSize, 1.2, 'left', groupColor, 'normal', currentTheme.text, theme);
        const timeHeight = drawRichText(tempDoc, time, 0, 0, leftColWidth - 2, fontSize, 1.2, 'right', groupColor, 'bold', timeColor, theme);
        const height = Math.max(eventHeight, timeHeight, 10);
        
        checkPageBreak(height + 4);

        if (floatingArea && yPos + height > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }
        
        // Draw vertical line
        let lineColor = hexToRgb(getShade(groupColor, 0.8));
        if (theme === 'cyberpunk') lineColor = [168, 85, 247]; // purple-500
        if (theme === 'terminal') lineColor = [21, 128, 61]; // green-700
        if (theme === 'ethereal') lineColor = [224, 231, 255]; // indigo-100
        if (theme === 'vintage') lineColor = [212, 197, 161];
        if (theme === 'prism') lineColor = [226, 232, 240];
        
        doc.setDrawColor(...lineColor);
        doc.setLineWidth(0.5);
        doc.line(currentX + leftColWidth, yPos, currentX + leftColWidth, yPos + height + 4);
        
        // Draw dot
        doc.setFillColor(...hexToRgb(groupColor || (theme === 'cyberpunk' ? '#a855f7' : (theme === 'terminal' ? '#22c55e' : (theme === 'ethereal' ? '#6366f1' : '#8b4513')))));
        if (theme === 'cyberpunk') {
          doc.rect(currentX + leftColWidth - 1.5, yPos + 4, 3, 3, 'F');
          doc.setDrawColor(168, 85, 247);
          doc.setLineWidth(0.2);
          doc.rect(currentX + leftColWidth - 1.5, yPos + 4, 3, 3, 'D');
        } else if (theme === 'terminal') {
          doc.rect(currentX + leftColWidth - 1.5, yPos + 4, 3, 3, 'F');
          doc.setDrawColor(34, 197, 94);
          doc.setLineWidth(0.2);
          doc.rect(currentX + leftColWidth - 1.5, yPos + 4, 3, 3, 'D');
        } else if (theme === 'ethereal') {
          doc.circle(currentX + leftColWidth, yPos + 5.5, 2, 'F');
          doc.setDrawColor(199, 210, 254);
          doc.setLineWidth(0.1);
          doc.circle(currentX + leftColWidth, yPos + 5.5, 2, 'D');
        } else if (theme === 'vintage') {
          doc.rect(currentX + leftColWidth - 1, yPos + 4.5, 2, 2, 'F');
        } else if (theme === 'prism') {
          doc.setFillColor(168, 85, 247);
          doc.roundedRect(currentX + leftColWidth - 1.5, yPos + 4, 3, 3, 1, 1, 'F');
        } else if (theme === 'modern') {
          doc.setFillColor(255, 255, 255);
          doc.circle(currentX + leftColWidth, yPos + 5.5, 2, 'F');
          doc.setDrawColor(...hexToRgb(groupColor ? getShade(groupColor, 0.4) : '#cbd5e1'));
          doc.setLineWidth(0.6);
          doc.circle(currentX + leftColWidth, yPos + 5.5, 2, 'D');
        } else {
          doc.circle(currentX + leftColWidth, yPos + 5.5, 1.5, 'F');
        }
        
        drawRichText(doc, time, currentX, yPos + 5, leftColWidth - 4, fontSize, 1.2, 'right', groupColor, 'bold', timeColor, theme);
        
        // Draw event box for themes
        if (theme !== 'modern') {
          let boxBg: [number, number, number] = theme === 'cyberpunk' ? [24, 10, 30] : (theme === 'terminal' ? [0, 0, 0] : (theme === 'ethereal' ? [255, 255, 255] : [253, 251, 247]));
          doc.setFillColor(...boxBg);
          if (theme === 'vintage') {
            doc.setDrawColor(212, 197, 161);
            doc.setLineWidth(0.1);
            doc.rect(currentX + leftColWidth + 3, yPos + 1, rightColWidth + 2, height + 2, 'FD');
          } else if (theme === 'terminal') {
            doc.setDrawColor(21, 128, 61);
            doc.setLineWidth(0.1);
            doc.rect(currentX + leftColWidth + 3, yPos + 1, rightColWidth + 2, height + 2, 'FD');
          } else if (theme === 'ethereal') {
            doc.setDrawColor(238, 242, 255);
            doc.setLineWidth(0.1);
            doc.roundedRect(currentX + leftColWidth + 3, yPos + 1, rightColWidth + 2, height + 2, 2, 2, 'FD');
          } else if (theme === 'prism') {
            doc.setDrawColor(241, 245, 249);
            doc.setLineWidth(0.1);
            doc.roundedRect(currentX + leftColWidth + 3, yPos + 1, rightColWidth + 2, height + 2, 3, 3, 'FD');
          } else {
            doc.rect(currentX + leftColWidth + 3, yPos + 1, rightColWidth + 2, height + 2, 'F');
          }
        }

        drawRichText(doc, event, currentX + leftColWidth + 5, yPos + 5, rightColWidth, fontSize, 1.2, 'left', groupColor, 'normal', currentTheme.text, theme);
        yPos += height + 4;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
        break;
      }
      case 'DIVIDER': {
        checkPageBreak(10);
        if (floatingArea) {
          yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
          floatingArea = null;
        }
        
        if (theme === 'cyberpunk') {
          doc.setDrawColor(6, 182, 212, 0.5);
          doc.setLineWidth(0.2);
          doc.line(margin, yPos + 4.5, margin + contentWidth, yPos + 4.5);
          doc.setDrawColor(6, 182, 212);
          doc.setLineWidth(0.5);
          doc.line(margin, yPos + 5, margin + contentWidth, yPos + 5);
          doc.setDrawColor(6, 182, 212, 0.5);
          doc.setLineWidth(0.2);
          doc.line(margin, yPos + 5.5, margin + contentWidth, yPos + 5.5);
        } else if (theme === 'terminal') {
          doc.setDrawColor(34, 197, 94, 0.3);
          doc.setLineWidth(0.1);
          doc.setLineDashPattern([1, 1], 0);
          doc.line(margin, yPos + 5, margin + contentWidth, yPos + 5);
          doc.setLineDashPattern([], 0);
        } else if (theme === 'ethereal') {
          doc.setDrawColor(99, 102, 241, 0.1);
          doc.setLineWidth(0.1);
          doc.setLineDashPattern([2, 2], 0);
          doc.line(margin + 20, yPos + 5, margin + contentWidth - 20, yPos + 5);
          doc.setLineDashPattern([], 0);
        } else if (theme === 'vintage') {
          doc.setDrawColor(212, 197, 161);
          doc.setLineWidth(0.2);
          doc.line(margin, yPos + 4.5, margin + contentWidth, yPos + 4.5);
          doc.line(margin, yPos + 5.5, margin + contentWidth, yPos + 5.5);
        } else if (theme === 'prism') {
          // Prism divider with dots
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.1);
          doc.line(margin + 10, yPos + 5, margin + contentWidth - 10, yPos + 5);
          doc.setFillColor(99, 102, 241);
          doc.circle(margin + 5, yPos + 5, 0.5, 'F');
          doc.setFillColor(236, 72, 153);
          doc.circle(margin + contentWidth - 5, yPos + 5, 0.5, 'F');
        } else {
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.5);
          doc.setLineDashPattern([2, 2], 0);
          doc.line(margin, yPos + 5, margin + contentWidth, yPos + 5);
          doc.setLineDashPattern([], 0);
        }
        yPos += 10;
        break;
      }
      default: {
        const fontSize = baseTextSize * scale;
        const textColor = currentTheme.text;
        
        const tempDoc = new jsPDF();
        const height = drawRichText(tempDoc, content, 0, 0, currentMaxWidth, fontSize, 1.5, 'left', groupColor, 'normal', textColor, theme);
        
        checkPageBreak(height + 2);

        if (floatingArea && yPos + height > floatingArea.y + floatingArea.h + 5) {
           yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
           floatingArea = null;
           currentX = margin;
           currentMaxWidth = contentWidth;
        }

        const renderedHeight = drawRichText(doc, content, currentX, yPos + (fontSize * 0.3527) * 0.7, currentMaxWidth, fontSize, 1.5, 'left', groupColor, 'normal', textColor, theme);
        yPos += renderedHeight + 4;
        if (floatingArea && yPos > floatingArea.y + floatingArea.h) floatingArea = null;
      }
    }

    await renderImages(path);
  };

  for (let i = 0; i < parsedData.length; i++) {
    const group = parsedData[i];
    const groupColor = colorsToUse[i % colorsToUse.length];
    const path = group.id || `root.${i}`;

    await renderImages(`${path}.before`);
    await renderImages(`${path}.start`);

    // Group Title
    const titleFontSize = 22 * (baseTextSize / 16);
    doc.setFontSize(titleFontSize);
    
    let groupTitleColor = hexToRgb(getShade(groupColor, -0.2));
    if (theme === 'cyberpunk') groupTitleColor = [168, 85, 247];
    if (theme === 'vintage') groupTitleColor = [74, 55, 40];
    if (theme === 'prism') groupTitleColor = [79, 70, 229];
    if (theme === 'minecraft') groupTitleColor = [55, 55, 55];
    if (theme === 'undertale') groupTitleColor = [255, 255, 255];
    
    doc.setTextColor(...groupTitleColor);
    doc.setFont(theme === 'cyberpunk' ? 'courier' : (theme === 'vintage' ? 'times' : 'helvetica'), 'bold');
    checkPageBreak(15);
    
    if (theme === 'cyberpunk') {
      doc.setFillColor(168, 85, 247, 0.1);
      doc.rect(margin, yPos + 2, contentWidth, 10, 'F');
      doc.setDrawColor(168, 85, 247);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos + 2, margin + contentWidth, yPos + 2);
      doc.line(margin, yPos + 12, margin + contentWidth, yPos + 12);
      doc.text(stripMemoryLinks(group.GROUP.toUpperCase()), margin + 5, yPos + 9);
    } else if (theme === 'minecraft') {
      doc.setFillColor(198, 198, 198);
      doc.rect(margin, yPos + 2, contentWidth, 10, 'F');
      doc.setDrawColor(55, 55, 55);
      doc.setLineWidth(1);
      doc.rect(margin, yPos + 2, contentWidth, 10, 'D');
      doc.text(stripMemoryLinks(group.GROUP.toUpperCase()), margin + 5, yPos + 9);
    } else if (theme === 'undertale') {
      doc.setTextColor(255, 0, 0);
      doc.text('❤', margin, yPos + 10);
      doc.setTextColor(255, 255, 255);
      doc.text(stripMemoryLinks(group.GROUP.toUpperCase()), margin + 8, yPos + 10);
    } else if (theme === 'vintage') {
      doc.text(stripMemoryLinks(group.GROUP), margin + (contentWidth / 2), yPos + 10, { align: 'center' });
      doc.setDrawColor(212, 197, 161);
      doc.setLineWidth(0.2);
      doc.line(margin + (contentWidth / 4), yPos + 12, margin + (contentWidth * 3 / 4), yPos + 12);
    } else {
      doc.text(stripMemoryLinks(group.GROUP), margin, yPos + 10);
    }
    
    yPos += 15;

    for (let j = 0; j < group.ITEMS.length; j++) {
      const item = group.ITEMS[j];
      const type = String(item.TYPE).toUpperCase();
      const itemPath = item.id || `${path}.ITEMS.${j}`;
      
      if (type === 'TABLE_HEAD' || type === 'TABLE_ROW') {
        // Clear floating area before table
        if (floatingArea) {
          yPos = Math.max(yPos, floatingArea.y + floatingArea.h + 5);
          floatingArea = null;
        }

        const tableRows: string[][] = [];
        let head: string[] | null = null;
        
        // Collect all consecutive table items
        let k = j;
        while (k < group.ITEMS.length) {
          const nextItem = group.ITEMS[k];
          const nextType = String(nextItem.TYPE).toUpperCase();
          const nextItemPath = nextItem.id || `${path}.ITEMS.${k}`;
          
          if (nextType !== 'TABLE_HEAD' && nextType !== 'TABLE_ROW') break;

          // Check for images around this specific table item
          const beforeImages = imagePlacements[`${nextItemPath}.before`];
          const afterImages = imagePlacements[nextItemPath];

          // If there are images, we might need to break the table block to render them
          if (k > j && (beforeImages?.length || afterImages?.length)) {
            break; 
          }

          // Render images before the row
          await renderImages(`${nextItemPath}.before`);

          const nextContent = stripMemoryLinks(String(nextItem.CONTENT)
            .replace(/\[([^\]]+)\]\{([^}]+)\}/g, '$1')
            .replace(/\[c:[^\]]*\](.*?)\[\/c\]/g, '$1')
            .replace(/==/g, '')
            .replace(/\*\*/g, '')
            .replace(/__/g, '')
            .replace(/\*/g, '')
            .replace(/_/g, ''));
          
          if (nextType === 'TABLE_HEAD') {
            head = nextContent.split('|').map(s => s.trim());
          } else if (nextType === 'TABLE_ROW') {
            tableRows.push(nextContent.split('|').map(s => s.trim()));
          }
          
          k++;

          // Render images after the row
          await renderImages(nextItemPath);

          // If this row had "after" images, we must break the table to ensure they appear correctly
          if (afterImages?.length) {
            break;
          }
        }
        
        // Render table
        if (head || tableRows.length > 0) {
          let headStyles: any = { fillColor: hexToRgb(groupColor), textColor: [255, 255, 255] };
          let bodyStyles: any = { textColor: [30, 41, 59] };
          let alternateRowStyles: any = { fillColor: hexToRgb(getShade(groupColor, 0.95)) };

          if (theme === 'cyberpunk') {
            headStyles = { fillColor: [88, 28, 135], textColor: [34, 211, 238] }; // purple-900/30-ish, cyan-400
            bodyStyles = { textColor: [34, 211, 238], fillColor: [10, 10, 20] };
            alternateRowStyles = { fillColor: [15, 15, 30] };
          } else if (theme === 'terminal') {
            headStyles = { fillColor: [0, 0, 0], textColor: [34, 197, 94], lineWidth: 0.1, lineColor: [34, 197, 94] };
            bodyStyles = { textColor: [34, 197, 94], fillColor: [0, 0, 0], lineWidth: 0.1, lineColor: [34, 197, 94] };
            alternateRowStyles = { fillColor: [0, 0, 0] };
          } else if (theme === 'ethereal') {
            headStyles = { fillColor: [238, 242, 255], textColor: [49, 46, 129] };
            bodyStyles = { textColor: [30, 41, 59], fillColor: [255, 255, 255] };
            alternateRowStyles = { fillColor: [249, 250, 251] };
          } else if (theme === 'vintage') {
            headStyles = { fillColor: [74, 55, 40], textColor: [255, 255, 255] };
            bodyStyles = { textColor: [74, 55, 40], fillColor: [253, 251, 247] };
            alternateRowStyles = { fillColor: [245, 240, 230] };
          } else if (theme === 'prism') {
            headStyles = { fillColor: [79, 70, 229], textColor: [255, 255, 255] };
            bodyStyles = { textColor: [15, 23, 42], fillColor: [255, 255, 255] };
            alternateRowStyles = { fillColor: [248, 250, 252] };
          } else if (theme === 'modern') {
            headStyles = { fillColor: [248, 250, 252], textColor: [100, 116, 139] }; // bg-slate-50, text-slate-500
            bodyStyles = { textColor: [15, 23, 42], fillColor: [255, 255, 255] };
            alternateRowStyles = { fillColor: [255, 255, 255] }; // No alternate row color in modern preview
          } else if (theme === 'minecraft') {
            headStyles = { fillColor: [55, 55, 55], textColor: [255, 255, 255] };
            bodyStyles = { textColor: [55, 55, 55], fillColor: [198, 198, 198] };
            alternateRowStyles = { fillColor: [180, 180, 180] };
          } else if (theme === 'undertale') {
            headStyles = { fillColor: [0, 0, 0], textColor: [255, 255, 255], lineWidth: 0.2, lineColor: [255, 255, 255] };
            bodyStyles = { textColor: [255, 255, 255], fillColor: [0, 0, 0], lineWidth: 0.2, lineColor: [255, 255, 255] };
            alternateRowStyles = { fillColor: [0, 0, 0] };
          }

          autoTable(doc, {
            startY: yPos,
            head: head ? [head] : undefined,
            body: tableRows,
            margin: { left: margin, right: margin },
            styles: { 
              fontSize: baseTextSize * 0.8,
              font: theme === 'cyberpunk' ? 'courier' : (theme === 'terminal' ? 'courier' : (theme === 'ethereal' ? 'times' : (theme === 'vintage' ? 'times' : (theme === 'minecraft' || theme === 'undertale' ? 'courier' : 'helvetica'))))
            },
            headStyles,
            bodyStyles,
            alternateRowStyles,
            didDrawPage: (data) => {
              yPos = data.cursor?.y || yPos;
            }
          });
          
          yPos = (doc as any).lastAutoTable.finalY + 5;
        }
        
        j = k - 1; // Skip the items we just processed
      } else {
        await renderItem(item, itemPath, groupColor);
      }
    }

    await renderImages(`${path}.end`);
    yPos += 10; // Space between groups
  }

  await renderImages("root.end");

  // Add page numbers
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    
    let pageNumColor: [number, number, number] = [148, 163, 184];
    if (theme === 'cyberpunk') pageNumColor = [0, 255, 255];
    if (theme === 'vintage') pageNumColor = [93, 64, 55];
    if (theme === 'prism') pageNumColor = [99, 102, 241];
    if (theme === 'minecraft') pageNumColor = [55, 55, 55];
    if (theme === 'undertale') pageNumColor = [255, 255, 255];
    
    doc.setTextColor(...pageNumColor);
    doc.setFont(theme === 'cyberpunk' || theme === 'terminal' || theme === 'minecraft' || theme === 'undertale' ? 'courier' : (theme === 'vintage' ? 'times' : 'helvetica'), 'normal');
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  doc.save(`${docTitle}.pdf`);
};
