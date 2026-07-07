import type { ComponentType } from 'react';
import { MapKind } from './types';
import { ReadingIcon, WritingIcon, CodeIcon, TaskIcon } from './components/Icons/Icons';

interface KindMeta {
  label: string;
  Icon: ComponentType<{ size?: number }>;
  /** CSS custom-property references for the kind's accent + tint. */
  color: string;
  bg: string;
}

// Single source of truth for how each map-item kind is presented (icon + color).
// Shared by MapDetailPage's kind groups and the add-item form.
export const KIND_META: Record<MapKind, KindMeta> = {
  reading: { label: 'Reading', Icon: ReadingIcon, color: 'var(--color-mapkind-reading)', bg: 'var(--color-mapkind-reading-bg)' },
  writing: { label: 'Writing', Icon: WritingIcon, color: 'var(--color-mapkind-writing)', bg: 'var(--color-mapkind-writing-bg)' },
  code: { label: 'Code', Icon: CodeIcon, color: 'var(--color-mapkind-code)', bg: 'var(--color-mapkind-code-bg)' },
  task: { label: 'Task', Icon: TaskIcon, color: 'var(--color-mapkind-task)', bg: 'var(--color-mapkind-task-bg)' },
};
