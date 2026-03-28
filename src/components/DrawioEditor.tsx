import { useEffect, useRef, useState } from 'react';

interface DrawioEditorProps {
  xml: string | null;
}

const DRAWIO_URL = 'https://embed.diagrams.net/?embed=1&吸着=0&noSave=0&proto=json';

export function DrawioEditor({ xml }: DrawioEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!iframeRef.current) return;

    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      const data = event.data;
      if (data.event === 'init') {
        setIsLoaded(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (!isLoaded || !xml || !iframeRef.current) return;

    try {
      iframeRef.current.contentWindow?.postMessage({
        action: 'load',
        xml: xml,
      }, '*');
    } catch (e) {
      console.error('Failed to load XML into draw.io:', e);
    }
  }, [isLoaded, xml]);

  if (!xml) {
    return (
      <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p className="text-4xl mb-2">📊</p>
          <p>Generated diagram will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white rounded-lg overflow-hidden border border-gray-200">
      <iframe
        ref={iframeRef}
        src={DRAWIO_URL}
        className="w-full h-full"
        title="Draw.io Editor"
      />
    </div>
  );
}
