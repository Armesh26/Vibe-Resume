import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Download, ZoomIn, ZoomOut, Crosshair } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import './PdfViewer.css';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function PdfViewer({ pdfUrl, onDownload, onGoToSource }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1.5);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [contextMenu, setContextMenu] = useState(null);
  const [clickCoords, setClickCoords] = useState(null);
  const [synctexHighlight, setSynctexHighlight] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageHeight, setPageHeight] = useState(0);

  // Extract job ID from URL for synctex
  const jobId = pdfUrl ? pdfUrl.match(/\/pdf\/([^/?]+)/)?.[1] : null;

  // Load PDF
  useEffect(() => {
    if (!pdfUrl) {
      setPdfDoc(null);
      setNumPages(0);
      return;
    }

    setIsLoading(true);
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    
    loadingTask.promise.then(pdf => {
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setPageNum(1);
      setIsLoading(false);
    }).catch(err => {
      console.error('Error loading PDF:', err);
      setIsLoading(false);
    });

    return () => {
      loadingTask.destroy?.();
    };
  }, [pdfUrl]);

  // Render page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    pdfDoc.getPage(pageNum).then(page => {
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Store unscaled page height for synctex calculations
      const unscaledViewport = page.getViewport({ scale: 1 });
      setPageHeight(unscaledViewport.height);
      
      // Account for device pixel ratio to prevent blurry rendering
      const dpr = window.devicePixelRatio || 1;
      
      // Set canvas internal size (scaled by DPR for sharpness)
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      
      // Set CSS display size (actual visual size)
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      
      // Scale the context to account for DPR
      context.scale(dpr, dpr);

      page.render({
        canvasContext: context,
        viewport: viewport
      });
    });
  }, [pdfDoc, pageNum, scale]);

  // Handle zoom
  const zoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));

  // Get PDF coordinates from mouse event
  const getPdfCoordinates = useCallback((e) => {
    if (!canvasRef.current || !pdfDoc || !pageHeight) return null;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get click position relative to displayed canvas
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Convert screen coordinates to PDF points
    // The CSS size matches viewport.width/height (= pdfWidth * scale)
    // So dividing by scale gives us PDF points
    const x = clickX / scale;
    const y = clickY / scale;
    
    return { x, y, page: pageNum };
  }, [scale, pageNum, pdfDoc, pageHeight]);

  // Handle right-click context menu
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const coords = getPdfCoordinates(e);
    if (coords) {
      setClickCoords(coords);
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  }, [getPdfCoordinates]);

  // Handle double-click to go to source
  const handleDoubleClick = useCallback(async (e) => {
    if (!jobId) return;
    
    const coords = getPdfCoordinates(e);
    if (!coords) return;

    try {
      const response = await fetch(`/synctex/reverse/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          page: coords.page, 
          x: coords.x, 
          y: coords.y 
        })
      });
      
      const data = await response.json();
      if (data.success && data.line && onGoToSource) {
        onGoToSource(data.line - 1); // Convert to 0-indexed
      }
    } catch (err) {
      console.error('SyncTeX error:', err);
    }
  }, [jobId, getPdfCoordinates, onGoToSource]);

  // Context menu action: Jump to source
  const handleJumpToSource = useCallback(async (e) => {
    e.stopPropagation();
    setContextMenu(null);
    if (!jobId || !clickCoords) return;

    try {
      const response = await fetch(`/synctex/reverse/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          page: clickCoords.page, 
          x: clickCoords.x, 
          y: clickCoords.y 
        })
      });
      
      const data = await response.json();
      if (data.success && data.line && onGoToSource) {
        onGoToSource(data.line - 1); // Convert to 0-indexed
      }
    } catch (err) {
      console.error('SyncTeX error:', err);
    }
  }, [jobId, clickCoords, onGoToSource]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Show synctex highlight (called from parent via forward synctex)
  const showHighlight = useCallback((x, y, width, height) => {
    setSynctexHighlight({ x: x * scale, y: y * scale, width: width * scale, height: height * scale });
    setTimeout(() => setSynctexHighlight(null), 1500);
  }, [scale]);

  return (
    <div className="pdf-viewer">
      <div className="pdf-header">
        <div className="pdf-title">
          <FileText size={16} />
          Preview
        </div>
        <div className="pdf-controls">
          <button onClick={zoomOut} title="Zoom Out">
            <ZoomOut size={16} />
          </button>
          <span className="zoom-level">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} title="Zoom In">
            <ZoomIn size={16} />
          </button>
          {pdfUrl && (
            <button onClick={onDownload} className="download-btn" title="Download PDF">
              <Download size={16} />
              Download
            </button>
          )}
        </div>
      </div>

      <div className="pdf-content" ref={containerRef}>
        {pdfUrl ? (
          <div className="pdf-canvas-container" onContextMenu={(e) => e.preventDefault()}>
            <canvas 
              ref={canvasRef}
              className="pdf-canvas"
              onContextMenu={handleContextMenu}
              onDoubleClick={handleDoubleClick}
            />
            {synctexHighlight && (
              <div 
                className="synctex-highlight visible"
                style={{
                  left: synctexHighlight.x,
                  top: synctexHighlight.y,
                  width: synctexHighlight.width || 200,
                  height: synctexHighlight.height || 20
                }}
              />
            )}
          </div>
        ) : (
          <div className="pdf-placeholder">
            <FileText size={48} />
            <p>Chat with AI to generate your resume</p>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="pdf-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="context-menu-item accent" onClick={handleJumpToSource}>
            <Crosshair size={14} />
            Go to Source
          </div>
        </div>
      )}

      <div className={`pdf-status ${pdfUrl ? 'success' : ''}`}>
        <span className="status-dot" />
        {isLoading ? 'Loading...' : pdfUrl ? `Page ${pageNum} of ${numPages}` : 'Ready'}
        {numPages > 1 && (
          <div className="page-nav">
            <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1}>←</button>
            <button onClick={() => setPageNum(p => Math.min(numPages, p + 1))} disabled={pageNum >= numPages}>→</button>
          </div>
        )}
      </div>
    </div>
  );
}
