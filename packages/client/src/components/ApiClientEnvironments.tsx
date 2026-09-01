import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createApiClientId, deleteApiClientEnvironment } from '../utils/api-client-workspace';
import type { ApiClientWorkspaceState } from '../utils/api-client-workspace';

interface Props {
  workspace: ApiClientWorkspaceState;
  onWorkspaceChange: React.Dispatch<React.SetStateAction<ApiClientWorkspaceState>>;
  theme: 'light' | 'dark';
}

function timestamp(): string {
  return new Date().toISOString();
}

export const ApiClientEnvironments: React.FC<Props> = ({ workspace, onWorkspaceChange, theme }) => {
  const [environmentName, setEnvironmentName] = useState('');
  const activeEnvironment = workspace.environments.find((environment) => environment.id === workspace.activeEnvironmentId);
  const inputClass = theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900';
  const mutedClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';

  const addEnvironment = () => {
    const name = environmentName.trim();
    if (!name) return;
    const createdAt = timestamp();
    const id = createApiClientId('environment');
    onWorkspaceChange((current) => ({
      ...current,
      environments: [...current.environments, { id, name, variables: [], createdAt, updatedAt: createdAt }],
      activeEnvironmentId: id,
    }));
    setEnvironmentName('');
  };

  const renameEnvironment = (name: string) => {
    if (!activeEnvironment) return;
    const updatedAt = timestamp();
    onWorkspaceChange((current) => ({
      ...current,
      environments: current.environments.map((environment) => environment.id === activeEnvironment.id ? { ...environment, name, updatedAt } : environment),
    }));
  };

  const addVariable = () => {
    if (!activeEnvironment) return;
    const updatedAt = timestamp();
    onWorkspaceChange((current) => ({
      ...current,
      environments: current.environments.map((environment) => environment.id === activeEnvironment.id ? {
        ...environment,
        variables: [...environment.variables, { id: createApiClientId('variable'), key: '', value: '', enabled: true }],
        updatedAt,
      } : environment),
    }));
  };

  const updateVariable = (variableId: string, patch: { key?: string; value?: string; enabled?: boolean }) => {
    if (!activeEnvironment) return;
    const updatedAt = timestamp();
    onWorkspaceChange((current) => ({
      ...current,
      environments: current.environments.map((environment) => environment.id === activeEnvironment.id ? {
        ...environment,
        variables: environment.variables.map((variable) => variable.id === variableId ? { ...variable, ...patch } : variable),
        updatedAt,
      } : environment),
    }));
  };

  const removeVariable = (variableId: string) => {
    if (!activeEnvironment) return;
    const updatedAt = timestamp();
    onWorkspaceChange((current) => ({
      ...current,
      environments: current.environments.map((environment) => environment.id === activeEnvironment.id ? {
        ...environment,
        variables: environment.variables.filter((variable) => variable.id !== variableId),
        updatedAt,
      } : environment),
    }));
  };

  return <section className='space-y-3' aria-labelledby='api-client-environment-heading'>
    <div className='flex items-center justify-between gap-2'>
      <h3 id='api-client-environment-heading' className='font-semibold'>Environment</h3>
      {activeEnvironment && <button type='button' aria-label={`Delete environment ${activeEnvironment.name}`} className='rounded-md p-2 opacity-70 hover:opacity-100' onClick={() => onWorkspaceChange((current) => deleteApiClientEnvironment(current, activeEnvironment.id))}><Trash2 className='h-4 w-4' /></button>}
    </div>

    <select
      aria-label='Active environment'
      className={`w-full rounded-md border px-2 py-2 text-sm ${inputClass}`}
      value={workspace.activeEnvironmentId || ''}
      onChange={(event) => onWorkspaceChange((current) => ({ ...current, activeEnvironmentId: event.target.value || undefined }))}
    >
      <option value=''>No environment</option>
      {workspace.environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
    </select>

    <div className='flex gap-2'>
      <input aria-label='New environment name' className={`min-w-0 flex-1 rounded-md border px-2 py-2 text-sm ${inputClass}`} value={environmentName} onChange={(event) => setEnvironmentName(event.target.value)} placeholder='New environment' />
      <button type='button' aria-label='Add environment' className='rounded-md border px-3 py-2' onClick={addEnvironment}><Plus className='h-4 w-4' /></button>
    </div>

    {activeEnvironment && <div className='space-y-3'>
      <input aria-label='Environment name' className={`w-full rounded-md border px-2 py-2 text-sm font-medium ${inputClass}`} value={activeEnvironment.name} onChange={(event) => renameEnvironment(event.target.value)} />
      <div className='flex items-center justify-between'>
        <span className='text-xs font-semibold uppercase tracking-wide'>Variables</span>
        <button type='button' aria-label='Add environment variable' className='inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs' onClick={addVariable}><Plus className='h-3.5 w-3.5' /> Add</button>
      </div>
      <div className='space-y-2'>
        {activeEnvironment.variables.map((variable, index) => <div key={variable.id} className='grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-1'>
          <input aria-label={`Environment variable ${index + 1} enabled`} type='checkbox' checked={variable.enabled !== false} onChange={(event) => updateVariable(variable.id, { enabled: event.target.checked })} />
          <input aria-label={`Environment variable ${index + 1} key`} className={`min-w-0 rounded-md border px-2 py-1.5 font-mono text-xs ${inputClass}`} placeholder='baseUrl' value={variable.key} onChange={(event) => updateVariable(variable.id, { key: event.target.value })} />
          <input aria-label={`Environment variable ${index + 1} value`} className={`min-w-0 rounded-md border px-2 py-1.5 font-mono text-xs ${inputClass}`} placeholder='https://api.example.com' value={variable.value} onChange={(event) => updateVariable(variable.id, { value: event.target.value })} />
          <button type='button' aria-label={`Remove environment variable ${index + 1}`} className='rounded-md p-1.5 opacity-70 hover:opacity-100' onClick={() => removeVariable(variable.id)}><Trash2 className='h-3.5 w-3.5' /></button>
        </div>)}
        {activeEnvironment.variables.length === 0 && <p className={`text-xs ${mutedClass}`}>Add variables such as <code>{'{{baseUrl}}'}</code> or <code>{'{{token}}'}</code>.</p>}
      </div>
    </div>}
  </section>;
};
