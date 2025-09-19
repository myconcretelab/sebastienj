import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import LockIcon from '@mui/icons-material/LockRounded';
import { api } from '../api/client.js';

interface Props {
  onSuccess: () => void;
}

export const LoginPage: React.FC<Props> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('Veuillez saisir le mot de passe.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.login(password);
      setPassword('');
      onSuccess();
    } catch (err) {
      setError((err as Error).message || 'Authentification impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #f5ede2, #e1d4c4)'
      }}
    >
      <Card variant="outlined" sx={{ maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
        <CardContent>
          <Stack spacing={3} alignItems="center">
            <LockIcon color="primary" sx={{ fontSize: 48 }} />
            <Box textAlign="center">
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Accès à l'atelier
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Entrez le mot de passe administrateur pour continuer.
              </Typography>
            </Box>
            {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
            <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
              <Stack spacing={2}>
                <TextField
                  label="Mot de passe"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoFocus
                  fullWidth
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || !password}
                  size="large"
                >
                  {loading ? <CircularProgress size={20} color="inherit" /> : 'Se connecter'}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
