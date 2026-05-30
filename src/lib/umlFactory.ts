import { createId } from './ids';
import type { UmlMember, UmlNode, UmlNodeData, UmlNodeKind } from '../types/uml';

export const visibilitySymbol = {
  public: '+',
  private: '-',
  protected: '#',
  package: '~',
} as const;

export const createMember = (
  name: string,
  type: string,
  visibility: UmlMember['visibility'] = 'private',
): UmlMember => ({
  id: createId('member'),
  name,
  type,
  visibility,
});

export const createNodeData = (kind: UmlNodeKind, index: number): UmlNodeData => {
  const title = {
    class: `Class${index}`,
    abstract: `Abstract${index}`,
    interface: `Interface${index}`,
    enum: `Enum${index}`,
  }[kind];

  if (kind === 'enum') {
    return {
      kind,
      name: title,
      fields: [],
      methods: [],
      enumValues: ['VALUE_ONE', 'VALUE_TWO'],
    };
  }

  return {
    kind,
    name: title,
    fields: [createMember('id', 'Long')],
    methods: [createMember('getId', 'Long', 'public')],
  };
};

export const createUmlNode = (
  kind: UmlNodeKind,
  position: { x: number; y: number },
  index: number,
): UmlNode => ({
  id: createId('uml'),
  type: 'umlNode',
  position,
  data: createNodeData(kind, index),
});
