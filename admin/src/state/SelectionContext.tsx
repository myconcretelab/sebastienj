import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type Selection = {
  folderPath: string;
  mediaPath?: string;
  mediaPaths: string[];
  setFolderPath: (path: string) => void;
  setMediaPath: (path?: string) => void;
  setMediaSelection: (paths: string[], primary?: string) => void;
  updateMediaPositions: (sourceFolder: string, moved: string[], nextPaths: string[]) => void;
};

const SelectionContext = createContext<Selection | undefined>(undefined);

export const SelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [folderPath, setFolderPathState] = useState('');
  const [mediaPath, setMediaPathState] = useState<string | undefined>();
  const [mediaPaths, setMediaPaths] = useState<string[]>([]);

  const updateMediaSelection = useCallback((paths: string[], primary?: string) => {
    setMediaPaths(paths);
    setMediaPathState(primary ?? (paths.length > 0 ? paths[paths.length - 1] : undefined));
  }, []);

  const setFolderPath = useCallback(
    (path: string) => {
      setFolderPathState(path);
      updateMediaSelection([]);
    },
    [updateMediaSelection]
  );

  const setMediaPath = useCallback(
    (path?: string) => {
      updateMediaSelection(path ? [path] : [], path);
    },
    [updateMediaSelection]
  );

  const setMediaSelection = useCallback(
    (paths: string[], primary?: string) => {
      updateMediaSelection(paths, primary);
    },
    [updateMediaSelection]
  );

  const updateMediaPositions = useCallback(
    (sourceFolder: string, moved: string[], nextPaths: string[]) => {
      const normalize = (candidate: string) => candidate.trim().replace(/^\/+/, '');
      const folderOf = (candidate: string) =>
        candidate.includes('/') ? candidate.slice(0, candidate.lastIndexOf('/')) : '';

      const sourceFolderNormalized = normalize(sourceFolder);
      const movedNormalized = moved.map(normalize);

      if (folderPath === sourceFolderNormalized) {
        const movedInSource = new Set(
          movedNormalized.filter((path) => folderOf(path) === sourceFolderNormalized)
        );
        if (movedInSource.size > 0) {
          const remaining = mediaPaths.filter((path) => !movedInSource.has(path));
          updateMediaSelection(remaining);
        }
      }

      if (nextPaths.length === 0) {
        return;
      }

      const destinationNormalized = folderOf(normalize(nextPaths[0]));
      if (destinationNormalized && folderPath === destinationNormalized) {
        const normalizedNext = nextPaths.map(normalize);
        updateMediaSelection(normalizedNext, normalizedNext[normalizedNext.length - 1]);
      }
    },
    [folderPath, mediaPaths, updateMediaSelection]
  );

  const value = useMemo(
    () => ({
      folderPath,
      mediaPath,
      mediaPaths,
      setFolderPath,
      setMediaPath,
      setMediaSelection,
      updateMediaPositions
    }),
    [folderPath, mediaPath, mediaPaths, setFolderPath, setMediaPath, setMediaSelection, updateMediaPositions]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
};

export const useSelection = () => {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    throw new Error('SelectionProvider is missing');
  }
  return ctx;
};
