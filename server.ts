import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory array for donation tracking
interface Donation {
  id: string;
  name: string;
  amount: number;
  message: string;
  timestamp: string;
}

// Mural de apoio. Começa vazio — será preenchido pelas mensagens reais que os
// apoiadores deixarem através do formulário. Não usamos entradas fictícias
// apresentadas como doações reais.
const recentDonations: Donation[] = [];

// Lazy initialize GoogleGenAI client to prevent crash on missing API key
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

// Endpoint to fetch recent donations
app.get('/api/donations', (req, res) => {
  res.json({
    success: true,
    donations: recentDonations,
    totals: {
      // Números baseados em dados públicos da ONG (zuzuforafrica.com): atuação em
      // Angola desde 2019, +800 refeições/dia, ~1.300 crianças atendidas.
      // NÃO usar números não verificados. Ajustar conforme dados oficiais do projeto.
      yearSince: 2019,
      mealsPerDay: 800,
      childrenAssisted: 1300,
      country: 'Angola',
    }
  });
});

// Endpoint to post a new donation
app.post('/api/donations', (req, res) => {
  const { name, amount, message } = req.body;
  if (!name || !amount) {
    return res.status(400).json({ success: false, error: 'Name and amount are required.' });
  }

  const newDonation: Donation = {
    id: Math.random().toString(36).substring(2, 11),
    name: String(name).trim() || 'Doador Anônimo',
    amount: Number(amount),
    message: String(message || '').trim() || 'Apoio ao Zuzu for Africa!',
    timestamp: new Date().toISOString(),
  };

  recentDonations.unshift(newDonation);
  if (recentDonations.length > 30) {
    recentDonations.pop();
  }

  res.json({ success: true, donation: newDonation });
});

// Endpoint to generate an AI message of hope and encouragement
app.post('/api/generate-message', async (req, res) => {
  const { topic, senderName } = req.body;
  
  const keywords = topic || 'esperança, água limpa, amor e futuro';
  const sender = senderName || 'Um apoiador';

  try {
    const ai = getAiClient();
    if (!ai) {
      // Return a warm fallback message if Gemini isn't available
      const fallbacks = [
        `Que cada sorriso dessas crianças em Angola seja um reflexo do amor e do carinho que enviamos daqui. Juntos, somos a força que transforma o amanhã!`,
        `Que a esperança alcance cada família atendida. Cada vida tocada por este projeto é uma vitória do amor e da solidariedade.`,
        `Para os voluntários e crianças do Zuzu for Africa: vocês nos ensinam o verdadeiro significado de empatia. Todo o meu apoio e carinho a essa jornada linda!`
      ];
      const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      return res.json({
        success: true,
        message: randomFallback,
        isFallback: true
      });
    }

    const prompt = `Gere uma mensagem curta (máximo 250 caracteres), altamente inspiradora, calorosa e emocionante em português, para ser exibida no quadro de apoio do projeto Zuzu for Africa. 
A mensagem deve ser enviada por "${sender}" e ser focada nos seguintes temas/palavras-chave: "${keywords}".
O tom deve ser profundamente humano, lembrando o trabalho da ONG em Angola: alimentação (mais de 800 refeições por dia), atendimento médico e odontológico, e o resgate da infância de crianças em situação de vulnerabilidade.
Evite clichês robóticos ou hashtags desnecessárias. Retorne apenas o texto da mensagem, sem aspas ou introduções.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        temperature: 0.85,
        maxOutputTokens: 150,
      }
    });

    const generatedText = response.text?.trim() || '';

    res.json({
      success: true,
      message: generatedText,
      isFallback: false
    });
  } catch (error: any) {
    console.error('Error generating AI message:', error);
    res.status(500).json({
      success: false,
      error: 'Não foi possível gerar a mensagem via IA. Mas seu apoio continua sendo imensamente valioso!'
    });
  }
});

// Setup Vite / Static Asset Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
