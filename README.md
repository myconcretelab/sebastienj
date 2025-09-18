# Atelier CMS vivant

Ce dépôt contient un atelier de CMS personnel complet organisé en monorepo. Il regroupe l'API Node.js, l'interface d'administration React, un site public Next.js ainsi que tous les dossiers partagés nécessaires pour faire tourner la stack complète.

## Espaces inclus

- `backend/` — serveur Node.js (Express + TypeScript) qui expose une API REST, observe le système de fichiers et gère les métadonnées JSON ainsi que la génération de miniatures.【F:backend/src/routes/api.ts†L9-L237】【F:backend/src/services/ThumbnailService.ts†L1-L139】
- `admin/` — interface React (Vite + Material UI) offrant une administration joyeuse avec explorateur hiérarchique, éditeurs dynamiques et page de réglages. Le serveur de dev Vite est préconfiguré pour proxifier `/api` vers le backend.【F:admin/src/pages/SettingsPage.tsx†L33-L216】【F:admin/vite.config.ts†L1-L15】
- `site/` — site public Next.js (App Router) qui construit la navigation à partir du dossier `medias/` et du fichier `.media-meta.json`, et fournit une route d'API interne pour diffuser médias et miniatures.【F:site/lib/mediaTree.ts†L1-L98】【F:site/lib/mediaMetadata.ts†L1-L39】【F:site/app/api/media/[...path]/route.ts†L1-L44】
- `medias/` — racine des images/vidéos, directement synchronisée avec la structure disque. Chaque dossier peut contenir un `description.md` et les fichiers `.media-meta.json` générés par l'API y résident.【F:backend/src/config.ts†L10-L24】
- `storage/` — stockage des métadonnées dossiers, des fiches médias et des réglages globaux (`.dossier-meta.json`, `.media-meta.json`, `settings.json`).【F:backend/src/config.ts†L10-L24】
- `config/` — configuration partagée (ex. `thumbnails.json`) utilisée par le service de miniatures pour calculer les différents formats.【F:config/thumbnails.json†L1-L10】【F:backend/src/services/ThumbnailService.ts†L1-L104】
- `thumbnails/` — dossier de sortie des miniatures générées automatiquement par le backend ; il est créé à la volée si absent.【F:backend/src/services/ThumbnailService.ts†L32-L87】

Les métadonnées sont stockées dans `storage/.dossier-meta.json`, `medias/.media-meta.json` et `storage/settings.json`. Les descriptions longues s'écrivent dans `description.md` situé dans chaque dossier média.【F:backend/src/config.ts†L16-L24】

## Installation rapide

```bash
npm run install
npm run dev
```

`npm run install` installe les dépendances des trois espaces (`backend`, `admin`, `site`) et `npm run dev` lance simultanément l'API Node.js, l'interface d'administration et le site Next.js grâce à `concurrently`.【F:package.json†L5-L17】 L'API répond par défaut sur le port `4000` et l'interface admin est accessible via Vite sur le port `5173` (proxy `/api`).【F:backend/src/server.ts†L26-L36】【F:admin/vite.config.ts†L6-L15】 Pour un build de production unifié, utilisez `npm run build` depuis la racine.【F:package.json†L10-L14】

### Installation manuelle (alternative)

```bash
# Lancer l'API en mode watch
cd backend
npm install
npm run dev

# Lancer l'interface d'administration
cd ../admin
npm install
npm run dev

# Lancer le site public
cd ../site
npm install
npm run dev
```

Le front admin communique avec l'API via `/api/*` (proxy Vite configuré) et le site Next.js lit directement l'arborescence disque pour construire navigation et galeries. Toute modification manuelle dans `medias/` est détectée par le backend (via chokidar) et reflétée dans l'UI comme dans le site public.【F:admin/vite.config.ts†L6-L15】【F:site/lib/mediaTree.ts†L1-L98】【F:backend/src/services/ThumbnailService.ts†L1-L87】

## Points clés

- **Pas de base de données** : les métadonnées sont sérialisées dans des fichiers JSON globaux.【F:backend/src/config.ts†L16-L24】
- **Détection d'orphelins** : un indicateur montre les fichiers sans métadonnées et inversement.【F:backend/src/routes/api.ts†L9-L237】
- **Cache vivant** : l'arbre est mis en cache et invalidé automatiquement lors des changements disque.【F:backend/src/services/ThumbnailService.ts†L51-L116】
- **Mode preview** : génération de tokens temporaires pour partager un média ou un dossier.【F:backend/src/routes/api.ts†L118-L179】
- **Miniatures configurables** : le backend génère, surveille et reconstruit les miniatures selon `config/thumbnails.json`, éditable depuis l'admin.【F:config/thumbnails.json†L1-L10】【F:backend/src/services/ThumbnailService.ts†L18-L139】【F:admin/src/pages/SettingsPage.tsx†L189-L214】
- **Site public** : Next.js exploite `medias/` et `.media-meta.json` pour proposer navigation, vignettes et diffusion des médias originaux via `/api/media/*`.【F:site/lib/mediaTree.ts†L1-L98】【F:site/lib/mediaMetadata.ts†L1-L39】【F:site/app/api/media/[...path]/route.ts†L1-L44】

## Scripts disponibles

### Backend
- `npm run dev` — serveur Express en mode watch (`tsx`).【F:backend/package.json†L6-L10】
- `npm run build` — compilation TypeScript vers `dist/`.【F:backend/package.json†L6-L10】
- `npm start` — exécute la version compilée.【F:backend/package.json†L6-L10】

### Admin
- `npm run dev` — Vite + React en développement.【F:admin/package.json†L6-L12】
- `npm run build` — Build de production (`tsc --noEmit` puis `vite build`).【F:admin/package.json†L6-L12】
- `npm run preview` — Aperçu du build.【F:admin/package.json†L6-L12】

### Site
- `npm run dev` — Next.js en mode développement (App Router).【F:site/package.json†L6-L14】
- `npm run build` — Build de production Next.js.【F:site/package.json†L6-L14】
- `npm run start` — Lancement du build en mode production.【F:site/package.json†L6-L14】
- `npm run lint` — Vérification ESLint dédiée au site.【F:site/package.json†L6-L14】

## Arbre API (extraits)

- `GET /api/tree` — arborescence complète fusionnant fichiers et métadonnées.【F:backend/src/routes/api.ts†L33-L70】
- `GET /api/folders?path=…` — dossier précis (avec `description.md` si présent).【F:backend/src/routes/api.ts†L71-L117】
- `PUT /api/folders/meta` — mise à jour des métadonnées dossier.【F:backend/src/routes/api.ts†L180-L210】
- `PUT /api/folders/description` — écriture de `description.md`.【F:backend/src/routes/api.ts†L86-L117】
- `POST /api/medias/move` — déplacement d'un média.【F:backend/src/routes/api.ts†L211-L237】
- `GET /api/orphans` — liste des fichiers/métadonnées orphelins.【F:backend/src/routes/api.ts†L9-L70】
- `GET /api/thumbnails` — consultation de la configuration actuelle des miniatures.【F:backend/src/routes/api.ts†L217-L237】
- `POST /api/thumbnails/rebuild` — régénération complète des miniatures.【F:backend/src/routes/api.ts†L217-L237】
- `GET /api/sitemap?baseUrl=…` — génération sitemap XML.【F:backend/src/routes/api.ts†L33-L117】

## Structure par défaut

```
medias/
├── croquis/
├── peintures/
└── photographies/
```

Ces dossiers ne contiennent qu'un fichier `.gitkeep` et peuvent être remplis avec vos créations.

## Variables d'environnement utiles

Le backend accepte plusieurs variables pour adapter chemins et comportement : `MEDIA_ROOT`, `METADATA_ROOT`, `THUMBNAILS_ROOT`, `THUMBNAIL_CONFIG_FILE`, `CACHE_TTL`, `PREVIEW_SECRET` ou encore `PORT`. Toutes disposent de valeurs par défaut pointant vers ce dépôt.【F:backend/src/config.ts†L10-L33】

---

Ce squelette est pensé pour être étendu facilement (authentification, recherche, multilingue). Amusez-vous à le faire vivre !
