const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

const directTargets = [
  path.join(projectRoot, 'release', 'data')
];

function removeIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  fs.rmSync(targetPath, {
    recursive: true,
    force: true
  });
  console.log(`Limpieza aplicada: ${targetPath}`);
}

function cleanPortableFolderData(rootDirectory) {
  if (!fs.existsSync(rootDirectory)) {
    return;
  }

  fs.readdirSync(rootDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .forEach((entry) => {
      const folderPath = path.join(rootDirectory, entry.name);
      if (!/portable/i.test(entry.name)) {
        return;
      }

      removeIfExists(path.join(folderPath, 'data'));
    });
}

function cleanNestedReleaseData(rootDirectory) {
  if (!fs.existsSync(rootDirectory)) {
    return;
  }

  fs.readdirSync(rootDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .forEach((entry) => {
      const folderPath = path.join(rootDirectory, entry.name);
      removeIfExists(path.join(folderPath, 'data'));
    });
}

directTargets.forEach(removeIfExists);
cleanPortableFolderData(path.join(projectRoot, 'release'));
cleanNestedReleaseData(path.join(projectRoot, 'release'));
