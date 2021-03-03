const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { dirname } = require('path');

const DEBUG_NAMES = ['remote_debug'];
const ROOT = path.resolve(__dirname, '..');
const DEVTOOLS_FRONTEND_ROOT = path.resolve(ROOT, 'node_modules', 'chrome-devtools-frontend', 'front_end');
const DEVTOOLS_APP_MANIFEST_DISABLED_MODULES = [
  'audits',
  'performance_monitor',
  'security',
  'timeline',
];
const SHELL_MANIFEST_DISABLED_MODULES = [
  'profiler',
];

const { MODE } = process.env;

const symlinkSync = MODE === 'development' ? fs.symlinkSync : fsExtra.copySync;

function createSymbolicLinkForNewFolder(dirName) {
  const linkPath = path.resolve(DEVTOOLS_FRONTEND_ROOT, dirName);
  if (!fs.existsSync(linkPath)) {
    symlinkSync(path.resolve(ROOT, 'lib', 'chrome-devtools-frontend', 'front_end', dirName), linkPath);
  }
}

function createSymbolicLinkForExistingFolder(dirName) {
  const filePaths = fs.readdirSync(path.resolve(ROOT, 'lib', 'chrome-devtools-frontend', 'front_end', dirName));
  filePaths.forEach((fileName, index) => {
    const filePath = `${fileName}`;
    const linkPath = path.resolve(DEVTOOLS_FRONTEND_ROOT, dirName, filePath);
    const backupPath = path.resolve(DEVTOOLS_FRONTEND_ROOT, dirName, filePath + '-backup');
    const ourPath = path.resolve(ROOT, 'lib', 'chrome-devtools-frontend', 'front_end', dirName, filePath);
    if (fs.existsSync(linkPath)) {
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(linkPath, backupPath)
      }
      fs.unlinkSync(linkPath);
    }

    symlinkSync(ourPath, linkPath);
    console.log(`\t\t\t[${index + 1}/${filePaths.length}] Create ${fileName} symbolic link for ${dirName} in Chrome Devtools Frontend module.`);
  });
}

function createSymbolicLinkForExistingFile(filePath) {
  const linkPath = path.resolve(DEVTOOLS_FRONTEND_ROOT, filePath);
  const backupPath = path.resolve(DEVTOOLS_FRONTEND_ROOT, filePath + '-backup');
  const ourPath = path.resolve(ROOT, 'lib', 'chrome-devtools-frontend', 'front_end', filePath);
  if (fs.existsSync(linkPath)) {
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(linkPath, backupPath)
    }
    fs.unlinkSync(linkPath);
  }

  symlinkSync(ourPath, linkPath);
  console.log(`\t\t\t[1/1] Create ${filePath} symbolic link in Chrome Devtools Frontend module.`);
}

function createFilesSymbolicLink() {
  const dirNamePaths = fs.readdirSync(path.resolve(ROOT, 'lib', 'chrome-devtools-frontend', 'front_end'));
  const totalFoldersNumber = dirNamePaths.length;
  dirNamePaths.forEach((dirName, index) => {
    console.log(chalk.cyan(`\t\t[${index + 1}/${totalFoldersNumber}] Create ${dirName} symbolic link in Chrome Devtools Frontend module.`));
    if ((/_debug$|^hooks$/).test(dirName)) {
      createSymbolicLinkForNewFolder(dirName);
    } else if (/\.(html|js)/.test(dirName)) {
      createSymbolicLinkForExistingFile(dirName);
    } else {
      createSymbolicLinkForExistingFolder(dirName);
    }
  });
  
}

function patchDevtoolsAppManifest() {
  const manifestPath = path.resolve(DEVTOOLS_FRONTEND_ROOT, 'devtools_app.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));

  // Remove disabled modules
  manifest.modules = manifest.modules.filter(module => !DEVTOOLS_APP_MANIFEST_DISABLED_MODULES.includes(module.name));

  DEBUG_NAMES.forEach((DEBUG_NAME) => {
    // Append Debug module
    const hasDebugModule = !!manifest.modules.find(module => module.name === DEBUG_NAME);
    if (!hasDebugModule) {
      manifest.modules.push({ name: DEBUG_NAME });
    }
  });
  

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function patchShellManifest() {
  const manifestPath = path.resolve(DEVTOOLS_FRONTEND_ROOT, 'shell.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.modules = manifest.modules.filter(module => !SHELL_MANIFEST_DISABLED_MODULES.includes(module.name));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function patchSourcesManifest() {
  // patch Sources manifest to hide it from panel
  const manifestPath = path.resolve(DEVTOOLS_FRONTEND_ROOT, 'sources', 'module.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.extensions = manifest.extensions.map(extension => {
    if (extension.location === 'panel') {
      extension.location = 'settings-view';
    }
    return extension;
  });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function patchDevtoolsManifests() {
  patchDevtoolsAppManifest();
  patchShellManifest();
  patchSourcesManifest();
}

console.log('Start setting up Remote Debugger extension.');
console.log(chalk.green('\t[1/2] Create symbolic link for files in Chrome Devtools Frontend module.'));
createFilesSymbolicLink();
console.log(chalk.green('\t[2/2] Patch manifest files in Chrome Devtools Frontend module to customize panel view.'));
patchDevtoolsManifests();
console.log(chalk.green('DONE.'));