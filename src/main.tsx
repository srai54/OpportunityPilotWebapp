import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app.css'
import './styles/v5.css'
import './styles/auth-v6.css'
import { inject } from '@vercel/analytics'
import { App } from './App'

// Page views for the Vercel deployment only (the same build also runs on Render, where the script is not served).
if (__ON_VERCEL__) inject()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
