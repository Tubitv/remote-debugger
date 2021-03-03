const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const DEVTOOLS_FRONTEND_ROOT = path.resolve(ROOT, 'node_modules', 'chrome-devtools-frontend', 'front_end');
function restoreFilesSymbolicLink() {
  const dirNamePaths = fs.readdirSync(path.resolve(ROOT, 'lib', 'chrome-devtools-frontend', 'front_end'));
  dirNamePaths.forEach(dirName => {
    if (['remote_debug', 'tubi_debug', 'hooks'].includes(dirName)) {
      return;
    }
    if (/\.(html|js)/.test(dirName)) {
      const filePath = `${dirName}`;
      const linkPath = path.resolve(DEVTOOLS_FRONTEND_ROOT, filePath);
      const backupPath = path.resolve(DEVTOOLS_FRONTEND_ROOT, filePath + '-backup');

      if (!fs.existsSync(backupPath)) {
        return;
      }

      fs.unlinkSync(linkPath);
      fs.copyFileSync(backupPath, linkPath);
      fs.unlinkSync(backupPath);
      return;
    }
    const filePaths = fs.readdirSync(path.resolve(DEVTOOLS_FRONTEND_ROOT, dirName));
    filePaths.forEach(fileName => {
      const filePath = `${dirName}/${fileName}`;
      const linkPath = path.resolve(DEVTOOLS_FRONTEND_ROOT, filePath);
      const backupPath = path.resolve(DEVTOOLS_FRONTEND_ROOT, filePath + '-backup');

      if (!fs.existsSync(backupPath)) {
        return;
      }

      fs.unlinkSync(linkPath);
      fs.copyFileSync(backupPath, linkPath);
      fs.unlinkSync(backupPath);
    });
  });
  
}

console.log('Start restore');
restoreFilesSymbolicLink();
console.log('DONE.');