import { useState, useCallback } from 'react';
import { FileImport } from './components/FileImport';
import { ContextPreview } from './components/ContextPreview';
import { PromptInput } from './components/PromptInput';
import { DrawioEditor } from './components/DrawioEditor';
import { SettingsModal, LLMConfig } from './components/SettingsModal';
import { useLLM } from './hooks/useLLM';

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o',
  baseUrl: '',
};

function App() {
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [drawioXml, setDrawioXml] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(() => {
    const saved = localStorage.getItem('ezgraph_llm_config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  const { generate, isLoading, error } = useLLM(llmConfig);

  const handleFileContent = useCallback((content: string, name: string) => {
    setFileContent(content);
    setFileName(name);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!fileContent || !prompt) return;

    try {
      const xml = await generate(fileContent, prompt);
      setDrawioXml(xml);
    } catch (e) {
      console.error('Generation failed:', e);
    }
  }, [fileContent, prompt, generate]);

  const handleSaveConfig = useCallback((config: LLMConfig) => {
    setLlmConfig(config);
    localStorage.setItem('ezgraph_llm_config', JSON.stringify(config));
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <h1 className="text-xl font-bold text-gray-800">EzGraph</h1>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
        >
          ⚙️ Settings
        </button>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-1/3 flex flex-col gap-4 p-4 overflow-auto">
          <FileImport onFileContent={handleFileContent} />
          <ContextPreview content={fileContent} fileName={fileName} />
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleGenerate}
            disabled={isLoading || !fileContent || !prompt}
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading || !fileContent || !prompt}
            className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '⏳ Generating...' : '✨ Generate Diagram'}
          </button>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}
          <p className="text-xs text-gray-400 text-center">
            {fileName ? `Context: ${fileContent.length} chars` : 'No file loaded'}
          </p>
        </div>

        <div className="flex-1 p-4">
          <DrawioEditor xml={drawioXml} />
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={llmConfig}
        onSave={handleSaveConfig}
      />
    </div>
  );
}

export default App;
