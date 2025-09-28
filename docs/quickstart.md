---
title: Quickstart
subtitle: Create your first inbox with the AgentMail API
slug: quickstart
description: >-
  Follow this guide to make your first AgentMail API request and create a new
  email inbox.
---

This guide will walk you through installing the AgentMail SDK, authenticating with your API key, and creating your first email inbox.

## Steps

### Get your API Key

First, you'll need an AgentMail API key. You can sign up at the link below.

<Card
  title="Get an API Key"
  icon="fa-solid fa-key"
  href="https://agentmail.to/pricing"
  target="_blank"
/>

Once you have your key, create a `.env` file in your project's root
directory and add your key to it. We recommend using environment variables to
keep your keys secure.

```ini
AGENTMAIL_API_KEY="YOUR_API_KEY"
```

### Install the SDK

Install the AgentMail SDK using your preferred package manager. We'll also
use a library to load the environment variable from the `.env` file.

Python

```bash
pip install agentmail python-dotenv
```

Node

```bash
npm install agentmail dotenv
```

### Create an inbox and send an email

Now you're ready to make your first API call. Create a new file (e.g.,
`quickstart.py` or `quickstart.ts`) and add the following code. This script
will initialize the AgentMail client, create a new inbox, and then send a
test email.

Python

```python
import os
from dotenv import load_dotenv
from agentmail import AgentMail

# Load the API key from the .env file
load_dotenv()
api_key = os.getenv("AGENTMAIL_API_KEY")

# Initialize the client
client = AgentMail(api_key=api_key)

# Create an inbox
print("Creating inbox...")
inbox = client.inboxes.create() # domain is optional
print("Inbox created successfully!")
print(inbox)
```

TypeScript

```typescript
import { AgentMailClient } from "agentmail";
import "dotenv/config"; // loads .env file

async function main() {
  // Initialize the client
  const client = new AgentMailClient({
    apiKey: process.env.AGENTMAIL_API_KEY,
  });

  // Create an inbox
  console.log("Creating inbox...");
  const inbox = await client.inboxes.create(); // domain is optional
  console.log("Inbox created successfully!");
  console.log(inbox);

  // Send an email from the new inbox
  console.log("Sending email...");
  await client.inboxes.messages.send(inbox.inbox_id, {
    to: "your-email@example.com",
    subject: "Hello from AgentMail!",
    text: "This is my first email sent with the AgentMail API.",
  });
  console.log("Email sent successfully!");
}

main();
```

Note: The `domain` parameter is optional. If not provided, AgentMail will
use the default `@agentmail.to` domain. If you would like a custom domain, please email contact@agentmail.cc

### Run the code

Execute the script from your terminal.

Python

```bash
python quickstart.py
```

Node

```bash
npx ts-node quickstart.ts
```

You should see the details of your newly created inbox printed to the
console. Congratulations, you've successfully created your first AgentMail
inbox!

## Next Steps

Congrats, you sent your first email via AgentMail. But this isn't our strength. Explore the full power of creating agents that can autonomously reply, take action, parse attachements, semantically search your inbox, by exploring our docs and tutorials below.

Note: Looking for a different language? Email us at [support@agentmail.cc](mailto:support@agentmail.cc) and we'll get you set up.
