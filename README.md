# Atelier CMS vivant

Ce dépôt contient une base complète pour un mini CMS personnel organisé autour de trois espaces :

- `backend/` — serveur Node.js (Express + TypeScript) qui expose une API REST pour naviguer dans l'arborescence, gérer les métadonnées JSON et manipuler les fichiers du dossier `medias/`.
- `admin/` — interface React (Vite + Material UI) offrant une administration joyeuse avec explorateur hiérarchique, éditeurs dynamiques et page de réglages.
- `medias/` — racine des images/vidéos, directement synchronisée avec la structure disque.

Les métadonnées sont stockées dans `storage/.dossier-meta.json`, `storage/.media-meta.json` et `storage/settings.json`. Les descriptions longues s'écrivent dans `description.md` situé dans chaque dossier média.

## Installation rapide

```bash
npm run install
npm run dev
```

`npm run install` installe les dépendances des trois espaces (`backend`, `admin`, `site`) et `npm run dev` lance simultanément l'API Node.js ainsi que les deux interfaces (admin & site) en mode développement. Pour un build de production unifié, utilisez `npm run build` depuis la racine.

### Installation manuelle (alternative)

```bash
# Lancer l'API
cd backend
npm install
npm run dev

# Lancer l'interface d'administration
cd ../admin
npm install
npm run dev
```

Le front communique avec l'API via `/api/*` (proxy Vite configuré). La structure du disque est l'unique source de vérité : toute modification manuelle dans `medias/` est détectée par le backend (via chokidar) et reflétée dans l'UI.

## Points clés

- **Pas de base de données** : les métadonnées sont sérialisées dans des fichiers JSON globaux.
- **Détection d'orphelins** : un indicateur montre les fichiers sans métadonnées et inversement.
- **Cache vivant** : l'arbre est mis en cache et invalidé automatiquement lors des changements disque.
- **Mode preview** : génération de tokens temporaires pour partager un média ou un dossier.
- **Personnalisation** : page de réglages pour définir les types d'attributs autorisés et la palette visuelle.

## Scripts disponibles

### Backend
- `npm run dev` — serveur Express en mode watch (`tsx`).
- `npm run build` — compilation TypeScript vers `dist/`.
- `npm start` — exécute la version compilée.

### Frontend
- `npm run dev` — Vite + React en développement.
- `npm run build` — Build de production (`tsc -b` puis `vite build`).
- `npm run preview` — Aperçu du build.

## Arbre API (extraits)

- `GET /api/tree` — arborescence complète fusionnant fichiers et métadonnées.
- `GET /api/folders?path=…` — dossier précis (avec description.md si présent).
- `PUT /api/folders/meta` — mise à jour des métadonnées dossier.
- `PUT /api/folders/description` — écriture de `description.md`.
- `POST /api/medias/move` — déplacement d'un média.
- `GET /api/orphans` — liste des fichiers/métadonnées orphelins.
- `GET /api/sitemap?baseUrl=…` — génération sitemap XML.

## Structure par défaut

```
medias/
├── croquis/
├── peintures/
└── photographies/
```

Ces dossiers ne contiennent qu'un fichier `.gitkeep` et peuvent être remplis avec vos créations.

---

Ce squelette est pensé pour être étendu facilement (authentification, recherche, multilingue). Amusez-vous à le faire vivre !
