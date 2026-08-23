import {createHash} from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import {basename, dirname, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'

export function installedSkillBundle() {
  try {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const paths = skillBundlePaths(root)
    const files = {}
    const aggregate = createHash('sha256')
    for (const path of paths) {
      const name = relative(root, path).split(/[/\\]/).join('/')
      const digest = createHash('sha256').update(readFileSync(path)).digest('hex')
      files[name] = digest
      aggregate.update(name).update('\0').update(digest).update('\n')
    }
    return {sha256: aggregate.digest('hex'), files, paths, root}
  } catch {
    return {sha256: null, files: {}, paths: [], root: null}
  }
}

export function archiveInstalledSkillVersion(dataRoot, bundle, capturedAt, metadata) {
  if (!bundle.sha256 || !bundle.root) return
  const directory = join(dataRoot, 'versions', bundle.sha256)
  const manifestPath = join(directory, 'manifest.json')
  if (existsSync(manifestPath)) return

  ensurePrivateDirectory(directory)
  for (const source of bundle.paths) {
    copyPrivateFile(source, join(directory, 'bundle', relative(bundle.root, source)))
  }
  writePrivateJson(manifestPath, {
    schema_version: metadata.schema_version,
    auto_pilot_version: metadata.auto_pilot_version,
    skill_bundle_sha256: bundle.sha256,
    captured_at: capturedAt.toISOString(),
    files: bundle.files,
  })
}

function skillBundlePaths(root, directory = root) {
  const paths = []
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (entry.isSymbolicLink()) continue
    if (['.git', '__pycache__', 'dist'].includes(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      paths.push(...skillBundlePaths(root, path))
    } else if (entry.isFile() && !entry.name.endsWith('.pyc') && entry.name !== '.DS_Store') {
      paths.push(path)
    }
  }
  return paths.sort((left, right) => relative(root, left).localeCompare(relative(root, right)))
}

function ensurePrivateDirectory(path) {
  if (existsSync(path)) {
    const stats = lstatSync(path)
    if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error(`refusing unsafe history directory: ${path}`)
  } else {
    const parent = dirname(path)
    if (existsSync(parent)) {
      const parentStats = lstatSync(parent)
      if (parentStats.isSymbolicLink() || !parentStats.isDirectory()) throw new Error(`refusing unsafe history parent: ${parent}`)
    }
  }
  mkdirSync(path, {recursive: true, mode: 0o700})
  try { chmodSync(path, 0o700) } catch {}
}

function writePrivateJson(path, value) {
  ensurePrivateDirectory(dirname(path))
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`)
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600})
  renameSync(temporary, path)
  try { chmodSync(path, 0o600) } catch {}
}

function copyPrivateFile(source, destination) {
  ensurePrivateDirectory(dirname(destination))
  const temporary = join(dirname(destination), `.${basename(destination)}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`)
  copyFileSync(source, temporary)
  try { chmodSync(temporary, 0o600) } catch {}
  renameSync(temporary, destination)
}
