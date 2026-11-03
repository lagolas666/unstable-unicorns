; NSIS installer script for FUСК (FUCK) — Forming and Accounting of Travel Goals
; This creates an installer for Windows that places the app in Program Files\FUCK
; and adds desktop/start menu shortcuts.

OutFile "FUCK_Installer.exe"
InstallDir "$PROGRAMFILES\FUCK"
InstallDirRegKey HKLM "Software\FUCK" "InstallDir"

Page directory
Page instfiles

Section
  SetOutPath "$INSTDIR"
  File "dist\gui_app.exe"
  CreateDirectory "$SMPROGRAMS\Startup Menu\Programs\FUCK"
  CreateShortCut "$DESKTOP\FUCK - Forming and Tracking Trips.lnk" "$INSTDIR\gui_app.exe"
  CreateShortCut "$SMPROGRAMS\FUCK\FUCK - Forming and Tracking Trips.lnk" "$INSTDIR\gui_app.exe"
SectionEnd
