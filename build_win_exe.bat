@echo off
rem Builds a Windows executable for gui_app.py using PyInstaller
set VENV_DIR=venv
if not exist "%VENV_DIR%" (
  echo Создаю виртуальное окружение...
  python -m venv "%VENV_DIR%"
)
echo Активирую виртуальное окружение...
CALL "%VENV_DIR%\Scripts\activate.bat"
echo Обновляю pip...
python -m pip install --upgrade pip
echo Установка зависимостей (requirements.txt)...
pip install -r requirements.txt
echo Установка PyInstaller...
pip install pyinstaller
echo Сборка исполняемого файла...
python -m PyInstaller --windowed --onefile gui_app.py --hidden-import docx
IF EXIST "dist\gui_app.exe" (
  echo Сборка успешна: dist\gui_app.exe
) ELSE (
  echo Сборка не удалась. Проверьте логи PyInstaller.
)
echo Деактивирую окружение...
call deactivate
pause
