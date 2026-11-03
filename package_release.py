#!/usr/bin/env python3
"""
Release packager for FUCK (Формирование и учет целей командировок).
Creates a ZIP archive containing the built executable, NSIS installer scripts,
and release notes.
"""
import os
import zipfile
from datetime import date

VERSION = "1.0.0"
ROOT = os.path.dirname(os.path.abspath(__file__))

def collect_files():
    files = []
    # runtime artifacts (if built)
    dist_gui = os.path.join(ROOT, 'dist', 'gui_app.exe')
    if os.path.exists(dist_gui):
        files.append(dist_gui)
    # installer related files
    nsis = os.path.join(ROOT, 'Installer.nsi')
    if os.path.exists(nsis):
        files.append(nsis)
    bin_inst = os.path.join(ROOT, 'build_installer.bat')
    if os.path.exists(bin_inst):
        files.append(bin_inst)
    # NSIS generated installer (if built)
    installer = os.path.join(ROOT, 'FUCK_Installer.exe')
    if os.path.exists(installer):
        files.append(installer)
    # docs / readme
    for nm in ['README_GUI.md', 'RELEASE_NOTES.md', 'RELEASE.md']:
        p = os.path.join(ROOT, nm)
        if os.path.exists(p):
            files.append(p)
    return files

def build_zip():
    release_dir = os.path.join(ROOT, 'release')
    os.makedirs(release_dir, exist_ok=True)
    zip_path = os.path.join(release_dir, f"FUCK_release_{VERSION}.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in collect_files():
            # add with relative path inside zip
            arcname = os.path.basename(f)
            zf.write(f, arcname)
    print(f"Release package created: {zip_path}")
    return zip_path

if __name__ == '__main__':
    build_zip()
