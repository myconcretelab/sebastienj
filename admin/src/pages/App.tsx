import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Snackbar,
  Stack,
  Typography
} from '@mui/material';
import { Routes, Route } from 'react-router-dom';
import { useTree, useSettings, api, useAdminSession } from '../api/client.js';
import { Toolbar } from '../components/Toolbar.js';
import { ExplorerView } from '../components/ExplorerView.js';
import { FolderEditor } from '../components/FolderEditor.js';
import { MediaGrid } from '../components/MediaGrid.js';
import { MediaEditor } from '../components/MediaEditor.js';
import { SettingsPage } from './SettingsPage.js';
import { StaticPagesPage } from './StaticPagesPage.js';
import { BlogPage } from './BlogPage.js';
import { SelectionProvider, useSelection } from '../state/SelectionContext.js';
import { FolderNode, MediaNode, Settings } from '../api/types.js';
import { LoginPage } from './LoginPage.js';

const findFolder = (root: FolderNode, path: string): FolderNode | undefined => {
  if (!path || root.path === path) return root;
  for (const child of root.children) {
    if (child.type === 'folder') {
      const found = findFolder(child, path);
      if (found) return found;
    }
  }
  return undefined;
};

const AdminView: React.FC<{ tree: FolderNode; settings: Settings }> = ({ tree, settings }) => {
  const {
    folderPath,
    mediaPath,
    mediaPaths,
    setFolderPath,
    setMediaPath,
    setMediaSelection,
    updateMediaPositions
  } = useSelection();
  const [isFolderEditorOpen, setFolderEditorOpen] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const dragCounter = useRef(0);
  const [uploadFeedback, setUploadFeedback] = useState<{
    message: string;
    severity: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    if (folderPath === undefined || folderPath === null) {
      setFolderPath(tree.path || '');
    }
  }, [folderPath, setFolderPath, tree.path]);

  const currentFolder = useMemo(() => findFolder(tree, folderPath) || tree, [tree, folderPath]);
  const medias = useMemo(() => currentFolder.children.filter((child): child is MediaNode => child.type === 'media'), [
    currentFolder
  ]);
  const selectedMedia = medias.find((media) => media.path === mediaPath);
  const currentFolderLabel = currentFolder.path ? currentFolder.path : 'la racine';

  const handleCreateFolder = async (path: string) => {
    await api.createFolder(path);
    await api.refreshTree();
  };

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const items = event.dataTransfer?.items;
    if (!items || !Array.from(items).some((item) => item.kind === 'file')) return;
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current += 1;
    setDropActive(true);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const items = event.dataTransfer?.items;
    if (!items || !Array.from(items).some((item) => item.kind === 'file')) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!dropActive) return;
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) {
      setDropActive(false);
    }
  }, [dropActive]);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounter.current = 0;
      setDropActive(false);

      const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith('image/'));
      if (!files.length) {
        setUploadFeedback({ severity: 'info', message: 'Aucun fichier image détecté.' });
        return;
      }

      setUploading(true);
      try {
        await api.uploadMedias(currentFolder.path ?? '', files);
        setUploadFeedback({
          severity: 'success',
          message:
            files.length > 1
              ? `${files.length} images importées avec succès dans ${currentFolderLabel}.`
              : `Image importée avec succès dans ${currentFolderLabel}.`
        });
      } catch (error) {
        setUploadFeedback({
          severity: 'error',
          message: error instanceof Error ? error.message : 'Le téléversement a échoué.'
        });
      } finally {
        setUploading(false);
      }
    },
    [currentFolder.path, currentFolderLabel]
  );

  const handleMoveMedias = useCallback(
    async (mediaList: string[], destinationFolder: string) => {
      if (mediaList.length === 0) return;
      const normalizedDestination = destinationFolder.trim().replace(/^\/+/, '');
      const destinationLabel = normalizedDestination || 'la racine';

      const movedPaths: string[] = [];
      const failures: string[] = [];

      for (const mediaPathCandidate of mediaList) {
        const normalizedMedia = mediaPathCandidate.trim().replace(/^\/+/, '');
        if (!normalizedMedia) continue;

        const segments = normalizedMedia.split('/');
        const fileName = segments.pop();
        if (!fileName) {
          failures.push(mediaPathCandidate);
          continue;
        }
        const sourceFolder = segments.join('/');

        if (sourceFolder === normalizedDestination) {
          const nextPath = normalizedDestination ? `${normalizedDestination}/${fileName}` : fileName;
          movedPaths.push(nextPath);
          continue;
        }

        try {
          await api.moveMedia(normalizedMedia, normalizedDestination);
          const nextPath = normalizedDestination ? `${normalizedDestination}/${fileName}` : fileName;
          movedPaths.push(nextPath);
        } catch (error) {
          failures.push(normalizedMedia);
        }
      }

      if (failures.length === mediaList.length) {
        setUploadFeedback({
          severity: 'error',
          message: "Impossible de déplacer les éléments sélectionnés."
        });
        return;
      }

      if (movedPaths.length > 0) {
        if (failures.length > 0) {
          setUploadFeedback({
            severity: 'info',
            message: `${movedPaths.length} image(s) déplacée(s) vers ${destinationLabel}, ${failures.length} échec(s).`
          });
        } else {
          setUploadFeedback({
            severity: 'success',
            message:
              movedPaths.length === 1
                ? `Image déplacée vers ${destinationLabel}.`
                : `${movedPaths.length} images déplacées vers ${destinationLabel}.`
          });
        }
        await api.refreshTree();
        updateMediaPositions(folderPath, mediaList, movedPaths);
      }
    },
    [folderPath, setUploadFeedback, updateMediaPositions]
  );

  const handleReorderMedias = useCallback(
    async (order: string[]) => {
      const folderPath = currentFolder.path ?? '';
      const folderDisplayName = currentFolder.title || currentFolder.name;
      try {
        await api.orderMedias(folderPath, order);
        setUploadFeedback({
          severity: 'success',
          message: `Ordre mis à jour pour ${folderDisplayName}.`
        });
      } catch (error) {
        setUploadFeedback({
          severity: 'error',
          message: error instanceof Error ? error.message : 'Impossible de réordonner les images.'
        });
      }
    },
    [currentFolder.path, currentFolder.title, currentFolder.name]
  );

  const handleFeedbackClose = useCallback((_: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setUploadFeedback(null);
  }, []);

  return (
    <Stack
      sx={{ height: '100vh', position: 'relative' }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Toolbar
        onRefresh={() => api.refreshTree()}
        onNewFolder={() => {
          const name = window.prompt('Nom du dossier à créer dans la racine ?');
          if (name) handleCreateFolder(name.trim());
        }}
        title={currentFolder.title || currentFolder.name}
      />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Box sx={{ width: 320, borderRight: '1px solid rgba(111,137,166,0.2)', p: 3, overflowY: 'auto' }}>
          <ExplorerView
            tree={tree}
            selectedPath={currentFolder.path ?? ''}
            onSelect={(path) => setFolderPath(path)}
            onCreateFolder={handleCreateFolder}
            onEditFolder={() => setFolderEditorOpen(true)}
            onMoveMedias={handleMoveMedias}
          />
        </Box>
        <Divider orientation="vertical" flexItem variant="middle" />
        <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }}>
          <Stack spacing={4}>
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Médias ({medias.length})
              </Typography>
              <MediaGrid
                medias={medias}
                selectedPaths={mediaPaths}
                primarySelectedPath={mediaPath}
                onSelectionChange={(paths, primary) => setMediaSelection(paths, primary)}
                onReorder={handleReorderMedias}
              />
            </Box>

            {mediaPaths.length === 1 && selectedMedia && (
              <MediaEditor
                media={selectedMedia}
                settings={settings}
                onSaveMetadata={(metadata) => api.saveMediaMeta(selectedMedia.path, metadata)}
                onRename={(nextName) => api.renameMedia(selectedMedia.path, nextName)}
                onMove={(destination) => handleMoveMedias([selectedMedia.path], destination)}
                onDelete={async () => {
                  await api.deleteMedia(selectedMedia.path);
                  setMediaPath(undefined);
                }}
              />
            )}
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          pointerEvents: dropActive || isUploading ? 'auto' : 'none',
          position: 'fixed',
          inset: 0,
          display: dropActive || isUploading ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(14, 30, 37, 0.55)',
          backdropFilter: 'blur(2px)',
          zIndex: (theme) => theme.zIndex.modal - 1
        }}
      >
        <Box
          sx={{
            border: '2px dashed rgba(255,255,255,0.6)',
            borderRadius: 4,
            px: 6,
            py: 4,
            textAlign: 'center',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            backgroundColor: 'rgba(9, 30, 66, 0.4)'
          }}
        >
          <Typography variant="h6">Déposez vos images</Typography>
          <Typography variant="body2">Elles seront importées dans {currentFolderLabel}.</Typography>
          {isUploading && <CircularProgress color="inherit" size={28} sx={{ alignSelf: 'center', mt: 1 }} />}
        </Box>
      </Box>

      <Dialog open={isFolderEditorOpen} onClose={() => setFolderEditorOpen(false)} maxWidth="md" fullWidth scroll="paper">
        <DialogTitle>Édition du dossier</DialogTitle>
        <DialogContent dividers sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <FolderEditor
            folder={currentFolder}
            settings={settings}
            onSaveMetadata={(metadata) => api.saveFolderMeta(currentFolder.path, metadata)}
            onSaveDescription={(markdown) => api.saveFolderDescription(currentFolder.path, markdown)}
            onRename={currentFolder.path ? (nextName) => api.renameFolder(currentFolder.path, nextName) : undefined}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderEditorOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {uploadFeedback && (
        <Snackbar
          open
          autoHideDuration={6000}
          onClose={handleFeedbackClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleFeedbackClose} severity={uploadFeedback.severity} sx={{ width: '100%' }}>
            {uploadFeedback.message}
          </Alert>
        </Snackbar>
      )}
    </Stack>
  );
};

const AppRoutes: React.FC = () => {
  const { data: tree, error: treeError } = useTree();
  const { data: settings, error: settingsError } = useSettings();

  if (treeError || settingsError) {
    return (
      <Box sx={{ p: 6 }}>
        <Typography variant="h6">Une erreur est survenue. {treeError?.message || settingsError?.message}</Typography>
      </Box>
    );
  }

  if (!tree || !settings) {
    return (
      <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<AdminView tree={tree} settings={settings} />} />
      <Route path="/pages" element={<StaticPagesPage />} />
      <Route path="/settings" element={<SettingsPage settings={settings} />} />
      <Route path="/blog" element={<BlogPage />} />
    </Routes>
  );
};

const App: React.FC = () => {
  const {
    data: session,
    isLoading,
    error: sessionError,
    mutate: refreshSession
  } = useAdminSession();

  if (sessionError) {
    return (
      <Box sx={{ p: 6 }}>
        <Alert severity="error">Impossible de vérifier la session administrateur.</Alert>
      </Box>
    );
  }

  if (isLoading || !session) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session.authenticated) {
    return <LoginPage onSuccess={() => refreshSession()} />;
  }

  return (
    <SelectionProvider>
      <AppRoutes />
    </SelectionProvider>
  );
};

export default App;
