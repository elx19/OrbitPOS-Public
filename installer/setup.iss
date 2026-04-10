; OrbitPOS - Instalador base Inno Setup
#define MyAppName "OrbitPOS"
#define MyAppVersion "2.0.2"
#define MyAppPublisher "JRTech"
#define MyAppExeName "OrbitPOS.exe"

[Setup]
AppId={{B92A0AA6-3D9B-40E4-B8C8-5B2C0F44A821}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\OrbitPOS
DefaultGroupName=OrbitPOS
OutputDir=dist
OutputBaseFilename=OrbitPOS-Setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
SetupIconFile=..\assets\OrbitPOS.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

[Files]
Source: "..\release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\OrbitPOS"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\OrbitPOS"; Filename: "{app}\{#MyAppExeName}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar OrbitPOS"; Flags: nowait postinstall skipifsilent
