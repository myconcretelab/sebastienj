import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddRounded';
import DeleteIcon from '@mui/icons-material/DeleteRounded';
import RefreshIcon from '@mui/icons-material/AutoFixHighRounded';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { ThumbnailSummary } from '../api/types.js';

interface Props {
  summary: ThumbnailSummary;
  onSave: (config: ThumbnailSummary['config']) => Promise<void> | void;
  onRebuild: () => Promise<void> | void;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
};

export const ThumbnailSettingsPanel: React.FC<Props> = ({ summary, onSave, onRebuild }) => {
  const [draft, setDraft] = useState(summary.config);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [isSaving, setIsSaving] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);

  useEffect(() => {
    setDraft(summary.config);
  }, [summary.config]);

  const addFormat = () => {
    const id = `format-${Date.now()}`;
    setDraft((prev) => ({
      ...prev,
      formats: {
        ...prev.formats,
        [id]: { width: 400 }
      }
    }));
  };

  const updateFormatValue = (key: string, value: { width?: number; height?: number }) => {
    setDraft((prev) => ({
      ...prev,
      formats: {
        ...prev.formats,
        [key]: value
      }
    }));
  };

  const renameFormat = (currentKey: string, nextKey: string) => {
    if (!nextKey || currentKey === nextKey) return;
    setDraft((prev) => {
      if (prev.formats[nextKey]) {
        return prev;
      }
      const nextFormats = { ...prev.formats };
      const value = nextFormats[currentKey];
      delete nextFormats[currentKey];
      nextFormats[nextKey] = value;
      return { ...prev, formats: nextFormats };
    });
  };

  const removeFormat = (key: string) => {
    setDraft((prev) => {
      const nextFormats = { ...prev.formats };
      delete nextFormats[key];
      return { ...prev, formats: nextFormats };
    });
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await onSave(draft);
      setMessage('Configuration des miniatures sauvegardée 🌈');
      setMessageType('success');
    } catch (error) {
      setMessage((error as Error).message);
      setMessageType('error');
    } finally {
      setIsSaving(false);
    }
  };

  const rebuild = async () => {
    setIsRebuilding(true);
    setMessage(null);
    try {
      await onRebuild();
      setMessage('Regénération programmée ✨');
      setMessageType('success');
    } catch (error) {
      setMessage((error as Error).message);
      setMessageType('error');
    } finally {
      setIsRebuilding(false);
    }
  };

  const presets = useMemo(() => Object.entries(draft.formats), [draft.formats]);

  return (
    <Stack spacing={3}>
      {message && <Alert severity={messageType}>{message}</Alert>}
      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6">Formats configurés</Typography>
              <Typography variant="body2" color="text.secondary">
                Ajoutez des tailles adaptées à vos galeries responsive.
              </Typography>
            </Box>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={addFormat}>
              Ajouter un format
            </Button>
          </Stack>
          <Divider sx={{ my: 3 }} />
          <Stack spacing={2}>
            {presets.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Aucun format défini. Ajoutez au moins une miniature pour profiter des optimisations.
              </Typography>
            )}
            {presets.map(([key, value]) => (
              <Card key={key} variant="outlined" sx={{ borderStyle: 'dashed' }}>
                <CardContent>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={3}>
                      <TextField
                        label="Nom du format"
                        value={key}
                        onChange={(event) => renameFormat(key, event.target.value.trim())}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        label="Largeur cible"
                        type="number"
                        value={value.width ?? ''}
                        onChange={(event) =>
                          updateFormatValue(key, {
                            ...value,
                            width: event.target.value ? Number(event.target.value) : undefined
                          })
                        }
                        InputProps={{ inputProps: { min: 1 } }}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        label="Hauteur cible"
                        type="number"
                        value={value.height ?? ''}
                        onChange={(event) =>
                          updateFormatValue(key, {
                            ...value,
                            height: event.target.value ? Number(event.target.value) : undefined
                          })
                        }
                        InputProps={{ inputProps: { min: 1 } }}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Stack direction="row" justifyContent="flex-end">
                        <Button color="error" startIcon={<DeleteIcon />} onClick={() => removeFormat(key)}>
                          Supprimer
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Paramètres globaux
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Format de sortie"
                value={draft.format}
                onChange={(event) => setDraft({ ...draft, format: event.target.value as typeof draft.format })}
                fullWidth
              >
                <MenuItem value="webp">webp (compatible et léger)</MenuItem>
                <MenuItem value="avif">avif (très optimisé)</MenuItem>
                <MenuItem value="both">webp + avif (choix automatique)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Dimension de base"
                value={draft.base}
                onChange={(event) => setDraft({ ...draft, base: event.target.value as typeof draft.base })}
                fullWidth
              >
                <MenuItem value="auto">Automatique (selon orientation)</MenuItem>
                <MenuItem value="width">Basé sur la largeur</MenuItem>
                <MenuItem value="height">Basé sur la hauteur</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Qualité"
                type="number"
                value={draft.quality}
                onChange={(event) =>
                  setDraft({ ...draft, quality: event.target.value ? Number(event.target.value) : 82 })
                }
                helperText="Entre 1 et 100"
                InputProps={{ inputProps: { min: 1, max: 100 } }}
                fullWidth
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1">Utilisation disque actuelle</Typography>
              <Typography variant="body2" color="text.secondary">
                {summary.stats.presets} formats · {summary.stats.totalFiles} fichiers ·{' '}
                {formatBytes(summary.stats.totalSize)}
              </Typography>
            </Box>
            <Tooltip title="Recalculer toutes les miniatures">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={rebuild}
                  disabled={isRebuilding || presets.length === 0}
                >
                  Recalculer toutes les miniatures
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
        <Button variant="contained" onClick={save} disabled={isSaving}>
          Sauvegarder la configuration
        </Button>
        <Tooltip title="Les miniatures sont générées automatiquement au prochain ajout." placement="right">
          <InfoIcon color="action" />
        </Tooltip>
      </Stack>
    </Stack>
  );
};
