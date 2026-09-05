import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Upload } from 'lucide-react';
import {
  importPostmanDocument,
  mergePostmanCollectionImport,
  mergePostmanEnvironmentImport,
} from '../utils/api-client-postman';
import type { ApiClientImportWarning, PostmanDocumentImportResult } from '../utils/api-client-postman';
import type { ApiClientWorkspaceState } from '../utils/api-client-workspace';

interface Props {
  onWorkspaceChange: React.Dispatch<React.SetStateAction<ApiClientWorkspaceState>>;
  onSelectedCollectionChange?: (collectionId?: string) => void;
  theme: 'light' | 'dark';
}

interface ImportStatus {
  tone: 'success' | 'warning' | 'error';
  text: string;
}

function countLabel(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

export const ApiClientImport: React.FC<Props> = ({ onWorkspaceChange, onSelectedCollectionChange, theme }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [warnings, setWarnings] = useState<ApiClientImportWarning[]>([]);

  const importFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const documents: PostmanDocumentImportResult[] = [];
    const nextWarnings: ApiClientImportWarning[] = [];
    const failures: string[] = [];

    for (const file of files) {
      try {
        const parsed = JSON.parse(await file.text()) as unknown;
        const imported = importPostmanDocument(parsed);
        documents.push(imported);
        nextWarnings.push(...imported.result.warnings.map((entry) => ({ ...entry, path: `${file.name}:${entry.path}` })));
      } catch (cause) {
        failures.push(`${file.name}: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
    }

    if (documents.length > 0) {
      onWorkspaceChange((current) => {
        let next = current;
        for (const document of documents) {
          next = document.kind === 'collection'
            ? mergePostmanCollectionImport(next, document.result)
            : mergePostmanEnvironmentImport(next, document.result);
        }
        return next;
      });
    }

    const collectionImports = documents.filter((document) => document.kind === 'collection');
    const environmentCount = documents.length - collectionImports.length;
    const selectedCollection = collectionImports[collectionImports.length - 1];
    if (selectedCollection?.kind === 'collection') onSelectedCollectionChange?.(selectedCollection.result.collection.id);

    setWarnings(nextWarnings);
    const importedParts = [
      collectionImports.length > 0 ? countLabel(collectionImports.length, 'collection') : '',
      environmentCount > 0 ? countLabel(environmentCount, 'environment') : '',
    ].filter(Boolean);
    if (documents.length === 0) {
      setStatus({ tone: 'error', text: failures.join(' ') || 'No Postman documents were imported.' });
    } else if (failures.length > 0 || nextWarnings.length > 0) {
      setStatus({
        tone: 'warning',
        text: `Imported ${importedParts.join(' and ')}. ${failures.length > 0 ? `${failures.length} file${failures.length === 1 ? '' : 's'} failed to import.` : `${nextWarnings.length} compatibility warning${nextWarnings.length === 1 ? '' : 's'} need review.`}`,
      });
    } else {
      setStatus({ tone: 'success', text: `Imported ${importedParts.join(' and ')}.` });
    }
  };

  const inputClass = theme === 'dark' ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-300 bg-white text-gray-900';
  const mutedClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
  const warningClass = theme === 'dark' ? 'text-amber-300' : 'text-amber-700';
  const successClass = theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700';
  const errorClass = theme === 'dark' ? 'text-red-300' : 'text-red-700';

  return <section className='space-y-3' aria-labelledby='api-client-import-heading'>
    <div className='flex items-center gap-2'>
      <Upload className='h-4 w-4' />
      <h3 id='api-client-import-heading' className='font-semibold'>Import</h3>
    </div>
    <input
      ref={inputRef}
      type='file'
      accept='.json,application/json'
      multiple
      className='hidden'
      aria-label='Import Postman JSON'
      onChange={(event) => {
        const files = Array.from(event.currentTarget.files || []);
        event.currentTarget.value = '';
        void importFiles(files);
      }}
    />
    <button
      type='button'
      className={`flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${inputClass}`}
      onClick={() => inputRef.current?.click()}
    >
      <Upload className='h-4 w-4' />
      Import Postman
    </button>
    <p className={`text-xs ${mutedClass}`}>Import Postman Collection v2.1 and exported environment JSON files. Multiple files can be selected together.</p>

    {status && <div className={`flex items-start gap-2 text-xs ${status.tone === 'success' ? successClass : status.tone === 'warning' ? warningClass : errorClass}`} role='status'>
      {status.tone === 'success' ? <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0' /> : <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />}
      <span>{status.text}</span>
    </div>}

    {warnings.length > 0 && <details className={`text-xs ${warningClass}`}>
      <summary className='cursor-pointer font-medium'>Review import warnings ({warnings.length})</summary>
      <ul className='mt-2 space-y-2 pl-4'>
        {warnings.slice(0, 5).map((entry, index) => <li key={`${entry.code}-${entry.path}-${index}`}>
          <span className='font-mono'>{entry.path}</span>: {entry.message}
        </li>)}
        {warnings.length > 5 && <li>{warnings.length - 5} more warning{warnings.length - 5 === 1 ? '' : 's'} not shown.</li>}
      </ul>
    </details>}
  </section>;
};
