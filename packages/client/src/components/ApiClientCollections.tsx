import React, { useMemo, useState } from 'react';
import { FolderPlus, Library, Plus, Save, Trash2 } from 'lucide-react';
import type { HttpRequestDraft } from '../utils/http-client';
import {
  cloneRequestDraft,
  createApiClientId,
  deleteApiClientCollection,
  deleteApiClientFolder,
} from '../utils/api-client-workspace';
import type { ApiClientWorkspaceState } from '../utils/api-client-workspace';

interface Props {
  request: HttpRequestDraft;
  onLoadRequest: (request: HttpRequestDraft) => void;
  workspace: ApiClientWorkspaceState;
  onWorkspaceChange: React.Dispatch<React.SetStateAction<ApiClientWorkspaceState>>;
  theme: 'light' | 'dark';
}

function timestamp(): string {
  return new Date().toISOString();
}

export const ApiClientCollections: React.FC<Props> = ({ request, onLoadRequest, workspace, onWorkspaceChange, theme }) => {
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

  const addCollection = () => {
    const name = collectionName.trim();
    if (!name) return;
    const createdAt = timestamp();
    const id = createApiClientId('collection');
    onWorkspaceChange((current) => ({
      ...current,
      collections: [...current.collections, { id, name, createdAt, updatedAt: createdAt }],
    }));
    setSelectedCollectionId(id);
    setSelectedFolderId('');
    setCollectionName('');
    setActiveRequestId(null);
  };

  const addFolder = () => {
    const name = folderName.trim();
    if (!name || !selectedCollection) return;
    const createdAt = timestamp();
    const id = createApiClientId('folder');
    onWorkspaceChange((current) => ({
      ...current,
      folders: [...current.folders, { id, collectionId: selectedCollection.id, name, createdAt, updatedAt: createdAt }],
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
    onLoadRequest(cloneRequestDraft(saved.request));
  };

  const removeRequest = (requestId: string) => {
    onWorkspaceChange((current) => ({ ...current, requests: current.requests.filter((saved) => saved.id !== requestId) }));
    if (activeRequestId === requestId) {
      setActiveRequestId(null);
      setRequestName('');
    }
  };

  const removeFolder = (folderId: string) => {
    onWorkspaceChange((current) => deleteApiClientFolder(current, folderId));
    if (selectedFolderId === folderId) setSelectedFolderId('');
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
      <div className='flex gap-2'>
        <input aria-label='New folder name' className={`min-w-0 flex-1 rounded-md border px-2 py-2 text-sm ${inputClass}`} value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder='Folder' />
        <button type='button' aria-label='Add folder' className='rounded-md border px-3 py-2' onClick={addFolder}><FolderPlus className='h-4 w-4' /></button>
      </div>

      <div className='space-y-1'>
        <button type='button' className={`w-full rounded-md px-2 py-2 text-left text-sm ${selectedFolderId === '' ? 'bg-blue-500/10' : ''}`} onClick={() => setSelectedFolderId('')}>Unfiled</button>
        {collectionFolders.map((folder) => <div key={folder.id} className='flex items-center gap-1'>
          <button type='button' className={`min-w-0 flex-1 rounded-md px-2 py-2 text-left text-sm ${selectedFolderId === folder.id ? 'bg-blue-500/10' : ''}`} onClick={() => setSelectedFolderId(folder.id)}>{folder.name}</button>
          <button type='button' aria-label={`Delete folder ${folder.name}`} className='rounded-md p-2 opacity-70 hover:opacity-100' onClick={() => removeFolder(folder.id)}><Trash2 className='h-4 w-4' /></button>
        </div>)}
      </div>

      <div className='space-y-2 border-t pt-3'>
        <input aria-label='Saved request name' className={`w-full rounded-md border px-2 py-2 text-sm ${inputClass}`} value={requestName} onChange={(event) => setRequestName(event.target.value)} placeholder='Request name' />
        <select aria-label='Saved request folder' className={`w-full rounded-md border px-2 py-2 text-sm ${inputClass}`} value={selectedFolderId} onChange={(event) => setSelectedFolderId(event.target.value)}>
          <option value=''>Unfiled</option>
          {collectionFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
        <button type='button' className='inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium' onClick={saveRequest}>
          <Save className='h-4 w-4' /> {activeRequestId ? 'Update request' : 'Save request'}
        </button>
      </div>

      <div className='space-y-3 border-t pt-3'>
        {collectionRequests.filter((saved) => !saved.folderId).map(renderSavedRequest)}
        {collectionFolders.map((folder) => {
          const requests = collectionRequests.filter((saved) => saved.folderId === folder.id);
          if (requests.length === 0) return null;
          return <div key={folder.id}>
            <div className={`mb-1 px-2 text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>{folder.name}</div>
            <div className='space-y-1'>{requests.map(renderSavedRequest)}</div>
          </div>;
        })}
        {collectionRequests.length === 0 && <p className={`px-2 text-xs ${mutedClass}`}>Save the current request to build a reusable collection.</p>}
      </div>
    </>}
  </section>;
};
