import { invoke } from '@tauri-apps/api/core';
import { useState, useCallback } from 'react';

export interface LLMConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface UseLLMReturn {
  generate: (context: string, prompt: string) => Promise<string>;
  isLoading: boolean;
  error: string | null;
}

export function useLLM(config: LLMConfig): UseLLMReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (context: string, prompt: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await invoke<string>('generate_drawio_xml_cmd', {
        request: {
          context,
          prompt,
          provider: config.provider,
          api_key: config.apiKey,
          model: config.model,
          base_url: config.baseUrl || null,
        },
      });
      return result;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  return { generate, isLoading, error };
}
