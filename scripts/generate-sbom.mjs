import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const outputDir = path.join(root, 'artifacts', 'release');
const outputPath = path.join(outputDir, `SBOM-${version}.cdx.json`);
const cliPath = path.join(root, 'node_modules', '@cyclonedx', 'cyclonedx-npm', 'bin', 'cyclonedx-npm-cli.js');

fs.mkdirSync(outputDir, {recursive: true});
const result = spawnSync(
  process.execPath,
  [cliPath, '--output-file', outputPath, '--output-format', 'JSON'],
  {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit'
  }
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const sbom = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
if (sbom.bomFormat !== 'CycloneDX' || !Array.isArray(sbom.components) || sbom.components.length === 0) {
  throw new Error('Generated SBOM is empty or invalid.');
}

process.stdout.write(`SBOM_OK ${path.relative(root, outputPath)} ${sbom.components.length} components\n`);
