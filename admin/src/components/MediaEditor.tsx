import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Chip,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteForeverRounded';
import SaveIcon from '@mui/icons-material/SaveRounded';
import EditIcon from '@mui/icons-material/EditRounded';
import { MediaNode, Settings } from '../api/types.js';
import { AttributeEditor } from './AttributeEditor.js';

interface Props {
  media: MediaNode;
  settings: Settings;
  onSaveMetadata: (metadata: Partial<MediaNode>) => Promise<void> | void;
  onRename: (nextName: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onClose?: () => void;
}

const buildMediaUrl = (input?: string) => {
  if (!input) return undefined;
  if (input.startsWith('/api/media')) return input;
  const isAbsolute = /^(?:[a-z]+:)?\/\//i.test(input) || input.startsWith('data:') || input.startsWith('blob:');
  if (isAbsolute) return input;
  const normalized = input.startsWith('/') ? input : `/${input}`;
  return `/api/media${normalized}`;
};

export const MediaEditor: React.FC<Props> = ({ media, settings, onSaveMetadata, onRename, onDelete, onClose }) => {
  const [title, setTitle] = useState(media.title || '');
  const [tags, setTags] = useState(media.tags?.join(', ') || '');
  const [visibility, setVisibility] = useState(media.visibility !== 'private');
  const [description, setDescription] = useState(media.description || '');
  const [attributes, setAttributes] = useState(media.attributes || {});
  const [fileName, setFileName] = useState(media.name);
  const [message, setMessage] = useState<string | undefined>();
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [isSaving, setSaving] = useState(false);

  const orientationLabel =
    media.orientation === 'horizontal'
      ? 'Paysage'
      : media.orientation === 'vertical'
      ? 'Portrait'
      : media.orientation === 'square'
      ? 'Carré'
      : undefined;

  const formatBytes = (bytes: number) => {
    if (!bytes) return '';
    const units = ['o', 'Ko', 'Mo', 'Go'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
  };

  useEffect(() => {
    setTitle(media.title || '');
    setTags(media.tags?.join(', ') || '');
    setVisibility(media.visibility !== 'private');
    setDescription(media.description || '');
    setAttributes(media.attributes || {});
    setFileName(media.name);
    setMessage(undefined);
  }, [media]);

  const report = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(undefined);
    try {
      await onSaveMetadata({
        title,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        visibility: visibility ? 'public' : 'private',
        description,
        attributes
      } as any);
      if (onClose) {
        onClose();
      } else {
        report('Mise à jour enregistrée 🌟');
      }
    } catch (error) {
      report((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async () => {
    const trimmed = fileName.trim();
    if (!trimmed || trimmed === media.name) return;
    try {
      await onRename(trimmed);
      setFileName(trimmed);
      report(`Renommé en ${trimmed}`);
    } catch (error) {
      report((error as Error).message, 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete();
      report('Média supprimé 🌙');
    } catch (error) {
      report((error as Error).message, 'error');
    }
  };

  const previewPath = useMemo(() => {
    const thumbnails = media.thumbnails && Object.keys(media.thumbnails).length > 0 ? media.thumbnails : undefined;
    const primaryThumbnail = thumbnails?.thumb ?? (thumbnails ? Object.values(thumbnails)[0] : undefined);
    if (primaryThumbnail?.defaultPath) {
      return primaryThumbnail.defaultPath;
    }
    if (media.variants && media.variants.length > 0) {
      const variant = media.variants.find((item) => item.format === 'original') ?? media.variants[0];
      return variant.path;
    }
    return media.path;
  }, [media]);

  const mediaUrl = useMemo(() => buildMediaUrl(previewPath), [previewPath]);

  return (
    <Stack spacing={3} sx={{ height: '100%' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">{media.title || media.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {media.path}
          </Typography>
          <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
            <Chip label={media.mimeType || 'type inconnu'} size="small" />
            {media.width && media.height && (
              <Chip label={`${media.width}×${media.height}`} size="small" variant="outlined" />
            )}
            {orientationLabel && <Chip label={orientationLabel} size="small" variant="outlined" />}
            {media.variants?.map((variant) => (
              <Chip key={variant.path} label={`${variant.format}`} size="small" variant="outlined" />
            ))}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={isSaving ? <CircularProgress color="inherit" size={18} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={handleDelete}>
            Supprimer
          </Button>
        </Stack>
      </Stack>

      {message && <Alert severity={messageType}>{message}</Alert>}

      <Box
        sx={{
          display: 'flex',
          flex: 1,
          gap: 3,
          flexDirection: { xs: 'column', md: 'row' },
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            flex: { xs: '1 1 auto', md: '1 1 50%' },
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          {mediaUrl ? (
            <Box
              component="img"
              src={mediaUrl}
              alt={media.title || media.name}
              sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Aucun aperçu disponible
            </Typography>
          )}
        </Box>

        <Stack
          spacing={3}
          sx={{
            flex: { xs: '1 1 auto', md: '1 1 50%' },
            minHeight: 0,
            maxHeight: '100%',
            overflowY: 'auto',
            pr: { md: 1 }
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField label="Titre" value={title} onChange={(event) => setTitle(event.target.value)} sx={{ flex: 1 }} />
            <TextField
              label="Tags"
              helperText="Séparés par des virgules"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              sx={{ flex: 1 }}
            />
          </Stack>

          <FormControlLabel
            control={<Switch checked={visibility} onChange={(event) => setVisibility(event.target.checked)} />}
            label={visibility ? 'Visible' : 'Masqué'}
          />

          <TextField
            label="Description brève"
            multiline
            minRows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />

          <Divider sx={{ borderStyle: 'dashed' }} />

          {media.thumbnails && Object.keys(media.thumbnails).length > 0 && (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Miniatures générées
              </Typography>
              <Stack spacing={1.5}>
                {Object.entries(media.thumbnails).map(([name, thumb]) => {
                  const totalSize = thumb.sources.reduce((sum, source) => sum + (source.size ?? 0), 0);
                  return (
                    <Stack
                      key={name}
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1}
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip label={name} color="primary" size="small" />
                        {thumb.width && thumb.height && (
                          <Chip label={`${thumb.width}×${thumb.height}`} size="small" variant="outlined" />
                        )}
                        {thumb.sources.map((source) => (
                          <Chip
                            key={`${name}-${source.format}`}
                            label={source.format}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                        {totalSize > 0 && <Chip label={formatBytes(totalSize)} size="small" />}
                      </Stack>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>
          )}

          {media.thumbnails && Object.keys(media.thumbnails).length > 0 && (
            <Divider sx={{ borderStyle: 'dashed' }} />
          )}

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Attributs
            </Typography>
            <AttributeEditor attributes={attributes} settings={settings} onChange={setAttributes} />
          </Box>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <TextField
              label="Nom du fichier"
              helperText="Inclure l'extension (ex. .jpg)"
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              size="small"
              sx={{ flex: 1 }}
            />
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleRename}
              disabled={!fileName.trim() || fileName.trim() === media.name}
            >
              Renommer le fichier
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
};
