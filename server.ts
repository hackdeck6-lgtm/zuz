import dotenv from 'dotenv';
import { createApp } from './server/app';

dotenv.config();

const PORT = 3000;

async function main() {
  const app = await createApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main();
