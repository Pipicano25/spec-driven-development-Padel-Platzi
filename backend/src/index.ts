import { createApp } from './app.js';
import { openDb } from './db.js';
import { systemClock } from './time.js';

const port = Number(process.env.PORT ?? 3010);
const app = createApp({ db: openDb(), clock: systemClock });

app.listen(port, () => {
  console.log(`Backend de reservas escuchando en http://localhost:${port}`);
});
