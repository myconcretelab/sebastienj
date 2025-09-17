import { Chip, Tooltip } from '@mui/material';
import { motion } from 'framer-motion';
import React from 'react';
import { useOrphans } from '../api/client.js';

export const MetadataSyncIndicator: React.FC = () => {
  const { data, isLoading } = useOrphans();

  const hasOrphans = Boolean(
    data &&
      (data.filesWithoutMetadata.folders.length > 0 ||
        data.filesWithoutMetadata.medias.length > 0 ||
        data.metadataWithoutFiles.folders.length > 0 ||
        data.metadataWithoutFiles.medias.length > 0)
  );

  const label = isLoading ? 'Synchronisation…' : hasOrphans ? 'Orphelins détectés' : 'Tout est à jour';
  const color = isLoading ? 'default' : hasOrphans ? 'warning' : 'success';

  const orphanFilesCount = data?.metadataWithoutFiles.medias.length ?? 0;
  const orphanFoldersCount = data?.metadataWithoutFiles.folders.length ?? 0;
  const tooltip = hasOrphans
    ? `Fichiers sans métadonnées : ${data?.filesWithoutMetadata.medias.length ?? 0} · Dossiers sans métadonnées : ${
        data?.filesWithoutMetadata.folders.length ?? 0
      }\nEntrées orphelines : ${orphanFilesCount + orphanFoldersCount}`
    : 'La bibliothèque danse en rythme avec le disque.';

  return (
    <Tooltip title={tooltip} arrow>
      <motion.div
        initial={{ opacity: 0.5, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <Chip color={color as any} label={label} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
      </motion.div>
    </Tooltip>
  );
};
