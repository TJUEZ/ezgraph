import { useState, useCallback } from 'react';

interface FileImportProps {
  onFileContent: (content: string, fileName: string) => void;
}

export function FileImport({ onFileContent }: FileImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    try {
      const content = await file.text();
      setFileName(file.name);
      onFileContent(content, file.name);
    } catch (error) {
      console.error('Failed to read file:', error);
    }
  }, [onFileContent]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  }, [handleFile]);

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      {fileName ? (
        <div>
          <p className="text-green-600 font-medium">✓ {fileName}</p>
          <p className="text-gray-500 text-sm mt-1">Click to replace</p>
        </div>
      ) : (
        <div>
          <p className="text-gray-600">📄 Drop .md or .txt file here</p>
          <p className="text-gray-400 text-sm mt-1">or click to browse</p>
        </div>
      )}
    </div>
  );
}
