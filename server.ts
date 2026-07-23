import dotenv from 'dotenv';
import { createApp } from './server/app';

dotenv.config();

// Render (e a maioria dos hosts) injeta a porta via PORT.
const PORT = Number(process.env.PORT) || 3000;

async function main() {
  const app = await createApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main();
