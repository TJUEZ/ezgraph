import { useState, useEffect } from 'react';

export interface LLMConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onSave: (config: LLMConfig) => void;
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229'] },
  { id: 'ollama', name: 'Ollama', models: ['llama3', 'qwen2', 'codegemma', 'mistral'] },
  { id: 'groq', name: 'Groq', models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'] },
  { id: 'minimax', name: 'MiniMax', models: ['abab6.5s', 'abab6-chat'] },
  { id: 'custom', name: 'Custom (OpenAI-compatible)', models: [] },
];

export function SettingsModal({ isOpen, onClose, config, onSave }: SettingsModalProps) {
  const [localConfig, setLocalConfig] = useState<LLMConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  if (!isOpen) return null;

  const selectedProvider = PROVIDERS.find(p => p.id === localConfig.provider);

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">LLM Settings</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localConfig.provider}
              onChange={(e) => setLocalConfig({ ...localConfig, provider: e.target.value, model: '' })}
            >
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localConfig.apiKey}
              onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
              placeholder="Enter API key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            {selectedProvider?.models.length ? (
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={localConfig.model}
                onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
              >
                <option value="">Select model</option>
                {selectedProvider.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={localConfig.model}
                onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
                placeholder="Enter model name"
              />
            )}
          </div>

          {(localConfig.provider === 'ollama' || localConfig.provider === 'custom') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={localConfig.baseUrl}
                onChange={(e) => setLocalConfig({ ...localConfig, baseUrl: e.target.value })}
                placeholder={localConfig.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
