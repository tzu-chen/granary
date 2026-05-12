export interface CrossAppLink {
  app: string;
  ref_type: string;
  ref_id: string;
  label?: string;
}

const LINK_REGEX = /\[\[([\w]+):([\w]+):([^\|\]]+)(?:\|([^\]]+))?\]\]/g;

export function parseCrossAppLinks(content: string): CrossAppLink[] {
  const seen = new Set<string>();
  const links: CrossAppLink[] = [];
  let match: RegExpExecArray | null;
  LINK_REGEX.lastIndex = 0;
  while ((match = LINK_REGEX.exec(content)) !== null) {
    const [, app, ref_type, ref_id, label] = match;
    const key = `${app}:${ref_type}:${ref_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const link: CrossAppLink = { app, ref_type, ref_id: ref_id.trim() };
    if (label) link.label = label.trim();
    links.push(link);
  }
  return links;
}

export function countTodos(content: string): { open: number; total: number } {
  let open = 0;
  let total = 0;
  const lines = content.split('\n');
  const openRe = /^\s*[-*+]\s+\[ \]\s+/;
  const doneRe = /^\s*[-*+]\s+\[[xX]\]\s+/;
  for (const line of lines) {
    if (openRe.test(line)) {
      open++;
      total++;
    } else if (doneRe.test(line)) {
      total++;
    }
  }
  return { open, total };
}

export function derivePersistedFields(content: string): {
  links: CrossAppLink[];
  open_todo_count: number;
  total_todo_count: number;
} {
  const links = parseCrossAppLinks(content);
  const { open, total } = countTodos(content);
  return { links, open_todo_count: open, total_todo_count: total };
}
