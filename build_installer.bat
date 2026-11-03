@echo off
set NSIS_PATH="C:\Program Files (x86)\NSIS"
if not exist %NSIS_PATH%\makensis.exe (
  echo NSIS is not installed in the default path. Please install NSIS from https://nsis.sourceforge.io/ and update build_installer.bat accordingly.
  pause
  exit /b 1
)
makensis Installer.nsi
echo Installer built as FUCK_Installer.exe
pause
