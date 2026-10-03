## ChatPanel.jsx change (apply manually)

In `sendMessage()`, change the invoke to pass `user_id`:

```js
const { data: { session } } = await supabase.auth.getSession()

const { error: fnError } = await supabase.functions.invoke('agent-runtime', {
  body: {
    agent_slug: activeSlug,
    content: content,
    user_id: session?.user?.id ?? null,
  },
})
```

Optional — add Research Bot to the chat tabs:

```js
const ORCHESTRATORS = [
  { slug: 'brahmai', name: 'BrahmAI', badgeClass: 'brahma' },
  { slug: 'vishvai', name: 'VishvAI', badgeClass: 'vishva' },
  { slug: 'kaalai', name: 'KaalAI', badgeClass: 'kaal' },
  { slug: 'research-bot', name: 'Research Bot', badgeClass: 'vishva' },
]
```
