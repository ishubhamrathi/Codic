import { createId } from '../ids';
import { createMember } from '../umlFactory';
import type { UmlNode, UmlNodeKind } from '../../types/uml';

const kindFromDeclaration = (source: string): UmlNodeKind => {
  if (/\benum\s+\w+/.test(source)) return 'enum';
  if (/\binterface\s+\w+/.test(source)) return 'interface';
  if (/\babstract\s+class\s+\w+/.test(source)) return 'abstract';
  return 'class';
};

const nameFromDeclaration = (source: string) =>
  source.match(/\b(?:class|interface|enum)\s+([A-Za-z_]\w*)/)?.[1] ?? 'GeneratedClass';

export const parseTextToNodes = (input: string): UmlNode[] => {
  const blocks = input
    .split(/\n(?=(?:class|interface|enum|abstract)\s+)/i)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const kind = kindFromDeclaration(block);
    const name = nameFromDeclaration(block);
    const lines = block
      .replace(/^[^{]+{?/, '')
      .replace(/}$/, '')
      .split(/\n|;/)
      .map((line) => line.trim())
      .filter(Boolean);

    const fields = lines
      .filter((line) => line.includes(':') && !line.includes('('))
      .map((line) => {
        const [left, right] = line.replace(/^[-+#~+]\s*/, '').split(':');
        return createMember(left.trim(), right?.trim() || 'String');
      });

    const methods = lines
      .filter((line) => line.includes('('))
      .map((line) => {
        const clean = line.replace(/^[-+#~+]\s*/, '');
        const [namePart, returnType] = clean.split(':');
        return createMember(namePart.replace(/\(.*\)/, '').trim(), returnType?.trim() || 'void', 'public');
      });

    const enumValues =
      kind === 'enum'
        ? lines.flatMap((line) => line.split(',')).map((value) => value.trim()).filter(Boolean)
        : undefined;

    return {
      id: createId('uml'),
      type: 'umlNode',
      position: { x: 120 + index * 260, y: 120 + (index % 2) * 180 },
      data: {
        kind,
        name,
        fields: kind === 'enum' ? [] : fields,
        methods: kind === 'enum' ? [] : methods,
        enumValues,
      },
    };
  });
};
