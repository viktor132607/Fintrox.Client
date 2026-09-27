import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

type ModuleCatalogEntry = {
  name: string;
  slug: string;
  schema: string;
  features: string[];
};

type ModuleCatalog = {
  modules: ModuleCatalogEntry[];
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "apps/web/src");
const modulesRoot = resolve(sourceRoot, "modules");
const catalogData = JSON.parse(
  readFileSync(resolve(root, "architecture/modules.json"), "utf8"),
) as ModuleCatalog;
const catalog = catalogData.modules;

const errors: string[] = [];
type ExperienceManifest = {
  capabilities: { id: string; module: string; feature: string }[];
  profiles: { id: string }[];
  ownership: Record<string, string>;
  requiredDirectories: { client: string[] };
};
const manifest = JSON.parse(readFileSync(resolve(root, "architecture/experience-integration.json"), "utf8")) as ExperienceManifest;
const featureKeys = catalog.flatMap(m => m.features.map(f => `${m.name}/${f}`)).sort();
const capabilityKeys = manifest.capabilities.map(c => `${c.module}/${c.feature}`).sort();
if (JSON.stringify(featureKeys) !== JSON.stringify(capabilityKeys)) errors.push("Capability catalog must cover every feature exactly once");
if (new Set(manifest.capabilities.map(c => c.id)).size !== manifest.capabilities.length) errors.push("Duplicate capability ID");
if (JSON.stringify(manifest.profiles.map(p => p.id).sort()) !== JSON.stringify(["accountant", "expert", "simple"])) errors.push("Expected exactly three base profiles");
const owners = { activation: "Capabilities", appInstallations: "Integrations", preferences: "Experience", authorization: "Identity" };
if (Object.keys(manifest.ownership).length !== Object.keys(owners).length || Object.entries(owners).some(([key, value]) => manifest.ownership[key] !== value)) errors.push("Invalid platform ownership");
for (const directory of manifest.requiredDirectories.client) {
  if (!existsSync(resolve(root, directory))) errors.push(`Missing platform directory: ${directory}`);
}
const expected = catalog.map((module) => module.slug).sort();
const actual = readdirSync(modulesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (JSON.stringify(expected) !== JSON.stringify(actual)) {
  errors.push("Module catalog/folders mismatch");
}

for (const field of ["name", "slug", "schema"] as const) {
  if (new Set(catalog.map((module) => module[field])).size !== catalog.length) {
    errors.push(`Duplicate ${field}`);
  }
}

for (const slug of expected) {
  for (const entry of ["api", "components", "hooks", "schemas", "types", "index.ts"]) {
    if (!existsSync(resolve(modulesRoot, slug, entry))) {
      errors.push(`${slug}: missing ${entry}`);
    }
  }
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    if (/\.(?:js|jsx|mjs|cjs)$/.test(entry.name)) {
      errors.push(`${path}: JavaScript source is not permitted; use TypeScript`);
      return [];
    }

    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function checkImport(file: string, specifier: string): void {
  const source = relative(sourceRoot, file).split(sep);
  const forbiddenDatabasePackages = [
    "pg",
    "postgres",
    "prisma",
    "@prisma/client",
    "typeorm",
    "sequelize",
  ];

  if (
    forbiddenDatabasePackages.some(
      (packageName) =>
        specifier === packageName || specifier.startsWith(`${packageName}/`),
    )
  ) {
    errors.push(`${file}: database dependency ${specifier}`);
  }

  let target: string;

  if (specifier.startsWith("@/")) {
    target = resolve(sourceRoot, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    target = resolve(dirname(file), specifier);
  } else {
    return;
  }

  const destination = relative(sourceRoot, target).split(sep);

  if (destination[0] === "..") {
    errors.push(`${file}: import outside source boundary ${specifier}`);
    return;
  }

  if (source[0] === "shared" && destination[0] !== "shared") {
    errors.push(`${file}: shared imports ${specifier}`);
  }

  if (source[0] === "experience" && destination[0] !== "experience" && destination[0] !== "shared") {
    errors.push(`${file}: experience imports forbidden layer ${specifier}`);
  }

  if (
    source[0] === "modules" &&
    !(
      destination[0] === "shared" ||
      (destination[0] === "modules" && destination[1] === source[1])
    )
  ) {
    errors.push(`${file}: module imports forbidden layer ${specifier}`);
  }

  if (
    destination[0] === "modules" &&
    !(source[0] === "modules" && source[1] === destination[1])
  ) {
    const entry = destination.slice(2).join("/");

    if (entry !== "" && !/^index(?:\.(?:ts|tsx))?$/.test(entry)) {
      errors.push(`${file}: private module import ${specifier}`);
    }
  }
}

for (const file of sourceFiles(sourceRoot)) {
  const ast = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      checkImport(file, node.moduleSpecifier.text);
    }

    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      checkImport(file, node.argument.literal.text);
    }

    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      checkImport(file, node.moduleReference.expression.text);
    }

    if (
      ts.isCallExpression(node) &&
      (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")
      )
    ) {
      const [specifier] = node.arguments;

      if (specifier && ts.isStringLiteralLike(specifier)) {
        checkImport(file, specifier.text);
      } else {
        errors.push(`${file}: computed module import is not permitted`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(ast);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Architecture passed: ${catalog.length} modules, TypeScript-only source, public entry points and import directions.`,
);
