import React from 'react';
import { OpenAPISpec, Reference, Schema } from '../types/openapi';
import { OpenAPIParser } from '../utils/openapi-parser';
import { CodeBlock } from './CodeBlock';

interface Props {
  spec: OpenAPISpec;
  schema: Schema | Reference;
  theme: 'light' | 'dark';
  required?: boolean;
  level?: number;
  seen?: Set<string>;
  requiredPropsFirst?: boolean;
  sortPropsAlphabetically?: boolean;
}

function typeLabel(schema: Schema): string {
  const type = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type;
  if (type) return schema.format ? `${type} (${schema.format})` : type;
  if (schema.oneOf) return 'oneOf';
  if (schema.anyOf) return 'anyOf';
  if (schema.allOf) return 'allOf';
  if (schema.const !== undefined) return 'const';
  return 'any';
}

export const SchemaView: React.FC<Props> = ({ spec, schema, theme, required = false, level = 0, seen = new Set(), requiredPropsFirst = false, sortPropsAlphabetically = false }) => {
  const childProps = { spec, theme, requiredPropsFirst, sortPropsAlphabetically };
  if (OpenAPIParser.isReference(schema)) {
    if (seen.has(schema.$ref)) return <div className='py-1 text-sm opacity-70'>↳ <code>{schema.$ref.replace('#/components/schemas/', '')}</code> (recursive reference)</div>;
    const nextSeen = new Set(seen); nextSeen.add(schema.$ref);
    let resolved: Schema | Reference;
    try {
      resolved = OpenAPIParser.resolveReference<Schema | Reference>(spec, schema.$ref);
    } catch {
      return <div className='py-1 text-sm text-red-500'>Unresolved reference: <code>{schema.$ref}</code></div>;
    }
    return <SchemaView {...childProps} schema={resolved} required={required} level={level} seen={nextSeen} />;
  }

  const muted = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const border = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';
  const compositions: Array<[string, (Schema | Reference)[] | undefined]> = [['All of', schema.allOf], ['One of', schema.oneOf], ['Any of', schema.anyOf]];
  const requiredSet = new Set(schema.required || []);
  const propertyEntries = Object.entries(schema.properties || {}).sort(([a], [b]) => {
    if (requiredPropsFirst) {
      const requiredDelta = Number(requiredSet.has(b)) - Number(requiredSet.has(a));
      if (requiredDelta) return requiredDelta;
    }
    return sortPropsAlphabetically ? a.localeCompare(b) : 0;
  });

  return <div className={level ? `border-l-2 ${border} pl-3` : ''}>
    <div className='flex flex-wrap items-center gap-2 py-1'>
      <span className={theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}>{typeLabel(schema)}</span>
      {required && <span className='rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300'>required</span>}
      {(schema.nullable || (Array.isArray(schema.type) && schema.type.includes('null'))) && <span className='rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300'>nullable</span>}
      {schema.deprecated && <span className='rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700'>deprecated</span>}
      {schema.readOnly && <span className='text-xs opacity-60'>readOnly</span>}
      {schema.writeOnly && <span className='text-xs opacity-60'>writeOnly</span>}
    </div>
    {schema.description && <p className={`mt-1 text-sm leading-relaxed ${muted}`}>{schema.description}</p>}
    {schema.enum && <p className={`mt-1 text-xs ${muted}`}>Allowed: {schema.enum.map(String).join(', ')}</p>}
    {schema.const !== undefined && <p className={`mt-1 text-xs ${muted}`}>Constant: {JSON.stringify(schema.const)}</p>}
    {schema.default !== undefined && <p className={`mt-1 text-xs ${muted}`}>Default: {JSON.stringify(schema.default)}</p>}
    {(schema.example !== undefined || schema.examples?.length) && <div className='mt-2'><CodeBlock code={JSON.stringify(schema.example ?? schema.examples?.[0], null, 2)} language='json' title='Example' showCopy={false} theme={theme} wrap /></div>}
    {schema.items && <div className='mt-3'><div className='mb-1 text-xs font-semibold uppercase tracking-wide opacity-60'>Items</div><SchemaView {...childProps} schema={schema.items} level={level + 1} seen={seen} /></div>}
    {compositions.map(([label, items]) => items?.length ? <div key={label} className='mt-3'><div className='mb-2 text-xs font-semibold uppercase tracking-wide opacity-60'>{label}</div><div className='space-y-3'>{items.map((item, index) => <SchemaView key={index} {...childProps} schema={item} level={level + 1} seen={seen} />)}</div></div> : null)}
    {propertyEntries.length > 0 && <div className='mt-3 space-y-3'>{propertyEntries.map(([name, property]) => <div key={name}><div className='font-mono text-sm font-medium'>{name}</div><SchemaView {...childProps} schema={property} required={requiredSet.has(name)} level={level + 1} seen={seen} /></div>)}</div>}
    {schema.additionalProperties && typeof schema.additionalProperties === 'object' && <div className='mt-3'><div className='mb-1 text-xs font-semibold uppercase tracking-wide opacity-60'>Additional properties</div><SchemaView {...childProps} schema={schema.additionalProperties} level={level + 1} seen={seen} /></div>}
  </div>;
};
