import type { Edge, Node } from '@xyflow/react';

export type UmlNodeKind = 'class' | 'interface' | 'enum' | 'abstract';

export type UmlVisibility = 'public' | 'private' | 'protected' | 'package';

export type UmlMember = {
  id: string;
  visibility: UmlVisibility;
  name: string;
  type: string;
  isStatic?: boolean;
  isAbstract?: boolean;
};

export type UmlNodeData = {
  kind: UmlNodeKind;
  name: string;
  packageName?: string;
  fields: UmlMember[];
  methods: UmlMember[];
  enumValues?: string[];
};

export type UmlNode = Node<UmlNodeData, 'umlNode'>;

export type UmlRelationKind =
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'inheritance'
  | 'implementation'
  | 'dependency';

export type UmlEdgeData = {
  relation: UmlRelationKind;
  label?: string;
};

export type UmlEdge = Edge<UmlEdgeData>;

export type DiagramSnapshot = {
  id?: string;
  name: string;
  nodes: UmlNode[];
  edges: UmlEdge[];
  updatedAt: string;
};
