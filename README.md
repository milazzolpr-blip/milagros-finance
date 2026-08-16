# Milagros Finance — progetto reale

## Avvio locale

```bash
npm install
npm run dev
```

Le chiavi Supabase sono già in `.env` (URL + anon key che mi hai dato). Se cambi progetto Supabase, aggiorna `.env` (copialo da `.env.example` se serve ricrearlo).

## Cosa funziona già, collegato a Supabase per davvero

- **Login / Registrazione** (`/login`) — Supabase Auth email+password
- **Home** (`/app`) — legge le transazioni reali del workspace, calcola saldo/bilancio/top categorie/ultime transazioni. Toggle "Questo mese / Da sempre" reale.
- **Mesi** (`/app/mesi`) — aggrega le transazioni reali per mese
- **Capitoli** (`/app/capitoli`) — legge da `capitoli_spesa`
- **Nuova transazione** (FAB / bottone `+`) — legge categorie reali da `category_mappings` e membri da `workspace_members`, scrive davvero su `transactions`
- **Impostazioni → Profilo** — dati utente reali, logout funzionante

## Cosa manca ancora (prossima sessione)

- Storico: solo il tab "Riepilogo" è collegato ai dati reali; Grafici/Categorie/Persone/Tabella/Confronto sono da portare seguendo lo stesso pattern
- Impostazioni → Workspace e Preferenze: solo placeholder
- Dettaglio mese (giorno per giorno) e dettaglio capitolo (con doppioni): nel mockup ma non ancora riportati qui
- Onboarding: se un utente non ha ancora un workspace/membership, per ora vede solo un messaggio — serve un flusso guidato di creazione workspace
- Import dei dati reali da Base44 (in attesa del file JSON esportato)
- Deploy su Netlify

## Struttura

```
src/
  lib/supabase.js          client Supabase
  contexts/AuthContext.jsx  sessione, login, signup, logout
  hooks/useWorkspace.js     carica workspace + membership dell'utente
  components/
    ui.jsx                  Header, BottomNav, FAB, Card, PillTabs (condivisi)
    Layout.jsx               shell con header/FAB/nav + Outlet
    TransactionModal.jsx     form nuova transazione, collegato a Supabase
    ProtectedRoute.jsx       redirect a /login se non autenticato
  pages/
    LoginPage.jsx
    HomePage.jsx
    MesiPage.jsx
    CapitoliPage.jsx
    StoricoPage.jsx
    AltroPage.jsx
  theme.js                  colori e helper di formattazione condivisi
```
