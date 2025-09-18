import { AppBar, Box, Button, IconButton, Stack, Toolbar as MuiToolbar, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import SettingsIcon from '@mui/icons-material/SettingsRounded';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeRounded';
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded';
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MetadataSyncIndicator } from './MetadataSyncIndicator.js';

interface Props {
  onRefresh?: () => void;
  onNewFolder?: () => void;
  canGoBack?: boolean;
  title?: string;
}

export const Toolbar: React.FC<Props> = ({ onRefresh, onNewFolder, canGoBack, title }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const inSettings = location.pathname === '/settings';
  const inPages = location.pathname.startsWith('/pages');

  return (
    <AppBar
      position="static"
      elevation={0}
      color="transparent"
      sx={{
        background: 'linear-gradient(120deg, rgba(255,255,255,0.65), rgba(255,255,255,0.4))',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(111,137,166,0.2)'
      }}
    >
      <MuiToolbar sx={{ alignItems: 'center', gap: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} flex={1}>
          {canGoBack && (
            <IconButton color="primary" onClick={() => navigate(-1)}>
              <ArrowBackIcon />
            </IconButton>
          )}
          <AutoAwesomeIcon color="primary" fontSize="small" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              Atelier vivant
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {title || 'Architecture hiérarchique en souffle doux'}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <MetadataSyncIndicator />
          {onRefresh && (
            <IconButton color="primary" onClick={onRefresh}>
              <RefreshIcon />
            </IconButton>
          )}
          {onNewFolder && (
            <Button variant="outlined" onClick={onNewFolder} sx={{ borderStyle: 'dashed' }}>
              Nouveau dossier
            </Button>
          )}
          <Button
            component={Link}
            to="/"
            color="secondary"
            variant={!inSettings && !inPages ? 'contained' : 'text'}
          >
            Studio
          </Button>
          <Button
            component={Link}
            to="/pages"
            color="secondary"
            variant={inPages ? 'contained' : 'text'}
          >
            Pages statiques
          </Button>
          <Button
            component={Link}
            to={inSettings ? '/' : '/settings'}
            color="secondary"
            startIcon={<SettingsIcon />}
            variant={inSettings ? 'contained' : 'text'}
          >
            {inSettings ? 'Retour studio' : 'Réglages'}
          </Button>
        </Stack>
      </MuiToolbar>
    </AppBar>
  );
};
