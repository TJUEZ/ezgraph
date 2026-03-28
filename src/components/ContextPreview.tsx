interface ContextPreviewProps {
  content: string;
  fileName: string | null;
}

export function ContextPreview({ content, fileName }: ContextPreviewProps) {
  if (!fileName) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 h-full flex items-center justify-center">
        <p className="text-gray-400">Import a file to see content</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 h-full overflow-auto">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-gray-700">{fileName}</span>
      </div>
      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono">
        {content.length > 2000 ? content.slice(0, 2000) + '...' : content}
      </pre>
      {content.length > 2000 && (
        <p className="text-xs text-gray-400 mt-2">Content truncated (max 2000 chars shown)</p>
      )}
    </div>
  );
}
