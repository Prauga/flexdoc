import React, { useEffect, useMemo, useState } from 'react';
import { FolderPlus, Library, Plus, Save, Trash2 } from 'lucide-react';
import type { HttpRequestDraft } from '../utils/http-client';
import { cloneApiClientScripts } from '../utils/api-client-scripting';
import type { ApiClientRequestScripts } from '../utils/api-client-scripting';
import {
  cloneRequestDraft,
  createApiClientId,
  deleteApiClientCollection,
  deleteApiClientFolder,
} from '../utils/api-client-workspace';
import type { ApiClientFolder, ApiClientWorkspaceState } from '../utils/api-client-workspace';

interface Props {
  request: HttpRequestDraft;
  scripts: ApiClientRequestScripts;
  onLoadRequest: (request: HttpRequestDraft, scripts?: ApiClientRequestScripts) => void;
  onSelectedCollectionChange?: (collectionId?: string) => void;
  workspace: ApiClientWorkspaceState;
  onWorkspaceChange: React.Dispatch<React.SetStateAction<ApiClientWorkspaceState>>;
  theme: 'light' | 'dark';
}

function timestamp(): string {
  return new Date().toISOString();
}

export const ApiClientCollections: React.FC<Props> = ({
  request,
  scripts,
  onLoadRequest,
  onSelectedCollectionChange,
  workspace,
  onWorkspaceChange,
  theme,
}) => {
  const [selectedCollectionId, setSelectedCollectionId] = useState(workspace.collections[0]?.id || '');
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [folderName, setFolderName] = useState('');
  const [requestName, setRequestName] = useState('');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const selectedCollection = workspace.collections.find((collection) => collection.id === selectedCollectionId) || workspace.collections[0];
  const collectionFolders = useMemo(
    () => workspace.folders.filter((folder) => folder.collectionId === selectedCollection?.id),
    [selectedCollection?.id, workspace.folders],
  );
  const collectionRequests = useMemo(
    () => workspace.requests.filter((saved) => saved.collectionId === selectedCollection?.id),
    [selectedCollection?.id, workspace.requests],
  );
  const folderById = useMemo(
    () => new Map(collectionFolders.map((folder) => [folder.id, folder])),
    [collectionFolders],
  );
  const orderedFolders = useMemo(() => {
    const ordered: Array<{ folder: ApiClientFolder; depth: number }> = [];
    const seen = new Set<string>();
    const visit = (parentFolderId: string | undefined, depth: number) => {
      collectionFolders
        .filter((folder) => folder.parentFolderId === parentFolderId)
        .forEach((folder) => {
          if (seen.has(folder.id)) return;
          seen.add(folder.id);
          ordered.push({ folder, depth });
          visit(folder.id, depth + 1);
        });
    };
    visit(undefined, 0);
    collectionFolders.forEach((folder) => {
      if (seen.has(folder.id)) return;
      seen.add(folder.id);
      ordered.push({ folder, depth: 0 });
      visit(folder.id, 1);
    });
    return ordered;
  }, [collectionFolders]);

  const folderPath = (folderId: string): string => {
    const names: string[] = [];
    const seen = new Set<string>();
    let current = folderById.get(folderId);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(current.name);
      current = current.parentFolderId ? folderById.get(current.parentFolderId) : undefined;
    }
    return names.join(' / ');
  };

  useEffect(() => {
    onSelectedCollectionChange?.(selectedCollection?.id);
  }, [onSelectedCollectionChange, selectedCollection?.id]);

  const addCollection = () => {
    const name = collectionName.trim();
    if (!name) return;
    const createdAt = timestamp();
    const id = createApiClientId('collection');
    onWorkspaceChange((current) => ({
      ...current,
      collections: [...current.collections, { id, name, variables: [], createdAt, updatedAt: createdAt }],
    }));
    setSelectedCollectionId(id);
    setSelectedFolderId('');
    setCollectionName('');
    setActiveRequestId(null);
  };

  const addCollectionVariable = () => {
    if (!selectedCollection) return;
    const updatedAt = timestamp();
    onWorkspaceChange((current) => ({
      ...current,
      collections: current.collections.map((collection) => collection.id === selectedCollection.id ? {
        ...collection,
        variables: [...collection.variables, { id: createApiClientId('variable'), key: '', value: '', enabled: true }],
        updatedAt,
      } : collection),
    }));
  };

  const updateCollectionVariable = (variableId: string, patch: { key?: string; value?: string; enabled?: boolean }) => {
    if (!selectedCollection) return;
    const updatedAt = timestamp();
    onWorkspaceChange((current) => ({
      ...current,
      collections: current.collections.map((collection) => collection.id === selectedCollection.id ? {
        ...collection,
        variables: collection.variables.map((variable) => variable.id === variableId ? { ...variable, ...patch } : variable),
        updatedAt,
      } : collection),
    }));
  };

  const removeCollectionVariable = (variableId: string) => {
    if (!selectedCollection) return;
    const updatedAt = timestamp();
    onWorkspaceChange((current) => ({
      ...current,
      collections: current.collections.map((collection) => collection.id === selectedCollection.id ? {
        ...collection,
        variables: collection.variables.filter((variable) => variable.id !== variableId),
        updatedAt,
      } : collection),
    }));
  };

  const addFolder = () => {
    const name = folderName.trim();
    if (!name || !selectedCollection) return;
    const createdAt = timestamp();
    const id = createApiClientId('folder');
    onWorkspaceChange((current) => ({
      ...current,
      folders: [...current.folders, {
        id,
        collectionId: selectedCollection.id,
        parentFolderId: selectedFolderId || undefined,
        name,
        createdAt,
        updatedAt: createdAt,
      }],
    }));
    setSelectedFolderId(id);
    setFolderName('');
  };

  const saveRequest = () => {
    if (!selectedCollection) return;
    const name = requestName.trim() || request.url || 'Untitled request';
    const updatedAt = timestamp();
    if (activeRequestId) {
      onWorkspaceChange((current) => ({
        ...current,
        requests: current.requests.map((saved) => saved.id === activeRequestId ? {
          ...saved,
          collectionId: selectedCollection.id,
          folderId: selectedFolderId || undefined,
          name,
          request: cloneRequestDraft(request),
          scripts: cloneApiClientScripts(scripts),
          updatedAt,
        } : saved),
      }));
      return;
    }
    const saved = {
      id: createApiClientId('request'),
      collectionId: selectedCollection.id,
      folderId: selectedFolderId || undefined,
      name,
      request: cloneRequestDraft(request),
      scripts: cloneApiClientScripts(scripts),
      createdAt: updatedAt,
      updatedAt,
    };
    onWorkspaceChange((current) => ({ ...current, requests: [...current.requests, saved] }));
    setActiveRequestId(saved.id);
    setRequestName(name);
  };

  const loadRequest = (requestId: string) => {
    const saved = workspace.requests.find((item) => item.id === requestId);
    if (!saved) return;
    setActiveRequestId(saved.id);
    setSelectedCollectionId(saved.collectionId);
    setSelectedFolderId(saved.folderId || '');
    setRequestName(saved.name);
    onLoadRequest(cloneRequestDraft(saved.request), saved.scripts ? cloneApiClientScripts(saved.scripts) : undefined);
  };

  const removeRequest = (requestId: string) => {
    onWorkspaceChange((current) => ({ ...current, requests: current.requests.filter((saved) => saved.id !== requestId) }));
    if (activeRequestId === requestId) {
      setActiveRequestId(null);
      setRequestName('');
    }
  };

  const removeFolder = (folderId: string) => {
    const folder = workspace.folders.find((candidate) => candidate.id === folderId);
    onWorkspaceChange((current) => deleteApiClientFolder(current, folderId));
    if (selectedFolderId === folderId) setSelectedFolderId(folder?.parentFolderId || '');
  };

  const removeCollection = (collectionId: string) => {
    const next = deleteApiClientCollection(workspace, collectionId);
    onWorkspaceChange(next);
    if (selectedCollectionId === collectionId) {
      setSelectedCollectionId(next.collections[0]?.id || '');
      setSelectedFolderId('');
      setActiveRequestId(null);
      setRequestName('');
    }
  };

  const inputClass = theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900';
  const mutedClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
  const selectedClass = theme === 'dark' ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-500/10 text-blue-700';

  const renderSavedRequest = (saved: ApiClientWorkspaceState['requests'][number]) => (
    <div key={saved.id} className={`group flex items-center gap-1 rounded-md ${activeRequestId === saved.id ? 'bg-blue-500/10' : ''}`}>
      <button
        type='button'
        className='min-w-0 flex-1 rounded-md px-2 py-2 text-left text-sm hover:bg-blue-500/10'
        aria-label={`Load saved request ${saved.name}`}
        onClick={() => loadRequest(saved.id)}
      >
        <span className='mr-2 font-mono text-xs font-semibold text-blue-600'>{saved.request.method.toUpperCase()}</span>
        <span className='truncate'>{saved.name}</span>
      </button>
      <button type='button' className='rounded-md p-2 opacity-70 hover:opacity-100' aria-label={`Delete saved request ${saved.name}`} onClick={() => removeRequest(saved.id)}>
        <Trash2 className='h-4 w-4' />
      </button>
    </div>
  );

  const renderFolderSelector = (folder: ApiClientFolder, depth: number, seen = new Set<string>()): React.ReactNode => {
    if (seen.has(folder.id)) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(folder.id);
    const path = folderPath(folder.id);
    const children = collectionFolders.filter((candidate) => candidate.parentFolderId === folder.id);
    return <React.Fragment key={folder.id}>
      <div className='flex items-center gap-1'>
        <button
          type='button'
          aria-label={`Select folder ${path}`}
          className={`min-w-0 flex-1 rounded-md py-2 pr-2 text-left text-sm ${selectedFolderId === folder.id ? 'bg-blue-500/10' : ''}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => setSelectedFolderId(folder.id)}
        >
          {folder.name}
        </button>
        <button type='button' aria-label={`Delete folder ${path}`} className='rounded-md p-2 opacity-70 hover:opacity-100' onClick={() => removeFolder(folder.id)}><Trash2 className='h-4 w-4' /></button>
      </div>
      {children.map((child) => renderFolderSelector(child, depth + 1, nextSeen))}
    </React.Fragment>;
  };

  const renderFolderRequests = (folder: ApiClientFolder, depth: number, seen = new Set<string>()): React.ReactNode => {
    if (seen.has(folder.id)) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(folder.id);
    const directRequests = collectionRequests.filter((saved) => saved.folderId === folder.id);
    const children = collectionFolders.filter((candidate) => candidate.parentFolderId === folder.id);
    if (directRequests.length === 0 && children.length === 0) return null;
    return <div key={folder.id} className='space-y-1'>
      {directRequests.length > 0 && <>
        <div className={`mb-1 text-xs font-semibold uppercase tracking-wide ${mutedClass}`} style={{ paddingLeft: `${8 + depth * 12}px` }}>{folder.name}</div>
        <div style={{ paddingLeft: `${depth * 12}px` }}>{directRequests.map(renderSavedRequest)}</div>
      </>}
      {children.map((child) => renderFolderRequests(child, depth + 1, nextSeen))}
    </div>;
  };

  const rootFolders = collectionFolders.filter((folder) => !folder.parentFolderId);
  const selectedFolderPath = selectedFolderId ? folderPath(selectedFolderId) : '';

  return <section className='space-y-4' aria-labelledby='api-client-collections-heading'>
    <div className='flex items-center gap-2'>
      <Library className='h-4 w-4' />
      <h3 id='api-client-collections-heading' className='font-semibold'>Collections</h3>
    </div>

    <div className='flex gap-2'>
      <input aria-label='New collection name' className={`min-w-0 flex-1 rounded-md border px-2 py-2 text-sm ${inputClass}`} value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder='New collection' />
      <button type='button' aria-label='Add collection' className='rounded-md border px-3 py-2' onClick={addCollection}><Plus className='h-4 w-4' /></button>
    </div>

    <div className='space-y-2'>
      {workspace.collections.map((collection) => <div key={collection.id} className='flex items-center gap-1'>
        <button
          type='button'
          className={`min-w-0 flex-1 rounded-md px-2 py-2 text-left text-sm font-medium ${collection.id === selectedCollection?.id ? selectedClass : ''}`}
          onClick={() => {
            setSelectedCollectionId(collection.id);
            setSelectedFolderId('');
            setActiveRequestId(null);
            setRequestName('');
          }}
        >
          {collection.name}
        </button>
        {workspace.collections.length > 1 && <button type='button' aria-label={`Delete collection ${collection.name}`} className='rounded-md p-2 opacity-70 hover:opacity-100' onClick={() => removeCollection(collection.id)}><Trash2 className='h-4 w-4' /></button>}
      </div>)}
    </div>

    {selectedCollection && <>
      <div className='space-y-2 border-t pt-3'>
        <div className='flex items-center justify-between'>
          <span className='text-xs font-semibold uppercase tracking-wide'>Collection variables</span>
          <button type='button' aria-label='Add collection variable' className='inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs' onClick={addCollectionVariable}><Plus className='h-3.5 w-3.5' /> Add</button>
        </div>
        <div className='space-y-2'>
          {selectedCollection.variables.map((variable, index) => <div key={variable.id} className='grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-1'>
            <input aria-label={`Collection variable ${index + 1} enabled`} type='checkbox' checked={variable.enabled !== false} onChange={(event) => updateCollectionVariable(variable.id, { enabled: event.target.checked })} />
            <input aria-label={`Collection variable ${index + 1} key`} className={`min-w-0 rounded-md border px-2 py-1.5 font-mono text-xs ${inputClass}`} placeholder='baseUrl' value={variable.key} onChange={(event) => updateCollectionVariable(variable.id, { key: event.target.value })} />
            <input aria-label={`Collection variable ${index + 1} value`} className={`min-w-0 rounded-md border px-2 py-1.5 font-mono text-xs ${inputClass}`} placeholder='https://api.example.com' value={variable.value} onChange={(event) => updateCollectionVariable(variable.id, { value: event.target.value })} />
            <button type='button' aria-label={`Remove collection variable ${index + 1}`} className='rounded-md p-1.5 opacity-70 hover:opacity-100' onClick={() => removeCollectionVariable(variable.id)}><Trash2 className='h-3.5 w-3.5' /></button>
          </div>)}
          {selectedCollection.variables.length === 0 && <p className={`text-xs ${mutedClass}`}>Collection variables provide reusable defaults such as <code>{'{{baseUrl}}'}</code>. Active environment values override matching collection keys.</p>}
        </div>
      </div>

      <div className='space-y-1 border-t pt-3'>
        <div className='flex gap-2'>
          <input aria-label='New folder name' className={`min-w-0 flex-1 rounded-md border px-2 py-2 text-sm ${inputClass}`} value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder='Folder' />
          <button type='button' aria-label='Add folder' className='rounded-md border px-3 py-2' onClick={addFolder}><FolderPlus className='h-4 w-4' /></button>
        </div>
        <p className={`text-xs ${mutedClass}`}>{selectedFolderPath ? `New folders are created inside ${selectedFolderPath}.` : 'New folders are created at the collection root.'}</p>
      </div>

      <div className='space-y-1'>
        <button type='button' aria-label='Select collection root' className={`w-full rounded-md px-2 py-2 text-left text-sm ${selectedFolderId === '' ? 'bg-blue-500/10' : ''}`} onClick={() => setSelectedFolderId('')}>Unfiled / collection root</button>
        {rootFolders.map((folder) => renderFolderSelector(folder, 0))}
      </div>

      <div className='space-y-2 border-t pt-3'>
        <input aria-label='Saved request name' className={`w-full rounded-md border px-2 py-2 text-sm ${inputClass}`} value={requestName} onChange={(event) => setRequestName(event.target.value)} placeholder='Request name' />
        <select aria-label='Saved request folder' className={`w-full rounded-md border px-2 py-2 text-sm ${inputClass}`} value={selectedFolderId} onChange={(event) => setSelectedFolderId(event.target.value)}>
          <option value=''>Unfiled</option>
          {orderedFolders.map(({ folder, depth }) => <option key={folder.id} value={folder.id}>{`${'— '.repeat(depth)}${folder.name}`}</option>)}
        </select>
        <button type='button' className='inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium' onClick={saveRequest}>
          <Save className='h-4 w-4' /> {activeRequestId ? 'Update request' : 'Save request'}
        </button>
      </div>

      <div className='space-y-3 border-t pt-3'>
        {collectionRequests.filter((saved) => !saved.folderId).map(renderSavedRequest)}
        {rootFolders.map((folder) => renderFolderRequests(folder, 0))}
        {collectionRequests.length === 0 && <p className={`px-2 text-xs ${mutedClass}`}>Save the current request to build a reusable collection.</p>}
      </div>
    </>}
  </section>;
};