import "dotenv/config";
import { AgentMailClient } from "agentmail";

async function main() {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) {
    console.error("AGENTMAIL_API_KEY not set in environment.");
    process.exit(1);
  }

  const client = new AgentMailClient({ apiKey });

  try {
    console.log("Creating inbox dill@agentmail.to...");
    const inbox = await client.inboxes.create({ username: "dill", domain: "agentmail.to" });
    console.log("Inbox creation result:", inbox);
  } catch (err) {
    console.error("Failed to create inbox:", err);
    process.exit(1);
  }
}

main();
