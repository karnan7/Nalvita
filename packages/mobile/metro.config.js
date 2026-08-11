// Metro in a monorepo: by default it only looks in this package's own
// node_modules, so workspace packages (@nalvita/core, @nalvita/data) and the
// hoisted dependencies they share with the web app would not resolve.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so edits in core/data trigger a rebuild.
config.watchFolders = [workspaceRoot];

// Resolve from this package first, then the hoisted root — npm workspaces put
// most dependencies at the root, and the workspace packages are symlinks there.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Without this, a symlinked workspace package can pull in a second copy of
// React and blow up with "invalid hook call".
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
