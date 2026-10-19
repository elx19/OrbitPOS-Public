import path from 'node:path';
import { flipFuses, FuseV1Options, FuseVersion } from '@electron/fuses';

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const electronExecutable = path.join(context.appOutDir, 'OrbitPOS.exe');
  await flipFuses(electronExecutable, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    // Keep Electron's bundled snapshot mode; OrbitPOS does not ship a
    // browser_v8_context_snapshot.bin beside the executable.
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true
  });
}
