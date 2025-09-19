# Atelier CMS vivant

Ce dépôt contient un atelier de CMS personnel complet organisé en monorepo. Il regroupe l'API Node.js, l'interface d'administration React, un site public Next.js ainsi que tous les dossiers partagés nécessaires pour faire tourner la stack complète.

## Espaces inclus

- `backend/` — serveur Node.js (Express + TypeScript) qui expose une API REST, observe le système de fichiers et gère les métadonnées JSON ainsi que la génération de miniatures et la gestion du blog.
- `admin/` — interface React (Vite + Material UI) offrant une administration joyeuse avec explorateur hiérarchique, éditeurs dynamiques, page de réglages et outils complets de rédaction pour le blog.
- `site/` — site public Next.js (App Router) qui construit la navigation à partir du dossier `medias/`, fournit une route d'API interne pour diffuser médias et miniatures, affiche le blog et propose une expérience de lecture enrichie par la lightbox.
- `medias/` — racine des images/vidéos, directement synchronisée avec la structure disque. Chaque dossier peut contenir un `description.md` et les fichiers `.media-meta.json` générés par l'API y résident.
- `storage/` — stockage des métadonnées dossiers, des fiches médias, des réglages globaux (`.dossier-meta.json`, `.media-meta.json`, `settings.json`) ainsi que des contenus du blog.
- `config/` — configuration partagée (ex. `thumbnails.json`) utilisée par le service de miniatures pour calculer les différents formats.
- `thumbnails/` — dossier de sortie des miniatures générées automatiquement par le backend ; il est créé à la volée si absent.

Les métadonnées sont stockées dans `storage/.dossier-meta.json`, `medias/.media-meta.json` et `storage/settings.json`. Les descriptions longues s'écrivent dans `description.md` situé dans chaque dossier média.

## Installation rapide

```bash
npm run install
npm run dev
```

`npm run install` installe les dépendances des trois espaces (`backend`, `admin`, `site`) et `npm run dev` lance simultanément l'API Node.js, l'interface d'administration et le site Next.js grâce à `concurrently`. L'API répond par défaut sur le port `4000` et l'interface admin est accessible via Vite sur le port `5173` (proxy `/api`). Pour un build de production unifié, utilisez `npm run build` depuis la racine.

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

Le front admin communique avec l'API via `/api/*` (proxy Vite configuré) et le site Next.js lit directement l'arborescence disque pour construire navigation et galeries. Toute modification manuelle dans `medias/` est détectée par le backend (via chokidar) et reflétée dans l'UI comme dans le site public.

## Points clés

- **Pas de base de données** : les métadonnées sont sérialisées dans des fichiers JSON globaux.
- **Détection d'orphelins** : un indicateur montre les fichiers sans métadonnées et inversement.
- **Cache vivant** : l'arbre est mis en cache et invalidé automatiquement lors des changements disque.
- **Mode preview** : génération de tokens temporaires pour partager un média ou un dossier.
- **Miniatures configurables** : le backend génère, surveille et reconstruit les miniatures selon `config/thumbnails.json`, éditable depuis l'admin.
- **Blog intégré** : création, édition, catégorisation et publication d'articles, avec import direct d'images et réglages dédiés.
- **Lightbox immersive** : visualisation plein écran des médias sur le site public avec personnalisation fine (couleurs, rayons, tailles, blur) depuis les réglages.
- **Site public** : Next.js exploite `medias/` et `.media-meta.json` pour proposer navigation, vignettes, diffusion des médias originaux via `/api/media/*` et mise en avant des articles du blog.

## Scripts disponibles

### Backend
- `npm run dev` — serveur Express en mode watch (`tsx`).
- `npm run build` — compilation TypeScript vers `dist/`.
- `npm start` — exécute la version compilée.

### Admin
- `npm run dev` — Vite + React en développement.
- `npm run build` — Build de production (`tsc --noEmit` puis `vite build`).
- `npm run preview` — Aperçu du build.

### Site
- `npm run dev` — Next.js en mode développement (App Router).
- `npm run build` — Build de production Next.js.
- `npm run start` — Lancement du build en mode production.
- `npm run lint` — Vérification ESLint dédiée au site.

## Arbre API (extraits)

- `GET /api/tree` — arborescence complète fusionnant fichiers et métadonnées.
- `GET /api/folders?path=…` — dossier précis (avec `description.md` si présent).
- `PUT /api/folders/meta` — mise à jour des métadonnées dossier.
- `PUT /api/folders/description` — écriture de `description.md`.
- `POST /api/medias/move` — déplacement d'un média.
- `GET /api/orphans` — liste des fichiers/métadonnées orphelins.
- `GET /api/thumbnails` — consultation de la configuration actuelle des miniatures.
- `POST /api/thumbnails/rebuild` — régénération complète des miniatures.
- `GET /api/sitemap?baseUrl=…` — génération sitemap XML.
- `GET /api/blog/articles` — liste des articles de blog et de leurs métadonnées.
- `GET /api/blog/articles/:slug` — récupération d'un article précis.
- `POST /api/blog/articles` — création d'un article avec upload direct des images.
- `PUT /api/blog/articles/:slug` — mise à jour d'un article existant.
- `DELETE /api/blog/articles/:slug` — suppression d'un article.
- `POST /api/blog/images` — import d'une image pour le blog.
- `GET /api/blog/settings` — consultation des réglages du blog.
- `PUT /api/blog/settings` — mise à jour des réglages du blog.
- `POST /api/blog/email` — création automatisée d'article à partir d'un email (Mailgun).

## Structure par défaut

```
medias/
├── croquis/
├── peintures/
└── photographies/
```

Ces dossiers ne contiennent qu'un fichier `.gitkeep` et peuvent être remplis avec vos créations.

## Variables d'environnement utiles

Le backend accepte plusieurs variables pour adapter chemins et comportement : `MEDIA_ROOT`, `METADATA_ROOT`, `THUMBNAILS_ROOT`, `THUMBNAIL_CONFIG_FILE`, `CACHE_TTL`, `PREVIEW_SECRET` ou encore `PORT`. Toutes disposent de valeurs par défaut pointant vers ce dépôt.

---

Ce squelette est pensé pour être étendu facilement (authentification, recherche, multilingue). Amusez-vous à le faire vivre !
