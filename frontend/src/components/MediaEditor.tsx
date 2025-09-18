import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMoveRounded';
import PreviewIcon from '@mui/icons-material/VisibilityRounded';
import EditIcon from '@mui/icons-material/EditRounded';
import { MediaNode, Settings } from '../api/types.js';
import { AttributeEditor } from './AttributeEditor.js';
import { api } from '../api/client.js';

interface Props {
  media: MediaNode;
  settings: Settings;
  onSaveMetadata: (metadata: Partial<MediaNode>) => Promise<void> | void;
  onRename: (nextName: string) => Promise<void> | void;
  onMove: (destination: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}

export const MediaEditor: React.FC<Props> = ({ media, settings, onSaveMetadata, onRename, onMove, onDelete }) => {
  const [title, setTitle] = useState(media.title || '');
  const [tags, setTags] = useState(media.tags?.join(', ') || '');
  const [visibility, setVisibility] = useState(media.visibility !== 'private');
  const [description, setDescription] = useState(media.description || '');
  const [attributes, setAttributes] = useState(media.attributes || {});
  const [renameValue, setRenameValue] = useState(media.name);
  const [destination, setDestination] = useState('');
  const [message, setMessage] = useState<string | undefined>();
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [previewSecret, setPreviewSecret] = useState('');
  const [previewToken, setPreviewToken] = useState<string | null>(null);

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
    setRenameValue(media.name);
    setPreviewToken(null);
  }, [media]);

  const report = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
  };

  const handleSave = async () => {
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
      report('Mise à jour enregistrée 🌟');
    } catch (error) {
      report((error as Error).message, 'error');
    }
  };

  const handleRename = async () => {
    if (!renameValue || renameValue === media.name) return;
    try {
      await onRename(renameValue);
      report(`Renommé en ${renameValue}`);
    } catch (error) {
      report((error as Error).message, 'error');
    }
  };

  const handleMove = async () => {
    if (!destination) return;
    try {
      await onMove(destination);
      report(`Déplacé vers ${destination}`);
      setDestination('');
    } catch (error) {
      report((error as Error).message, 'error');
    }
  };

  const requestPreview = async () => {
    if (!previewSecret) return;
    try {
      const token = await api.requestPreview(previewSecret, undefined, media.path);
      setPreviewToken(token.token);
      report('Token généré ✉️');
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

  return (
    <Stack spacing={3}>
      {message && <Alert severity={messageType}>{message}</Alert>}
      <Box>
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

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField label="Titre" value={title} onChange={(event) => setTitle(event.target.value)} sx={{ flex: 1 }} />
        <TextField
          label="Tags"
          helperText="Séparés par des virgules"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          sx={{ flex: 1 }}
        />
        <FormControlLabel
          control={<Switch checked={visibility} onChange={(event) => setVisibility(event.target.checked)} />}
          label={visibility ? 'Visible' : 'Masqué'}
        />
      </Stack>

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
                  <Typography variant="caption" color="text.secondary">
                    {thumb.defaultPath}
                  </Typography>
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

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="Renommer"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            size="small"
          />
          <Button variant="outlined" startIcon={<EditIcon />} onClick={handleRename}>
            Renommer
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="Déplacer vers…"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            size="small"
            placeholder="ex: peintures/2024"
          />
          <Button variant="outlined" startIcon={<DriveFileMoveIcon />} onClick={handleMove}>
            Déplacer
          </Button>
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
        <TextField
          label="Secret preview"
          value={previewSecret}
          onChange={(event) => setPreviewSecret(event.target.value)}
          size="small"
        />
        <Button variant="contained" startIcon={<PreviewIcon />} onClick={requestPreview} disabled={!previewSecret}>
          Générer un lien éphémère
        </Button>
        {previewToken && <Chip color="secondary" label={`Token: ${previewToken}`} />}
      </Stack>

      <Stack direction="row" spacing={2}>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
          Sauvegarder les métadonnées
        </Button>
        <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={handleDelete}>
          Supprimer le média
        </Button>
      </Stack>
    </Stack>
  );
};
