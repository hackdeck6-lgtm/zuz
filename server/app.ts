import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { registerPixRoutes } from './routes/pix';
import { getMuralMessages, isSupabaseConfigured } from './lib/supabase';

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
    }
  }
  return aiClient;
}

export async function createApp(): Promise<express.Express> {
  const app = express();
  app.use(express.json());
  registerPixRoutes(app);

  app.get('/api/donations', async (req, res) => {
    let donations: any[] = [];
    if (isSupabaseConfigured()) {
      try {
        donations = await getMuralMessages(30);
      } catch (err: any) {
        console.error('[GET /api/donations] erro ao ler mural:', err?.message);
      }
    }
    res.json({
      success: true,
      donations,
      totals: { yearSince: 2019, mealsPerDay: 800, childrenAssisted: 1300, country: 'Angola' },
    });
  });

  // Endpoint leve para health check e para o self-ping anti-hibernação (Render free tier).
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  app.post('/api/generate-message', async (req, res) => {
    const { topic, senderName } = req.body;
    const keywords = topic || 'esperança, água limpa, amor e futuro';
    const sender = senderName || 'Um apoiador';
    try {
      const ai = getAiClient();
      if (!ai) {
        const fallbacks = [
          `Que cada sorriso dessas crianças em Angola seja um reflexo do amor e do carinho que enviamos daqui. Juntos, somos a força que transforma o amanhã!`,
          `Que a esperança alcance cada família atendida. Cada vida tocada por este projeto é uma vitória do amor e da solidariedade.`,
          `Para os voluntários e crianças do Zuzu for Africa: vocês nos ensinam o verdadeiro significado de empatia. Todo o meu apoio e carinho a essa jornada linda!`,
        ];
        return res.json({
          success: true,
          message: fallbacks[Math.floor(Math.random() * fallbacks.length)],
          isFallback: true,
        });
      }
      const prompt = `Gere uma mensagem curta (máximo 250 caracteres), altamente inspiradora, calorosa e emocionante em português, para ser exibida no quadro de apoio do projeto Zuzu for Africa.
A mensagem deve ser enviada por "${sender}" e ser focada nos seguintes temas/palavras-chave: "${keywords}".
O tom deve ser profundamente humano, lembrando o trabalho da ONG em Angola: alimentação (mais de 800 refeições por dia), atendimento médico e odontológico, e o resgate da infância de crianças em situação de vulnerabilidade.
Evite clichês robóticos ou hashtags desnecessárias. Retorne apenas o texto da mensagem, sem aspas ou introduções.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: { temperature: 0.85, maxOutputTokens: 150 },
      });
      res.json({ success: true, message: response.text?.trim() || '', isFallback: false });
    } catch (error: any) {
      console.error('Error generating AI message:', error);
      res.status(500).json({
        success: false,
        error: 'Não foi possível gerar a mensagem via IA. Mas seu apoio continua sendo imensamente valioso!',
      });
    }
  });

  // Vite / estáticos
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  return app;
}
