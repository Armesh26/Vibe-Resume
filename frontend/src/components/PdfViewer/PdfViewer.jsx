import { FileText, Download, ZoomIn, ZoomOut } from 'lucide-react';
import './PdfViewer.css';

export default function PdfViewer({ pdfUrl, onDownload }) {
  return (
    <div className="pdf-viewer">
      <div className="pdf-header">
        <div className="pdf-title">
          <FileText size={16} />
          Preview
        </div>
        <div className="pdf-controls">
          {pdfUrl && (
            <button onClick={onDownload} className="download-btn" title="Download PDF">
              <Download size={16} />
              Download
            </button>
          )}
        </div>
      </div>

      <div className="pdf-content">
        {pdfUrl ? (
          <iframe 
            src={`${pdfUrl}#zoom=page-width&toolbar=0`}
            title="PDF Preview"
            className="pdf-iframe"
          />
        ) : (
          <div className="pdf-placeholder">
            <FileText size={48} />
            <p>Chat with AI to generate your resume</p>
          </div>
        )}
      </div>

      <div className="pdf-status success">
        <span className="status-dot" />
        Ready
      </div>
    </div>
  );
}
