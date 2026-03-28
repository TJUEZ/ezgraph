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

const API_URL = 'http://localhost:3001/api/generate';

export function useLLM(config: LLMConfig): UseLLMReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (context: string, prompt: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: config.provider,
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl || undefined,
          context,
          prompt,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Generation failed');
      }

      const data = await response.json();
      return data.xml;
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
