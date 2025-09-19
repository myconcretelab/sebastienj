import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import ReactQuill from 'react-quill';

import { useBlogArticles, useBlogSettings, api } from '../api/client.js';
import { BlogArticle, BlogSettings } from '../api/types.js';
import { Toolbar } from '../components/Toolbar.js';

const cloneArticle = (article: BlogArticle): BlogArticle => ({
  ...article,
  categories: [...article.categories],
  images: [...article.images],
  coverImage: article.coverImage ? { ...article.coverImage } : undefined
});

const normalizeCategory = (value: string | undefined | null): string => {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const quillModules = {
  toolbar: [
    [{ header: [1, 2, false] }],
    ['bold', 'italic', 'underline', 'blockquote'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean']
  ]
};

const quillFormats = ['header', 'bold', 'italic', 'underline', 'blockquote', 'list', 'bullet', 'link'];

export const BlogPage: React.FC = () => {
  const { data: articles } = useBlogArticles();
  const { data: settings } = useBlogSettings();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<BlogArticle | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<BlogSettings | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [detectedHashtags, setDetectedHashtags] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (articles && !selectedSlug && articles.length > 0) {
      setSelectedSlug(articles[0].slug);
    }
  }, [articles, selectedSlug]);

  useEffect(() => {
    if (!articles) return;
    if (!selectedSlug) {
      setDraft(null);
      setIsDirty(false);
      return;
    }
    const current = articles.find((article) => article.slug === selectedSlug);
    if (current) {
      setDraft(cloneArticle(current));
      setIsDirty(false);
    }
  }, [articles, selectedSlug]);

  useEffect(() => {
    if (settings) {
      setSettingsDraft({ ...settings, allowedSenders: [...settings.allowedSenders] });
    }
  }, [settings]);

  useEffect(() => {
    if (!draft) {
      setDetectedHashtags([]);
      return;
    }
    const matches = draft.content.match(/#([\p{L}0-9_-]+)/gu) || [];
    const normalized = Array.from(new Set(matches.map((match) => normalizeCategory(match.slice(1))).filter(Boolean)));
    setDetectedHashtags(normalized);
  }, [draft?.content]);

  const allCategories = useMemo(() => {
    const values = new Set<string>();
    articles?.forEach((article) => article.categories.forEach((category) => values.add(category)));
    detectedHashtags.forEach((category) => values.add(category));
    return Array.from(values);
  }, [articles, detectedHashtags]);

  const filteredArticles = useMemo(() => {
    if (!articles) return [];
    const query = search.trim().toLowerCase();
    const filter = categoryFilter ? normalizeCategory(categoryFilter) : null;
    return articles
      .filter((article) => {
        const matchCategory = filter ? article.categories.includes(filter) : true;
        const matchQuery = query
          ? article.title.toLowerCase().includes(query) || (article.excerpt ?? '').toLowerCase().includes(query)
          : true;
        return matchCategory && matchQuery;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [articles, search, categoryFilter]);

  const handleSelect = (slug: string) => {
    if (isDirty && !window.confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) {
      return;
    }
    setSelectedSlug(slug);
  };

  const handleCreate = async () => {
    const title = window.prompt('Titre du nouvel article ?');
    if (!title) return;
    try {
      const article = await api.createBlogArticle({
        title,
        content: '',
        author: '',
        categories: [],
        images: []
      });
      setSelectedSlug(article.slug);
      window.setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 150);
    } catch (error) {
      window.alert((error as Error).message || 'Impossible de créer l\'article');
    }
  };

  const handleSave = async () => {
    if (!draft || !selectedSlug) return;
    setIsSaving(true);
    try {
      const payload = {
        title: draft.title,
        content: draft.content,
        author: draft.author,
        slug: draft.slug,
        date: draft.date,
        categories: draft.categories,
        images: draft.images,
        coverImage: draft.coverImage ?? undefined,
        excerpt: draft.excerpt
      };
      const updated = await api.updateBlogArticle(selectedSlug, payload);
      setSelectedSlug(updated.slug);
      setIsDirty(false);
      window.alert('Article sauvegardé avec succès');
    } catch (error) {
      window.alert((error as Error).message || 'Impossible de sauvegarder l\'article');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft) return;
    if (!window.confirm(`Supprimer l'article « ${draft.title} » ?`)) return;
    try {
      await api.deleteBlogArticle(draft.slug);
      setSelectedSlug(null);
      setDraft(null);
      setIsDirty(false);
      window.alert('Article supprimé');
    } catch (error) {
      window.alert((error as Error).message || 'Impossible de supprimer l\'article');
    }
  };

  const handleChange = <K extends keyof BlogArticle>(key: K, value: BlogArticle[K]) => {
    setDraft((previous) => {
      if (!previous) return previous;
      setIsDirty(true);
      return { ...previous, [key]: value } as BlogArticle;
    });
  };

  const handleCategoriesChange = (categories: string[]) => {
    const normalized = Array.from(new Set(categories.map((category) => normalizeCategory(category)).filter(Boolean)));
    handleChange('categories', normalized);
  };

  const handleAddDetected = () => {
    if (!draft) return;
    const merged = Array.from(new Set([...draft.categories, ...detectedHashtags]));
    handleChange('categories', merged);
  };

  const handleUploadImages = async (files: FileList | null) => {
    if (!files || !draft) return;
    try {
      for (const file of Array.from(files)) {
        const result = await api.uploadBlogImage(file);
        setDraft((previous) => {
          if (!previous) return previous;
          const nextImages = [...previous.images, result.path];
          const coverImage = previous.coverImage || {
            path: result.path,
            previewPath: result.previewPath,
            width: result.width,
            height: result.height
          };
          setIsDirty(true);
          return { ...previous, images: nextImages, coverImage };
        });
      }
    } catch (error) {
      window.alert((error as Error).message || 'Erreur lors du téléversement');
    }
  };

  const handleInsertImage = (path: string) => {
    const snippet = `<p><img src="/api/media/${path}" alt="" loading="lazy" data-lightbox="article" /></p>`;
    handleChange('content', `${draft?.content ?? ''}\n${snippet}`);
  };

  const handleRemoveImage = (path: string) => {
    if (!draft) return;
    const nextImages = draft.images.filter((image) => image !== path);
    const nextCover = draft.coverImage?.path === path ? undefined : draft.coverImage;
    handleChange('images', nextImages);
    handleChange('coverImage', nextCover ?? undefined);
  };

  const handleSetCover = (path: string) => {
    handleChange('coverImage', { path } as BlogArticle['coverImage']);
  };

  const handleSettingsChange = <K extends keyof BlogSettings>(key: K, value: BlogSettings[K]) => {
    setSettingsDraft((previous) => (previous ? { ...previous, [key]: value } : previous));
  };

  const handleSettingsSave = async () => {
    if (!settingsDraft) return;
    try {
      await api.updateBlogSettings(settingsDraft);
      window.alert('Réglages sauvegardés');
    } catch (error) {
      window.alert((error as Error).message || 'Impossible de sauvegarder les réglages');
    }
  };

  const allowedSendersValue = settingsDraft?.allowedSenders.join('\n') ?? '';

  const articlesList = filteredArticles;

  return (
    <Stack sx={{ height: '100vh' }}>
      <Toolbar canGoBack title="Gestion du blog" />
      <Box sx={{ flex: 1, overflow: 'auto', p: 4 }}>
        <Stack spacing={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(15,40,67,0.12)' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
              <Typography variant="h6">Articles ({articles?.length ?? 0})</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher un article"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
                <TextField
                  size="small"
                  value={categoryFilter ?? ''}
                  onChange={(event) => setCategoryFilter(event.target.value || null)}
                  placeholder="Filtrer par catégorie"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CategoryRoundedIcon fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
                <Button variant="outlined" startIcon={<AddCircleOutlineIcon />} onClick={handleCreate}>
                  Nouvel article
                </Button>
              </Stack>
            </Stack>
            <List dense sx={{ mt: 2, maxHeight: 320, overflow: 'auto' }}>
              {articlesList.map((article) => (
                <ListItem key={article.slug} disablePadding>
                  <ListItemButton selected={article.slug === selectedSlug} onClick={() => handleSelect(article.slug)}>
                    <ListItemText
                      primary={article.title}
                      secondary={`${new Date(article.date).toLocaleDateString('fr-FR')} – ${article.author || 'Anonyme'}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
              {articlesList.length === 0 ? (
                <ListItem>
                  <ListItemText primary="Aucun article ne correspond aux filtres." />
                </ListItem>
              ) : null}
            </List>
          </Paper>

          {draft ? (
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(15,40,67,0.12)', display: 'grid', gap: 3 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                <Typography variant="h6">Édition de l'article</Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    startIcon={<SaveRoundedIcon />}
                    onClick={handleSave}
                    disabled={isSaving || !isDirty}
                  >
                    Sauvegarder
                  </Button>
                  <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={handleDelete}>
                    Supprimer
                  </Button>
                </Stack>
              </Stack>

              <Stack spacing={2}>
                <TextField
                  label="Titre"
                  value={draft.title}
                  onChange={(event) => handleChange('title', event.target.value)}
                  fullWidth
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Slug"
                    value={draft.slug}
                    onChange={(event) => handleChange('slug', normalizeCategory(event.target.value))}
                    fullWidth
                  />
                  <TextField
                    label="Auteur"
                    value={draft.author}
                    onChange={(event) => handleChange('author', event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Date"
                    type="datetime-local"
                    value={draft.date ? draft.date.slice(0, 16) : ''}
                    onChange={(event) => handleChange('date', event.target.value ? new Date(event.target.value).toISOString() : draft.date)}
                    fullWidth
                  />
                </Stack>
              </Stack>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 2, color: 'text.secondary' }}>
                  Contenu
                </Typography>
                <ReactQuill
                  theme="snow"
                  value={draft.content}
                  onChange={(value) => handleChange('content', value)}
                  modules={quillModules}
                  formats={quillFormats}
                  style={{ height: 280, marginBottom: 24 }}
                />
              </Box>

              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 2, color: 'text.secondary' }}>
                    Catégories ({draft.categories.length})
                  </Typography>
                  {detectedHashtags.length > 0 && (
                    <Button size="small" onClick={handleAddDetected}>
                      Ajouter les hashtags détectés ({detectedHashtags.length})
                    </Button>
                  )}
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {draft.categories.map((category) => (
                    <Chip key={category} label={`#${category}`} onDelete={() => handleCategoriesChange(draft.categories.filter((item) => item !== category))} />
                  ))}
                </Stack>
                <TextField
                  label="Nouvelle catégorie"
                  placeholder="Saisir une étiquette et valider avec Entrée"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      const target = event.target as HTMLInputElement;
                      const next = normalizeCategory(target.value);
                      if (next) {
                        handleCategoriesChange([...draft.categories, next]);
                        target.value = '';
                      }
                    }
                  }}
                />
                {detectedHashtags.length > 0 && (
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {detectedHashtags.map((tag) => (
                      <Chip
                        key={tag}
                        label={`#${tag}`}
                        color={draft.categories.includes(tag) ? 'primary' : 'default'}
                        onClick={() => {
                          if (!draft.categories.includes(tag)) {
                            handleCategoriesChange([...draft.categories, tag]);
                          }
                        }}
                      />
                    ))}
                  </Stack>
                )}
              </Stack>

              <Divider />

              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <Button variant="outlined" startIcon={<UploadRoundedIcon />} component="label">
                    Téléverser des images
                    <input
                      hidden
                      multiple
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        handleUploadImages(event.target.files);
                        event.target.value = '';
                      }}
                    />
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    Les images ajoutées seront automatiquement disponibles pour insertion et utilisées comme couverture.
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  {draft.images.map((image) => {
                    const isCover = draft.coverImage?.path === image;
                    return (
                      <Paper
                        key={image}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          minWidth: 220,
                          display: 'grid',
                          gap: 1,
                          backgroundColor: isCover ? 'rgba(13,71,161,0.08)' : 'background.paper'
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <ImageOutlinedIcon fontSize="small" color={isCover ? 'primary' : 'disabled'} />
                          <Typography variant="body2" noWrap>
                            {image}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" onClick={() => handleInsertImage(image)}>
                            Insérer dans le contenu
                          </Button>
                          <Button size="small" onClick={() => handleSetCover(image)}>
                            {isCover ? 'Couverture' : 'Définir en couverture'}
                          </Button>
                          <IconButton size="small" onClick={() => handleRemoveImage(image)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Paper>
                    );
                  })}
                  {draft.images.length === 0 ? <Typography>Aucune image associée pour l'instant.</Typography> : null}
                </Stack>
              </Stack>
            </Paper>
          ) : (
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(15,40,67,0.12)' }}>
              <Typography variant="body1">Sélectionnez un article pour commencer l'édition.</Typography>
            </Paper>
          )}

          {settingsDraft ? (
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(15,40,67,0.12)', display: 'grid', gap: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
                <Typography variant="h6">Réglages de réception</Typography>
                <Button variant="contained" onClick={handleSettingsSave} startIcon={<SaveRoundedIcon />}>
                  Sauvegarder les réglages
                </Button>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="Adresse email entrante"
                  placeholder="blog@exemple.fr"
                  value={settingsDraft.inboundAddress ?? ''}
                  onChange={(event) => handleSettingsChange('inboundAddress', event.target.value || undefined)}
                  fullWidth
                />
                <TextField
                  label="Clé de signature Mailgun"
                  type="password"
                  value={settingsDraft.mailgunSigningKey ?? ''}
                  onChange={(event) => handleSettingsChange('mailgunSigningKey', event.target.value || undefined)}
                  fullWidth
                />
              </Stack>

              <TextField
                label="Expéditeurs autorisés (un par ligne)"
                value={allowedSendersValue}
                onChange={(event) =>
                  handleSettingsChange(
                    'allowedSenders',
                    event.target.value
                      .split(/\r?\n/g)
                      .map((value) => value.trim())
                      .filter(Boolean)
                  )
                }
                multiline
                minRows={3}
              />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="Chemin de la liste (ex: actu)"
                  value={settingsDraft.listPath}
                  onChange={(event) => handleSettingsChange('listPath', event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Chemin des articles (ex: blog)"
                  value={settingsDraft.articleBasePath}
                  onChange={(event) => handleSettingsChange('articleBasePath', event.target.value)}
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="Titre du bloc public"
                  value={settingsDraft.heroTitle ?? ''}
                  onChange={(event) => handleSettingsChange('heroTitle', event.target.value || undefined)}
                  fullWidth
                />
                <TextField
                  label="Sous-titre"
                  value={settingsDraft.heroSubtitle ?? ''}
                  onChange={(event) => handleSettingsChange('heroSubtitle', event.target.value || undefined)}
                  fullWidth
                />
              </Stack>

              <FormControlLabel
                control={
                  <Switch
                    checked={settingsDraft.autoPublish}
                    onChange={(event) => handleSettingsChange('autoPublish', event.target.checked)}
                  />
                }
                label="Publier automatiquement les emails reçus"
              />
            </Paper>
          ) : null}
        </Stack>
      </Box>
    </Stack>
  );
};

export default BlogPage;
