import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app/base.css'
import './styles/app/layout.css'
import './styles/app/accounts.css'
import './styles/app/screens.css'
import './styles/app/features.css'
import './styles/app/refinements.css'
import './styles/app/find-drawer.css'
import './styles/v5.css'
import './styles/auth-v6.css'
import { inject } from '@vercel/analytics'
import { App } from './App'
import { installErrorReporter } from './lib/errorReporter'

// Page views for the Vercel deployment only (the same build also runs on Render, where the script is not served).
if (__ON_VERCEL__) inject()
installErrorReporter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
