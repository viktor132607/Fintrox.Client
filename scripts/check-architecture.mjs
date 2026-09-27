import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(root, 'apps/web/src');
const modulesRoot = resolve(sourceRoot, 'modules');
const catalog = JSON.parse(readFileSync(resolve(root, 'architecture/modules.json'), 'utf8')).modules;
const errors = [];
const expected = catalog.map(m => m.slug).sort();
const actual = readdirSync(modulesRoot, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
if (JSON.stringify(expected) !== JSON.stringify(actual)) errors.push('Module catalog/folders mismatch');
for (const field of ['name', 'slug', 'schema']) {
  if (new Set(catalog.map(m => m[field])).size !== catalog.length) errors.push(`Duplicate ${field}`);
}
for (const slug of expected) {
  for (const entry of ['api', 'components', 'hooks', 'schemas', 'types', 'index.ts']) {
    if (!existsSync(resolve(modulesRoot, slug, entry))) errors.push(`${slug}: missing ${entry}`);
  }
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? files(resolve(directory, e.name)) : /\.[cm]?[jt]sx?$/.test(e.name) ? [resolve(directory, e.name)] : []);
}
function check(file, specifier) {
  const source = relative(sourceRoot, file).split(sep);
  const forbidden = ['pg', 'postgres', 'prisma', '@prisma/client', 'typeorm', 'sequelize'];
  if (forbidden.some(p => specifier === p || specifier.startsWith(`${p}/`))) {
    errors.push(`${file}: database dependency ${specifier}`);
  }
  let target;
  if (specifier.startsWith('@/')) target = resolve(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) target = resolve(dirname(file), specifier);
  else return;
  const destination = relative(sourceRoot, target).split(sep);
  if (destination[0] === '..') {
    errors.push(`${file}: import outside source boundary ${specifier}`);
    return;
  }
  if (source[0] === 'shared' && destination[0] !== 'shared') errors.push(`${file}: shared imports ${specifier}`);
  if (source[0] === 'modules' && !(destination[0] === 'shared' ||
      (destination[0] === 'modules' && destination[1] === source[1]))) {
    errors.push(`${file}: module imports forbidden layer ${specifier}`);
  }
  if (destination[0] === 'modules' && !(source[0] === 'modules' && source[1] === destination[1])) {
    const entry = destination.slice(2).join('/');
    if (entry !== '' && !/^index(?:\.[cm]?[jt]sx?)?$/.test(entry)) errors.push(`${file}: private module import ${specifier}`);
  }
}
for (const file of files(sourceRoot)) {
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      check(file, node.moduleSpecifier.text);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
      check(file, node.argument.literal.text);
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
      check(file, node.moduleReference.expression.text);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const [specifier] = node.arguments;
      if (specifier && ts.isStringLiteralLike(specifier)) check(file, specifier.text);
      else errors.push(`${file}: computed module import is not permitted`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Architecture passed: ${catalog.length} modules, public entry points and import directions.`);
