const path = require('path');

async function main() {
  const { getCurrentFuseWire, FuseState, FuseV1Options } = await import('@electron/fuses');
  const executablePath = path.resolve(process.argv[2] || 'release/win-unpacked/OrbitPOS.exe');
  const config = await getCurrentFuseWire(executablePath);
  const expected = [
    ['RunAsNode', FuseV1Options.RunAsNode, FuseState.DISABLE],
    ['EnableCookieEncryption', FuseV1Options.EnableCookieEncryption, FuseState.ENABLE],
    ['EnableNodeOptionsEnvironmentVariable', FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseState.DISABLE],
    ['EnableNodeCliInspectArguments', FuseV1Options.EnableNodeCliInspectArguments, FuseState.DISABLE],
    ['EnableEmbeddedAsarIntegrityValidation', FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseState.ENABLE],
    ['OnlyLoadAppFromAsar', FuseV1Options.OnlyLoadAppFromAsar, FuseState.ENABLE],
    ['LoadBrowserProcessSpecificV8Snapshot', FuseV1Options.LoadBrowserProcessSpecificV8Snapshot, FuseState.DISABLE],
    ['GrantFileProtocolExtraPrivileges', FuseV1Options.GrantFileProtocolExtraPrivileges, FuseState.ENABLE]
  ];
  const failures = expected
    .filter(([, index, state]) => config[index] !== state)
    .map(([name, index, state]) => `${name}: esperado ${state}, encontrado ${config[index]}`);

  if (failures.length) {
    console.error('Electron fuse QA: FALLO');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log('Electron fuse QA: OK');
}

main().catch((error) => {
  console.error(`Electron fuse QA: ${error.message}`);
  process.exitCode = 1;
});
