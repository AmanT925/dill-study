import "dotenv/config";
import { AgentMailClient } from "agentmail";

async function main() {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) {
    console.error("No AGENTMAIL_API_KEY found in environment. Copy .env.example to .env and set your key.");
    process.exit(1);
  }

  // Small debug output to verify the key is loaded (we show only a prefix)
  try {
    console.log("AGENTMAIL_API_KEY loaded:", apiKey ? `${apiKey.slice(0,8)}...` : "(none)");
  } catch (e) {
    console.log("(couldn't print API key preview)");
  }

  const client = new AgentMailClient({ apiKey });

  try {
    const fromInbox = process.env.FROM_INBOX;
    let inbox;
    if (fromInbox) {
      console.log(`Using existing inbox from .env: ${fromInbox}`);
      // Try to retrieve the inbox to validate it exists
      inbox = await client.inboxes.get(fromInbox);
      console.log("Existing inbox details:", inbox);
    } else {
      console.log("Creating inbox...");
      // The SDK's create method expects a request object. Passing an explicit
      // empty object ensures the request body is valid JSON.
      inbox = await client.inboxes.create({});
      console.log("Inbox created:", inbox);
    }

    const toEmail = process.env.TO_EMAIL;
    if (!toEmail) {
      console.log("TO_EMAIL not set in .env — skipping send step. If you'd like to send a test email, set TO_EMAIL in your .env and re-run.");
      return;
    }

    console.log("Sending test email to:", toEmail);
    // Use the SDK field name `inboxId` on the returned object
    await client.inboxes.messages.send(inbox.inboxId, {
      to: toEmail,
      subject: "Hello from AgentMail (example)",
      text: "This is a test email sent by the quickstart example.",
    });
    console.log("Email sent successfully.");
  } catch (err) {
    // Print full error object (including non-enumerable props) for debugging
    try {
      console.error("Error while running quickstart example:", err);
      console.error("Full error details:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    } catch (e) {
      console.error("Error while running quickstart example (failed to stringify):", err);
    }
    process.exit(1);
  }
}

main();
