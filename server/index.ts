import dotenv from "dotenv";
import app, { initDb } from "./app.js";
import { runPollCycle } from "./poller.js";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3030;

// Start Server and Poller
async function bootstrap() {
  await initDb();
  console.log("⚡ Database initialized.");

  app.listen(PORT, () => {
    console.log(`🚀 Crystal-Heimdall running at http://localhost:${PORT}`);
  });

  // Start 60-second synthetic polling daemon (for standalone VPS/Docker runtimes)
  setInterval(async () => {
    try {
      await runPollCycle();
    } catch (err) {
      console.error("Background poller error:", err);
    }
  }, 60 * 1000);
}

bootstrap().catch(console.error);

export { app };
export default app;
