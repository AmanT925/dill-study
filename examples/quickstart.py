import os
from dotenv import load_dotenv

load_dotenv()  # reads .env
api_key = os.getenv("AGENTMAIL_API_KEY")

if not api_key:
    print("No AGENTMAIL_API_KEY found. Copy .env.example to .env and set your key.")
    raise SystemExit(1)

# The `agentmail` package is assumed to follow the quickstart contract in the docs.
try:
    from agentmail import AgentMail
except Exception as e:
    print("Could not import 'agentmail' package. Install it with: pip install agentmail")
    raise

client = AgentMail(api_key=api_key)

print("Creating inbox...")
inbox = client.inboxes.create()  # domain optional
print("Inbox created:")
print(inbox)

print("Sending a test email...")
client.inboxes.messages.send(inbox.inbox_id, {
    "to": "your-email@example.com",
    "subject": "Hello from AgentMail (example)",
    "text": "This is a test email sent by the quickstart example.",
})
print("Email sent (if no errors were raised).")
