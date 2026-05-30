import type { UmlEdge, UmlMember, UmlNode } from '../../types/uml';

const visibilityKeyword = {
  public: 'public',
  private: 'private',
  protected: 'protected',
  package: '',
} as const;

const keyword = (member: UmlMember) => {
  const parts = [visibilityKeyword[member.visibility]];
  if (member.isStatic) parts.push('static');
  if (member.isAbstract) parts.push('abstract');
  return parts.filter(Boolean).join(' ');
};

const inheritanceFor = (node: UmlNode, nodes: UmlNode[], edges: UmlEdge[]) => {
  const outgoing = edges.filter((edge) => edge.source === node.id);
  const parent = outgoing.find((edge) => edge.data?.relation === 'inheritance');
  const interfaces = outgoing.filter((edge) => edge.data?.relation === 'implementation');
  const parentName = parent ? nodes.find((item) => item.id === parent.target)?.data.name : undefined;
  const interfaceNames = interfaces
    .map((edge) => nodes.find((item) => item.id === edge.target)?.data.name)
    .filter(Boolean);

  return { parentName, interfaceNames };
};

const renderField = (field: UmlMember) =>
  `    ${keyword(field)} ${field.type || 'String'} ${field.name || 'field'};`;

const renderMethod = (method: UmlMember, inInterface: boolean) => {
  const name = method.name || 'method';
  const returnType = method.type || 'void';
  const signature = `${keyword(method)} ${returnType} ${name}()`.trim();
  if (inInterface || method.isAbstract) return `    ${signature};`;
  const defaultValue =
    returnType === 'void' ? '' : `\n        return ${returnType === 'boolean' ? 'false' : 'null'};`;
  return `    ${signature} {${defaultValue}\n    }`;
};

const renderNode = (node: UmlNode, nodes: UmlNode[], edges: UmlEdge[]) => {
  const { kind, name, packageName, fields, methods, enumValues } = node.data;
  const { parentName, interfaceNames } = inheritanceFor(node, nodes, edges);
  const declarationKind = kind === 'interface' ? 'interface' : kind === 'enum' ? 'enum' : 'class';
  const abstractModifier = kind === 'abstract' ? 'abstract ' : '';
  const extendsClause = parentName ? ` extends ${parentName}` : '';
  const implementsClause = interfaceNames.length ? ` implements ${interfaceNames.join(', ')}` : '';
  const packageLine = packageName ? `package ${packageName};\n\n` : '';

  if (kind === 'enum') {
    return `${packageLine}public enum ${name} {\n    ${(enumValues?.length ? enumValues : ['VALUE']).join(',\n    ')}\n}`;
  }

  const body = [
    ...fields.map(renderField),
    fields.length && methods.length ? '' : undefined,
    ...methods.map((method) => renderMethod(method, kind === 'interface')),
  ].filter((line) => line !== undefined);

  return `${packageLine}public ${abstractModifier}${declarationKind} ${name}${extendsClause}${implementsClause} {\n${body.join('\n')}\n}`;
};

export const generateJavaCode = (nodes: UmlNode[], edges: UmlEdge[]) =>
  nodes.map((node) => `// ${node.data.name}.java\n${renderNode(node, nodes, edges)}`).join('\n\n');
