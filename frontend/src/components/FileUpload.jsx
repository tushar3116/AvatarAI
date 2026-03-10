import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, X } from 'lucide-react';

const API_BASE = '/api/v1';

export default function FileUpload({ onFileIngested, collections }) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleUpload = useCallback(async (file) => {
    const id = Date.now();
    const entry = { id, name: file.name, status: 'uploading', progress: 0 };
    setFiles(prev => [entry, ...prev]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/ingest`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Upload failed');
      }

      const data = await response.json();
      setFiles(prev => prev.map(f =>
        f.id === id
          ? { ...f, status: 'success', collection: data.collection_name, chunks: data.chunks_count }
          : f
      ));

      if (onFileIngested) {
        onFileIngested(data.collection_name);
      }
    } catch (err) {
      setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'error', error: err.message } : f
      ));
    }
  }, [onFileIngested]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    droppedFiles.forEach(handleUpload);
  }, [handleUpload]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files);
    selectedFiles.forEach(handleUpload);
    e.target.value = '';
  }, [handleUpload]);

  const removeFile = useCallback((id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90 tracking-wide uppercase">Knowledge Base</h2>
        <p className="text-xs text-white/40 mt-1">Upload documents to train the avatar</p>
      </div>

      {/* Drop Zone */}
      <div className="p-4">
        <div
          className={`drop-zone p-6 flex flex-col items-center gap-3 cursor-pointer transition-all ${isDragging ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Upload className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white/80">Drop files here</p>
            <p className="text-xs text-white/40 mt-1">PDF, TXT, or Markdown</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.text,.md"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2">
        {files.map(file => (
          <div
            key={file.id}
            className="glass-card-sm p-3 flex items-center gap-3 animate-slide-up"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              file.status === 'success' ? 'bg-emerald-500/15' :
              file.status === 'error' ? 'bg-rose-500/15' :
              'bg-amber-500/15'
            }`}>
              {file.status === 'uploading' && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
              {file.status === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              {file.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/80 truncate">{file.name}</p>
              {file.status === 'success' && (
                <p className="text-xs text-emerald-400/70">{file.chunks} chunks indexed</p>
              )}
              {file.status === 'error' && (
                <p className="text-xs text-rose-400/70">{file.error}</p>
              )}
              {file.status === 'uploading' && (
                <p className="text-xs text-amber-400/70">Processing...</p>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
              className="p-1 rounded hover:bg-white/5 transition-colors"
            >
              <X className="w-3 h-3 text-white/30" />
            </button>
          </div>
        ))}
      </div>

      {/* Collections */}
      {collections.length > 0 && (
        <div className="px-4 py-3 border-t border-white/5">
          <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Available Collections</p>
          <div className="space-y-1">
            {collections.map(col => (
              <div key={col.name} className="flex items-center gap-2 text-xs">
                <FileText className="w-3 h-3 text-indigo-400" />
                <span className="text-white/60 truncate">{col.name}</span>
                <span className="text-white/30 ml-auto">{col.document_count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
