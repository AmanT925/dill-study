## Project info
The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)



## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## AI Problem Splitting (Gemini)

Optional: enable AI-based problem segmentation of uploaded PDFs using Google Gemini.

1. Get an API key from Google AI Studio.
2. Create a `.env.local` (not committed) with:
	```bash
	VITE_GEMINI_API_KEY=your_key_here
	```
3. Restart dev server.

If the key is absent or the model call fails, the app falls back to a local heuristic parser.


## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/fb1f8a8d-156a-49ac-bd1c-5b3af28e60d9) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
