# AI Agents Dashboard (BrahmAI • VishvAI • KaalAI)

React + Vite dashboard connected to Supabase.

## Setup

1. Open `src/supabase.js` and replace:
   - `YOUR_SUPABASE_URL`
   - `YOUR_SUPABASE_ANON_KEY`

2. Open `vite.config.js` and change the `base` value to match your GitHub repository name:
   ```js
   base: '/your-repo-name/',
   ```

## Local Development

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

```bash
npm install
npm run deploy
```

Then go to your GitHub repository → Settings → Pages and set the source to the `gh-pages` branch.

Your site will be available at:
`https://YOUR_USERNAME.github.io/your-repo-name/`
