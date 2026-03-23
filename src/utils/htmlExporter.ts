/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlacedImage } from '../components/DocumentRenderer';
import { CustomFont } from './pdfGenerator';

export async function exportToHTML(
  parsedData: any,
  imagePlacements: Record<string, PlacedImage[]>,
  selectedColors: string[],
  textSize: number,
  customFont?: CustomFont,
  theme: 'modern' | 'cyberpunk' | 'vintage' | 'terminal' | 'ethereal' | 'prism' | 'minecraft' | 'undertale' | 'god-of-war' | 'cuphead' = 'modern'
) {
  // Get the current document preview element
  const previewElement = document.querySelector('.document-preview');
  if (!previewElement) {
    throw new Error('Preview element not found');
  }

  // Clone the element to avoid modifying the live DOM
  const clone = previewElement.cloneNode(true) as HTMLElement;

  // Remove any drag handles or UI elements that shouldn't be in the export
  const uiElements = clone.querySelectorAll('.drag-handle, .settings-hint, .resize-handle, button:not(.explanation-btn)');
  uiElements.forEach(el => el.remove());

  // Get all styles
  let styles = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        styles += rule.cssText + '\n';
      }
    } catch (e) {
      // Skip cross-origin stylesheets that we can't access
      console.warn('Could not access stylesheet:', sheet.href);
    }
  }

  // Add custom font if present
  let fontFace = '';
  if (customFont) {
    fontFace = `
      @font-face {
        font-family: '${customFont.name}';
        src: url('${customFont.data}');
      }
      .document-preview {
        font-family: '${customFont.name}', sans-serif !important;
      }
    `;
  }

  const metadata = {
    parsedData,
    imagePlacements,
    selectedColors,
    textSize,
    customFont,
    theme,
    version: '1.0',
    exportedAt: new Date().toISOString()
  };

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Arcane Notes Export</title>
    <!-- ARCANE_NOTES_METADATA_START
    ${JSON.stringify(metadata)}
    ARCANE_NOTES_METADATA_END -->
    <script id="arcane-notes-metadata" type="application/json">
        ${JSON.stringify(metadata)}
    </script>
    <script src="https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js"></script>
    <style>
        ${styles}
        ${fontFace}
        :root {
            --accent-color: ${selectedColors[0] || '#3b82f6'};
        }
        body {
            margin: 0;
            padding: 0;
            background-color: ${theme === 'cyberpunk' ? '#0a0a0f' : (theme === 'terminal' ? '#000000' : (theme === 'ethereal' ? '#f5f7ff' : (theme === 'vintage' ? '#fdfbf7' : (theme === 'prism' ? '#fdfdfd' : (theme === 'minecraft' ? '#c6c6c6' : (theme === 'undertale' ? '#000000' : '#f8f9fa'))))))};
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: sans-serif;
        }
        .export-container {
            width: 100%;
            max-width: 100%;
            padding: 2rem;
            box-sizing: border-box;
            margin-top: 60px; /* Space for toolbar */
        }
        .document-preview {
            font-size: ${textSize}px;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            background: ${theme === 'cyberpunk' ? '#0a0a0f' : (theme === 'terminal' ? '#000000' : (theme === 'ethereal' ? '#ffffff' : (theme === 'vintage' ? '#fdfbf7' : (theme === 'prism' ? '#fdfdfd' : (theme === 'minecraft' ? '#c6c6c6' : (theme === 'undertale' ? '#000000' : '#ffffff'))))))};
            padding: 4rem;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            position: relative;
            min-height: 80vh;
        }
        
        /* Dynamic Toolbar */
        .dynamic-toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 60px;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1.5rem;
            z-index: 10001;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .toolbar-btn {
            padding: 0.5rem 1rem;
            border-radius: 9999px;
            border: 1px solid rgba(0,0,0,0.1);
            background: white;
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 600;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .toolbar-btn.active {
            background: var(--accent-color);
            color: white;
            border-color: var(--accent-color);
        }
        .toolbar-btn:hover:not(.active) {
            background: #f3f4f6;
        }

        /* Edit Mode Styles */
        .edit-mode .document-preview > div > div {
            cursor: grab;
            position: relative;
        }
        .edit-mode .document-preview > div > div:active {
            cursor: grabbing;
        }
        .edit-mode .document-preview > div > div::after {
            content: '⋮⋮';
            position: absolute;
            left: -25px;
            top: 50%;
            transform: translateY(-50%);
            opacity: 0;
            transition: opacity 0.2s;
            color: #94a3b8;
            font-size: 20px;
        }
        .edit-mode .document-preview > div > div:hover::after {
            opacity: 1;
        }

        /* Fluid Mode Styles */
        .fluid-mode .document-preview > div {
            display: block !important;
            position: relative !important;
        }
        .fluid-mode .document-preview > div > div {
            position: absolute !important;
            width: auto !important;
            max-width: 400px;
            z-index: 1;
        }

        /* Image Handles */
        .image-wrapper {
            position: relative;
            display: inline-block;
            max-width: 100%;
        }
        .edit-mode .image-wrapper {
            outline: 2px dashed transparent;
            transition: outline 0.2s;
        }
        .edit-mode .image-wrapper:hover {
            outline-color: var(--accent-color);
        }
        .resize-handle {
            position: absolute;
            width: 12px;
            height: 12px;
            background: var(--accent-color);
            border: 2px solid white;
            border-radius: 50%;
            bottom: -6px;
            right: -6px;
            cursor: nwse-resize;
            display: none;
            z-index: 10;
        }
        .edit-mode .resize-handle {
            display: block;
        }
        .image-toolbar {
            position: absolute;
            top: -40px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 4px;
            display: none;
            gap: 4px;
            z-index: 20;
            border: 1px solid #e2e8f0;
        }
        .edit-mode .image-wrapper:hover .image-toolbar {
            display: flex;
        }
        .img-btn {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            border: none;
            background: transparent;
            cursor: pointer;
            color: #64748b;
        }
        .img-btn:hover {
            background: #f1f5f9;
            color: var(--accent-color);
        }

        #fullscreen-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            cursor: pointer;
            font-family: sans-serif;
            transition: opacity 0.5s;
        }
        #fullscreen-overlay h1 {
            font-size: 2rem;
            margin-bottom: 1rem;
        }
        #fullscreen-overlay p {
            font-size: 1.2rem;
            opacity: 0.8;
        }
        @media print {
            #fullscreen-overlay, .dynamic-toolbar, .image-toolbar, .resize-handle { display: none !important; }
            body { background: white; margin-top: 0; }
            .export-container { padding: 0; margin-top: 0; }
            .document-preview { box-shadow: none; padding: 0; max-width: 100%; }
        }
    </style>
</head>
<body>
    <div id="fullscreen-overlay">
        <h1>Arcane Notes</h1>
        <p>Click anywhere to enter full screen mode</p>
    </div>

    <div class="dynamic-toolbar">
        <button id="toggle-edit" class="toolbar-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Edit Mode
        </button>
        <button id="toggle-fluid" class="toolbar-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            Fluid Mode
        </button>
        <button id="reset-btn" class="toolbar-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
            Reset
        </button>
        <button id="print-btn" class="toolbar-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Print / Save PDF
        </button>
    </div>

    <div class="export-container">
        <div class="document-preview">
            ${clone.innerHTML}
        </div>
    </div>

    <script>
        // Fullscreen Overlay
        const overlay = document.getElementById('fullscreen-overlay');
        overlay.addEventListener('click', () => {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log('Fullscreen request failed', err);
                });
            }
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 500);
        }, { once: true });

        // State
        let isEditMode = false;
        let isFluidMode = false;
        const storageKey = 'arcane-notes-layout-' + (document.getElementById('arcane-notes-metadata')?.textContent?.substring(0, 100).length || 'default');

        const preview = document.querySelector('.document-preview');
        const toggleEditBtn = document.getElementById('toggle-edit');
        const toggleFluidBtn = document.getElementById('toggle-fluid');
        const resetBtn = document.getElementById('reset-btn');
        const printBtn = document.getElementById('print-btn');

        // Wrap images for resizing
        const images = preview.querySelectorAll('img');
        images.forEach((img, idx) => {
            if (img.parentElement.classList.contains('image-wrapper')) return;
            
            const wrapper = document.createElement('div');
            wrapper.className = 'image-wrapper';
            wrapper.id = 'img-wrapper-' + idx;
            
            const parent = img.parentElement;
            if (parent.classList.contains('text-center')) wrapper.style.margin = '0 auto';
            if (parent.classList.contains('text-right')) wrapper.style.marginLeft = 'auto';
            
            wrapper.style.width = img.style.width || '100%';
            img.style.width = '100%';
            
            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);
            
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            wrapper.appendChild(handle);

            const toolbar = document.createElement('div');
            toolbar.className = 'image-toolbar';
            toolbar.innerHTML = \`
                <button class="img-btn" data-align="left" title="Align Left">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>
                </button>
                <button class="img-btn" data-align="center" title="Align Center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="10" x2="6" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="18" y1="18" x2="6" y2="18"></line></svg>
                </button>
                <button class="img-btn" data-align="right" title="Align Right">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="10" x2="7" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="7" y2="18"></line></svg>
                </button>
            \`;
            wrapper.appendChild(toolbar);

            toolbar.querySelectorAll('.img-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const align = btn.dataset.align;
                    if (align === 'left') { wrapper.style.margin = '0'; wrapper.style.marginRight = 'auto'; }
                    if (align === 'center') { wrapper.style.margin = '0 auto'; }
                    if (align === 'right') { wrapper.style.margin = '0'; wrapper.style.marginLeft = 'auto'; }
                    saveLayout();
                });
            });
        });

        // Assign IDs to bricks for persistence
        const bricks = document.querySelectorAll('.document-preview > div > div');
        bricks.forEach((brick, idx) => {
            if (!brick.id) brick.id = 'brick-' + idx;
        });

        function saveLayout() {
            const layout = {
                bricks: {},
                images: {},
                isFluidMode
            };
            
            document.querySelectorAll('.document-preview > div > div').forEach(brick => {
                layout.bricks[brick.id] = {
                    x: brick.getAttribute('data-x'),
                    y: brick.getAttribute('data-y')
                };
            });
            
            document.querySelectorAll('.image-wrapper').forEach(wrapper => {
                layout.images[wrapper.id] = {
                    width: wrapper.style.width,
                    height: wrapper.style.height,
                    margin: wrapper.style.margin,
                    marginLeft: wrapper.style.marginLeft,
                    marginRight: wrapper.style.marginRight,
                    x: wrapper.getAttribute('data-x'),
                    y: wrapper.getAttribute('data-y')
                };
            });
            
            localStorage.setItem(storageKey, JSON.stringify(layout));
        }

        function loadLayout() {
            const saved = localStorage.getItem(storageKey);
            if (!saved) return;
            
            const layout = JSON.parse(saved);
            isFluidMode = layout.isFluidMode || false;
            if (isFluidMode) {
                document.body.classList.add('fluid-mode');
                toggleFluidBtn.classList.add('active');
            }
            
            Object.keys(layout.bricks).forEach(id => {
                const el = document.getElementById(id);
                if (el && layout.bricks[id].x) {
                    el.style.transform = \`translate(\${layout.bricks[id].x}px, \${layout.bricks[id].y}px)\`;
                    el.setAttribute('data-x', layout.bricks[id].x);
                    el.setAttribute('data-y', layout.bricks[id].y);
                }
            });
            
            Object.keys(layout.images).forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const imgData = layout.images[id];
                    if (imgData.width) el.style.width = imgData.width;
                    if (imgData.height) el.style.height = imgData.height;
                    if (imgData.margin) el.style.margin = imgData.margin;
                    if (imgData.marginLeft) el.style.marginLeft = imgData.marginLeft;
                    if (imgData.marginRight) el.style.marginRight = imgData.marginRight;
                    if (imgData.x) {
                        el.style.transform = \`translate(\${imgData.x}px, \${imgData.y}px)\`;
                        el.setAttribute('data-x', imgData.x);
                        el.setAttribute('data-y', imgData.y);
                    }
                }
            });
        }

        // Initialize Interact.js
        function initInteractions() {
            interact('.document-preview > div > div').draggable({
                enabled: isEditMode,
                inertia: true,
                modifiers: [
                    interact.modifiers.restrictRect({
                        restriction: 'parent',
                        endOnly: true
                    })
                ],
                autoScroll: true,
                listeners: {
                    move(event) {
                        const target = event.target;
                        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                        target.style.transform = \`translate(\${x}px, \${y}px)\`;
                        target.setAttribute('data-x', x);
                        target.setAttribute('data-y', y);
                    },
                    end() {
                        saveLayout();
                    }
                }
            });

            interact('.image-wrapper').resizable({
                enabled: isEditMode,
                edges: { right: true, bottom: true, bottomRight: '.resize-handle' },
                modifiers: [
                    interact.modifiers.restrictSize({
                        min: { width: 100, height: 50 },
                        max: { width: 1200, height: 2000 }
                    })
                ],
                listeners: {
                    move(event) {
                        let { x, y } = event.target.dataset;
                        x = (parseFloat(x) || 0) + event.deltaRect.left;
                        y = (parseFloat(y) || 0) + event.deltaRect.top;

                        Object.assign(event.target.style, {
                            width: \`\${event.rect.width}px\`,
                            height: \`\${event.rect.height}px\`,
                            transform: \`translate(\${x}px, \${y}px)\`
                        });

                        Object.assign(event.target.dataset, { x, y });
                    },
                    end() {
                        saveLayout();
                    }
                }
            }).draggable({
                enabled: isEditMode,
                listeners: {
                    move(event) {
                        const target = event.target;
                        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                        target.style.transform = \`translate(\${x}px, \${y}px)\`;
                        target.setAttribute('data-x', x);
                        target.setAttribute('data-y', y);
                    },
                    end() {
                        saveLayout();
                    }
                }
            });
        }

        toggleEditBtn.addEventListener('click', () => {
            isEditMode = !isEditMode;
            document.body.classList.toggle('edit-mode', isEditMode);
            toggleEditBtn.classList.toggle('active', isEditMode);
            
            interact('.document-preview > div > div').draggable({ enabled: isEditMode });
            interact('.image-wrapper').resizable({ enabled: isEditMode }).draggable({ enabled: isEditMode });
        });

        toggleFluidBtn.addEventListener('click', () => {
            isFluidMode = !isFluidMode;
            document.body.classList.toggle('fluid-mode', isFluidMode);
            toggleFluidBtn.classList.toggle('active', isFluidMode);
            
            if (isFluidMode) {
                const items = document.querySelectorAll('.document-preview > div > div');
                let currentY = 0;
                items.forEach((item, i) => {
                    if (!item.getAttribute('data-x')) {
                        const x = Math.random() * 50;
                        item.style.transform = \`translate(\${x}px, \${currentY}px)\`;
                        item.setAttribute('data-x', x);
                        item.setAttribute('data-y', currentY);
                        currentY += item.offsetHeight + 20;
                    }
                });
            } else {
                const items = document.querySelectorAll('.document-preview > div > div');
                items.forEach(item => {
                    item.style.transform = '';
                    item.removeAttribute('data-x');
                    item.removeAttribute('data-y');
                });
            }
            saveLayout();
        });

        resetBtn.addEventListener('click', () => {
            if (confirm('Reset all layout changes?')) {
                localStorage.removeItem(storageKey);
                window.location.reload();
            }
        });

        printBtn.addEventListener('click', () => {
            window.print();
        });

        // Initialize Explanation Popovers
        function initExplanations() {
            const wrappers = document.querySelectorAll('.explanation-wrapper');
            wrappers.forEach(wrapper => {
                const btn = wrapper.querySelector('.explanation-btn');
                const popover = wrapper.querySelector('.explanation-popover');
                
                if (btn && popover) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isHidden = popover.classList.contains('hidden');
                        // Close all others
                        document.querySelectorAll('.explanation-popover').forEach(p => p.classList.add('hidden'));
                        if (isHidden) {
                            popover.classList.remove('hidden');
                        }
                    });
                }
            });
            
            // Close popovers when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.explanation-wrapper')) {
                    document.querySelectorAll('.explanation-popover').forEach(p => p.classList.add('hidden'));
                }
            });
        }

        // Initialize Memory Links
        function initMemoryLinks() {
            const memoryLinks = document.querySelectorAll('[data-memory-link]');
            if (memoryLinks.length === 0) return;
            
            // Parse metadata to get fullData
            let fullData = [];
            let theme = 'modern';
            try {
                const metadataEl = document.getElementById('arcane-notes-metadata');
                if (metadataEl) {
                    const metadata = JSON.parse(metadataEl.textContent);
                    fullData = metadata.parsedData || [];
                    theme = metadata.theme || 'modern';
                }
            } catch (e) {
                console.error('Failed to parse metadata for memory links', e);
            }

            // Create a single popover container
            const popoverContainer = document.createElement('div');
            popoverContainer.className = 'memory-link-popover hidden theme-' + theme;
            document.body.appendChild(popoverContainer);

            // Add styles for the popover
            const style = document.createElement('style');
            style.textContent = \`
                .memory-link-popover {
                    position: fixed;
                    z-index: 9999;
                    width: 320px;
                    max-height: 400px;
                    overflow-y: auto;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    transition: all 0.3s;
                    font-family: sans-serif;
                }
                .memory-link-popover.hidden {
                    display: none;
                }
                .memory-link-popover.theme-cyberpunk {
                    background: black;
                    border: 1px solid #06b6d4;
                    border-radius: 0;
                    box-shadow: 0 0 30px rgba(6,182,212,0.3);
                    color: white;
                }
                .memory-link-popover.theme-terminal {
                    background: black;
                    border: 1px solid #22c55e;
                    border-radius: 0;
                    box-shadow: 0 0 20px rgba(34,197,94,0.2);
                    color: #22c55e;
                }
                .memory-link-popover.theme-vintage {
                    background: #fdfbf7;
                    border: 1px solid #d4c5a1;
                    border-radius: 2px;
                }
                .memory-link-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 16px;
                }
                .memory-link-title {
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    font-size: 0.875rem;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .theme-modern .memory-link-title { color: #0f172a; }
                .theme-cyberpunk .memory-link-title { color: #22d3ee; }
                .theme-terminal .memory-link-title { color: #22c55e; }
                .memory-link-close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 8px;
                    color: #94a3b8;
                }
                .memory-link-close:hover {
                    background: rgba(0,0,0,0.05);
                }
                .theme-cyberpunk .memory-link-close:hover { background: rgba(6,182,212,0.2); }
                .theme-terminal .memory-link-close:hover { background: rgba(34,197,94,0.2); }
                .memory-link-item {
                    padding: 12px;
                    border-radius: 12px;
                    border: 1px solid #f1f5f9;
                    background: #f8fafc;
                    margin-bottom: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .theme-cyberpunk .memory-link-item {
                    background: rgba(8, 145, 178, 0.2);
                    border-color: rgba(6, 182, 212, 0.3);
                }
                .theme-terminal .memory-link-item {
                    background: rgba(21, 128, 61, 0.2);
                    border-color: rgba(34, 197, 94, 0.3);
                }
                .theme-vintage .memory-link-item {
                    background: #fff;
                    border-color: #e5e7eb;
                }
                .memory-link-item:hover {
                    border-color: #bfdbfe;
                    background: #eff6ff;
                }
                .theme-cyberpunk .memory-link-item:hover {
                    background: rgba(8, 145, 178, 0.4);
                    border-color: #22d3ee;
                }
                .theme-terminal .memory-link-item:hover {
                    background: rgba(21, 128, 61, 0.4);
                    border-color: #4ade80;
                }
                .memory-link-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 4px;
                }
                .memory-link-group {
                    font-size: 10px;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    padding: 2px 6px;
                    border-radius: 4px;
                    background: #dbeafe;
                    color: #1d4ed8;
                }
                .theme-cyberpunk .memory-link-group { background: rgba(6,182,212,0.2); color: #22d3ee; }
                .theme-terminal .memory-link-group { background: rgba(34,197,94,0.2); color: #4ade80; }
                .memory-link-type {
                    font-size: 10px;
                    color: #94a3b8;
                    text-transform: uppercase;
                    font-weight: 500;
                }
                .memory-link-text {
                    font-size: 12px;
                    line-height: 1.6;
                    color: #475569;
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .theme-cyberpunk .memory-link-text { color: rgba(207, 250, 254, 0.8); }
                .theme-terminal .memory-link-text { color: rgba(134, 239, 172, 0.8); }
                .memory-link-empty {
                    font-size: 14px;
                    color: #64748b;
                    font-style: italic;
                }
            \`;
            document.head.appendChild(style);

            function getOccurrences(concept) {
                const results = [];
                if (!Array.isArray(fullData)) return results;

                fullData.forEach((group, groupIdx) => {
                    if (group.GROUP && Array.isArray(group.ITEMS)) {
                        const groupName = group.GROUP || 'Untitled Group';
                        group.ITEMS.forEach((item, itemIdx) => {
                            const content = String(item.CONTENT || '');
                            const isMention = content.includes('[[' + concept + ']]');
                            const isDefinition = item.TYPE === 'CONCEPT' && content.trim().toLowerCase() === concept.trim().toLowerCase();
                            
                            if (isMention || isDefinition) {
                                const cleanText = content
                                    .replace(/\\[\\[([^\\]]+)\\]\\]/g, '$1')
                                    .replace(/\\[([^\\]]+)\\]\\{([^}]+)\\}/g, '$1');
                                
                                results.push({
                                    group: groupName,
                                    text: cleanText,
                                    type: item.TYPE,
                                    path: item.id || 'root.' + groupIdx + '.' + itemIdx
                                });
                            }
                        });
                    } else {
                        const content = String(group.CONTENT || '');
                        const isMention = content.includes('[[' + concept + ']]');
                        const isDefinition = group.TYPE === 'CONCEPT' && content.trim().toLowerCase() === concept.trim().toLowerCase();
                        
                        if (isMention || isDefinition) {
                            const cleanText = content
                                .replace(/\\[\\[([^\\]]+)\\]\\]/g, '$1')
                                .replace(/\\[([^\\]]+)\\]\\{([^}]+)\\}/g, '$1');
                            
                            results.push({
                                group: 'General',
                                text: cleanText,
                                type: group.TYPE || 'ITEM',
                                path: group.id || 'root.' + groupIdx
                            });
                        }
                    }
                });
                return results;
            }

            function handleNavigate(path) {
                popoverContainer.classList.add('hidden');
                setTimeout(() => {
                    const sanitizedPath = path.replace(/\\s+/g, '_');
                    const elementId = 'doc-item-' + sanitizedPath;
                    const element = document.getElementById(elementId);
                    
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        
                        // Add highlight
                        const originalOutline = element.style.outline;
                        const originalOutlineOffset = element.style.outlineOffset;
                        const originalTransition = element.style.transition;
                        
                        element.style.transition = 'all 0.5s';
                        element.style.outline = '4px solid rgba(59, 130, 246, 0.5)';
                        element.style.outlineOffset = '4px';
                        
                        setTimeout(() => {
                            element.style.outline = originalOutline;
                            element.style.outlineOffset = originalOutlineOffset;
                            setTimeout(() => {
                                element.style.transition = originalTransition;
                            }, 500);
                        }, 2000);
                    }
                }, 100);
            }

            memoryLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const concept = link.getAttribute('data-memory-link');
                    if (!concept) return;

                    const occurrences = getOccurrences(concept);
                    
                    let itemsHtml = '';
                    if (occurrences.length <= 1) {
                        itemsHtml = '<p class="memory-link-empty">No other occurrences found.</p>';
                    } else {
                        itemsHtml = occurrences.map((occ, idx) => \`
                            <div class="memory-link-item" data-path="\${occ.path}">
                                <div class="memory-link-meta">
                                    <span class="memory-link-group">\${occ.group}</span>
                                    <span class="memory-link-type">\${occ.type}</span>
                                </div>
                                <p class="memory-link-text">\${occ.text}</p>
                            </div>
                        \`).join('');
                    }

                    popoverContainer.innerHTML = \`
                        <div class="memory-link-header">
                            <div class="memory-link-title">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"></path><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"></path><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"></path><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"></path><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"></path><path d="M3.477 10.896a4 4 0 0 1 .585-.396"></path><path d="M19.938 10.5a4 4 0 0 1 .585.396"></path><path d="M6 18a4 4 0 0 1-1.967-.516"></path><path d="M19.967 17.484A4 4 0 0 1 18 18"></path></svg>
                                Memory Links: \${concept}
                            </div>
                            <button class="memory-link-close">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div class="memory-link-content">
                            \${itemsHtml}
                        </div>
                    \`;

                    popoverContainer.classList.remove('hidden');

                    // Add event listeners to new elements
                    popoverContainer.querySelector('.memory-link-close').addEventListener('click', () => {
                        popoverContainer.classList.add('hidden');
                    });

                    popoverContainer.querySelectorAll('.memory-link-item').forEach(item => {
                        item.addEventListener('click', () => {
                            handleNavigate(item.getAttribute('data-path'));
                        });
                    });
                });
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!popoverContainer.contains(e.target) && !e.target.closest('[data-memory-link]')) {
                    popoverContainer.classList.add('hidden');
                }
            });
        }

        loadLayout();
        initInteractions();
        initExplanations();
        initMemoryLinks();
    </script>
</body>
</html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `arcane-notes-${Date.now()}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
