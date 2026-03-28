import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

const SYSTEM_PROMPT = `You are a draw.io diagram generation expert. The user will provide content (context) and a requirement. Please generate draw.io XML format diagram code.

Requirements:
1. Output ONLY the XML code, no explanations or markdown code blocks
2. The XML must be valid draw.io format with proper <mxfile> root element
3. Create visually appealing and well-organized diagrams
4. Use appropriate shapes, colors, and layouts

Example format:
<mxfile>
  <diagram name="Page-1">
    <mxGraphModel dx="900" dy="600">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="2" value="Hello" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="200" y="200" width="100" height="40" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

async function callOpenAI(provider, apiKey, model, baseUrl, messages) {
  const url = `${baseUrl}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${provider} API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(apiKey, model, messages) {
  const systemMsg = messages.find(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      messages: otherMessages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      max_tokens: 4096,
      system: systemMsg?.content,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callOllama(apiKey, model, baseUrl, messages) {
  const url = `${baseUrl}/api/chat`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.message.content;
}

app.post('/api/generate', async (req, res) => {
  try {
    const { provider, apiKey, model, baseUrl, context, prompt } = req.body;

    if (!provider || !apiKey || !model || !context || !prompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const userPrompt = `## Context:\n${context}\n\n## Requirement:\n${prompt}\n\nGenerate the draw.io XML diagram:`;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    let response;

    const providerLower = provider.toLowerCase();
    const resolvedBaseUrl = baseUrl || getDefaultBaseUrl(provider);

    if (providerLower === 'anthropic') {
      response = await callAnthropic(apiKey, model, messages);
    } else if (providerLower === 'ollama') {
      response = await callOllama(apiKey, model, resolvedBaseUrl, messages);
    } else {
      // OpenAI-compatible (OpenAI, Groq, MiniMax, Custom)
      response = await callOpenAI(provider, apiKey, model, resolvedBaseUrl, messages);
    }

    // Clean up markdown code blocks if present
    let cleaned = response
      .trim()
      .replace(/^```xml\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    if (!cleaned.includes('<mxfile')) {
      throw new Error('Response does not contain valid draw.io XML');
    }

    res.json({ xml: cleaned });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

function getDefaultBaseUrl(provider) {
  const urls = {
    'openai': 'https://api.openai.com/v1',
    'groq': 'https://api.groq.com/openai/v1',
    'minimax': 'https://api.minimax.chat/v1',
  };
  return urls[provider.toLowerCase()] || 'https://api.openai.com/v1';
}

app.listen(PORT, () => {
  console.log(`EzGraph server running on http://localhost:${PORT}`);
});
