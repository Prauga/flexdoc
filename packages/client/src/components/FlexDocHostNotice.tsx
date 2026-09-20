import { apiClientHostCapabilityLabel } from '../utils/api-client-execution';
import type { HttpHostExecutionCapability } from '../utils/http-client';

const FlexDocMark = () => <span aria-hidden='true' className='flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white'>F</span>;

export function FlexDocHostNotice({ message, capabilities = [], warning = false, theme = 'light', label = 'Host execution status' }: {
  message: string;
  capabilities?: readonly HttpHostExecutionCapability[];
  warning?: boolean;
  theme?: 'light' | 'dark';
  label?: string;
}) {
  const palette = warning
    ? theme === 'dark' ? 'border-amber-800 bg-amber-950/40 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800'
    : theme === 'dark' ? 'border-blue-800 bg-blue-950/40 text-blue-200' : 'border-blue-300 bg-blue-50 text-blue-800';
  return <div role={warning ? 'alert' : 'status'} aria-label={label} className={`rounded-md border p-3 text-sm ${palette}`}>
    <div className='flex items-start gap-2'><FlexDocMark /><div>{message}
      <details className='mt-1'><summary>API host capabilities</summary>
        <div className='mt-1 text-xs'>Universal: HTTP method, URL, query, headers, body · Host-specific: {capabilities.length ? capabilities.map(apiClientHostCapabilityLabel).join(' · ') : 'None advertised.'}</div>
      </details>
    </div></div>
  </div>;
}
