#!/usr/bin/env python3
"""
Simple Windows GUI to load an Excel trip table, select period, preview,
and export to DOCX (Times New Roman, 12pt). Also supports printing via the
Windows default printer.
"""
import os
import sys
from datetime import datetime, date, timedelta
 
# Accent color theme (0D9B8D) and derived variants
ACCENT = "#0D9B8D"
ACCENT_LIGHT = "#1EC7BD"
ACCENT_DARK = "#0A746F"
from typing import List, Dict, Any

import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
from tkinter import ttk
try:
    from tkcalendar import DateEntry  # calendar widget
except Exception:
    DateEntry = None  # fallback to simple Entry if tkcalendar not installed

import pandas as pd
from docx import Document
from docx.shared import Pt


class AccentButton(tk.Button):
    def __init__(self, master=None, text="", command=None, **kwargs):
        super().__init__(master, text=text, command=command, bg=ACCENT, fg="white",
                         activebackground=ACCENT_DARK, activeforeground="white",
                         borderwidth=0, relief="raised", font=("Segoe UI", 11, 'bold'), **kwargs)
        self.default_bg = ACCENT
        self.bind("<Enter>", lambda e: self.config(bg=ACCENT_LIGHT))
        self.bind("<Leave>", lambda e: self.config(bg=ACCENT))

class TripJournalApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Журнал командировок - PDF/DOCX генератор")
        self.geometry("900x600")

        self.df: pd.DataFrame = None
        self.start_date: date = None
        self.end_date: date = None
        self.out_dir: str = "./out"
        self.generated_docx: str = None

        self._build_ui()
        # internal state for period and department filter
        self.week_start: date = None
        self.week_end: date = None
        self.department_filter: str = None
        # basic styling
        self._setup_style()

    def _build_ui(self):
        # Modern layout: left navigation + right content (mimicking a dashboard)
        from tkinter import constants
        self.pw = ttk.Panedwindow(self, orient=tk.HORIZONTAL)
        self.pw.pack(fill=tk.BOTH, expand=True, padx=6, pady=6)

        # Left navigation panel (styled like a modern app)
        left = tk.Frame(self.pw, width=260, bg="#f5f7fb")
        left.pack_propagate(False)
        self.pw.add(left, minsize=260)
        # Top brand/header in the left panel
        brand = tk.Frame(left, height=70, bg="#1e2a34")
        brand.pack(fill=tk.X, side=tk.TOP)
        brand_label = tk.Label(brand, text="ТОРИС", bg="#1e2a34", fg="#e8f3f3", font=("Segoe UI", 18, 'bold'))
        brand_label.pack(side=tk.LEFT, padx=16, pady=18)

        # Navigation items
        nav = tk.Frame(left, bg="#f5f7fb")
        nav.pack(fill=tk.BOTH, expand=True, padx=12, pady=8)
        def add_nav_item(parent, text, icon=None):
            row = tk.Frame(parent, bg="#f5f7fb")
            row.pack(fill=tk.X, pady=6)
            if icon:
                ig = tk.Label(row, text=icon, bg="#f5f7fb", fg="#5b8a8b")
                ig.pack(side=tk.LEFT, padx=(0,6))
            btn = tk.Label(row, text=text, bg="#f5f7fb", fg="#1f2a31", font=("Segoe UI", 11))
            btn.pack(side=tk.LEFT, anchor='w')
        add_nav_item(nav, "Управление ресурсами", icon="🏷")
        add_nav_item(nav, "Публикации", icon="✉")
        add_nav_item(nav, "Статистика", icon="📈")

        # Right content area
        right = tk.Frame(self.pw, bg="#ffffff")
        self.pw.add(right, weight=1)

        # Top header in the right panel (breadcrumb / actions)
        topbar = tk.Frame(right, bg="#f8fbfd", height=60)
        topbar.pack(fill=tk.X)
        title = tk.Label(topbar, text="Управление ресурсами", bg="#f8fbfd", fg="#1f2a31", font=("Segoe UI", 14, 'bold'))
        title.pack(side=tk.LEFT, padx=16, pady=16)
        # Load button
        btn_load = ttk.Button(ctrl_frame, text="Загрузить таблицу", command=self.load_table)
        btn_load.grid(row=0, column=0, padx=6, pady=6, sticky='w', columnspan=2)

        # Period panel with calendar/date pickers
        period_frame = ttk.LabelFrame(ctrl_frame, text="Период")
        period_frame.grid(row=1, column=0, padx=6, pady=6, sticky='ew', columnspan=2)
        lbl_start = ttk.Label(period_frame, text="Начало:")
        lbl_start.grid(row=0, column=0, padx=4, pady=4, sticky='e')
        if DateEntry:
            self.date_start = DateEntry(period_frame, width=12, date_pattern='yyyy-mm-dd')
            self.date_start.grid(row=0, column=1, padx=4, pady=4, sticky='w')
        else:
            self.entry_start = ttk.Entry(period_frame, width=12)
            self.entry_start.grid(row=0, column=1, padx=4, pady=4, sticky='w')
            self.entry_start.insert(0, (date.today() - timedelta(days=7)).strftime('%Y-%m-%d'))
        lbl_end = ttk.Label(period_frame, text="Конец:")
        lbl_end.grid(row=1, column=0, padx=4, pady=4, sticky='e')
        if DateEntry:
            self.date_end = DateEntry(period_frame, width=12, date_pattern='yyyy-mm-dd')
            self.date_end.grid(row=1, column=1, padx=4, pady=4, sticky='w')
        else:
            self.entry_end = ttk.Entry(period_frame, width=12)
            self.entry_end.grid(row=1, column=1, padx=4, pady=4, sticky='w')
            self.entry_end.insert(0, (date.today()).strftime('%Y-%m-%d'))

        # Output dir
        lbl_out = ttk.Label(ctrl_frame, text="Папка вывода:")
        lbl_out.grid(row=2, column=0, padx=4, pady=4, sticky='e')
        self.entry_out = ttk.Entry(ctrl_frame, width=22)
        self.entry_out.grid(row=2, column=1, padx=4, pady=4, sticky='w')
        self.entry_out.insert(0, self.out_dir)

        # Apply button
        btn_apply = ttk.Button(ctrl_frame, text="Применить", command=self.apply_date_range)
        btn_apply.grid(row=3, column=0, padx=6, pady=6, sticky='w', columnspan=2)

        # Bottom action buttons (print / save) in a separate row
        action_frame = ttk.Frame(ctrl_frame)
        action_frame.grid(row=4, column=0, columnspan=2, pady=6, sticky='ew')
        btn_preview = ttk.Button(action_frame, text="Предпросмотр", command=self.preview)
        btn_preview.pack(side=tk.LEFT, padx=6)
        btn_docx_preview = ttk.Button(action_frame, text="Предпросмотр DOCX", command=self.show_docx_preview)
        btn_docx_preview.pack(side=tk.LEFT, padx=6)
        btn_docx = ttk.Button(action_frame, text="Сохранить DOCX", command=self.save_docx)
        btn_docx.pack(side=tk.LEFT, padx=6)
        btn_print = ttk.Button(action_frame, text="Печать", command=self.print_docx)
        btn_print.pack(side=tk.LEFT, padx=6)

        # Right: preview - textual representation of final document
        preview_frame = ttk.LabelFrame(right, text="Предпросмотр журнала")
        preview_frame.pack(fill=tk.BOTH, expand=True, padx=6, pady=6)
        self.preview_textbox = scrolledtext.ScrolledText(preview_frame, wrap=tk.WORD, font=("Consolas", 10))
        self.preview_textbox.pack(fill=tk.BOTH, expand=True)

        # Status bar
        self.status = tk.StringVar()
        self.status.set("Готово. Загрузите файл и примените период.")
        status_bar = ttk.Label(self, textvariable=self.status, relief=tk.SUNKEN, anchor='w')
        status_bar.pack(fill=tk.X, side=tk.BOTTOM, ipady=4)

    def _setup_style(self):
        # Basic modern look for Tkinter apps using ttk
        self.style = ttk.Style()
        # Try a modern theme, fall back if not available
        for th in ('clam','default','alt','vista','xpnative'):
            try:
                self.style.theme_use(th)
                break
            except Exception:
                pass
        font = ("Segoe UI", 10)
        self.style.configure('.', font=font)
        self.style.configure('Treeview', font=("Segoe UI", 10), rowheight=22)
        self.style.configure('TLabel', font=font)
        self.style.configure('TButton', font=font)
        self.style.configure('TEntry', font=font)
        self.style.configure('TCombobox', font=font)

    def _format_date_ddmmyyyy(self, val) -> str:
        # Normalize various date representations to dd.mm.yyyy
        if isinstance(val, (datetime, date)):
            d = val if isinstance(val, date) else val.date()
            return d.strftime("%d.%m.%Y")
        if val is None:
            return ""
        try:
            dt = pd.to_datetime(val)
            return dt.date().strftime("%d.%m.%Y")
        except Exception:
            return str(val)

    def load_table(self):
        path = filedialog.askopenfilename(title="Выберите Excel файл", filetypes=[("Excel", "*.xlsx;*.xls")])
        if not path:
            return
        try:
            self.df = pd.read_excel(path, engine="openpyxl")
            messagebox.showinfo("Готово", f"Таблица загружена: {os.path.basename(path)}\nСтрок: {len(self.df)}")
            self.status.set(f"Таблица загружена: {len(self.df)} строк")
        except Exception as e:
            messagebox.showerror("Ошибка", f"Не удалось прочитать файл: {e}")
            self.df = None
        # Refresh the treeview with data (if range set)
        self.refresh_preview_tree()

    def render_text_preview(self):
        # Build a textual preview representing how the final DOCX will look
        self.preview_textbox.config(state='normal')
        lines = []
        if self.df is None or not self.start_date or not self.end_date:
            self.preview_textbox.delete('1.0', tk.END)
            self.preview_textbox.insert(tk.END, "Загрузите таблицу и примените период.")
            self.preview_textbox.config(state='disabled')
            return
        cols = self._resolve_columns()
        fio_col = cols.get('fio')
        date_col = cols.get('date')
        time_col = cols.get('time')
        reason_col = cols.get('reason')
        # Build weeks within period
        def _weeks(start: date, end: date):
            if not start or not end:
                return []
            cur = start - timedelta(days=start.weekday())
            ws = []
            while cur <= end:
                wk_s = cur
                wk_e = min(cur + timedelta(days=6), end)
                ws.append((wk_s, wk_e))
                cur += timedelta(days=7)
            return ws
        weeks = _weeks(self.start_date, self.end_date) or [(self.start_date, self.end_date)]
        for wk_s, wk_e in weeks:
            lines.append(f"Журнал местных командировок за период: {wk_s:%d.%m.%Y} - {wk_e:%d.%m.%Y}")
            lines.append("")
            lines.append("ФИО | Дата | Время | Причина | Подпись")
            lines.append("-" * 60)
            for _, row in self.df.iterrows():
                if date_col and not pd.isna(row.get(date_col)):
                    try:
                        r_date = pd.to_datetime(row.get(date_col)).date()
                    except Exception:
                        r_date = None
                else:
                    r_date = None
                if r_date is None:
                    continue
                if not (wk_s <= r_date <= wk_e):
                    continue
                fio = str(row.get(fio_col, "")) if fio_col else ""
                dt = r_date.strftime("%d.%m.%Y")
                tm = ""
                if time_col:
                    val = row.get(time_col, "")
                    tm = str(val) if val is not None else ""
                pr = str(row.get(reason_col, "")) if reason_col else ""
                lines.append(f"{fio} | {dt} | {tm} | {pr} | ")
            lines.append("")
            lines.append("Начальник отдела операционного анализа: Стариков А.Ю.   ____________________")
            lines.append("")
        self.preview_textbox.delete('1.0', tk.END)
        self.preview_textbox.insert(tk.END, "\n".join(lines))
        self.preview_textbox.config(state='disabled')

    def apply_date_range(self):
        # Read dates from calendar widgets if available, otherwise from text entries
        if DateEntry:
            self.start_date = self.date_start.get_date() if self.date_start else None
            self.end_date = self.date_end.get_date() if self.date_end else None
        else:
            s = self.entry_start.get() if hasattr(self, 'entry_start') else ''
            e = self.entry_end.get() if hasattr(self, 'entry_end') else ''
            try:
                self.start_date = date.fromisoformat(s) if s else None
                self.end_date = date.fromisoformat(e) if e else None
            except Exception:
                self.start_date = None
                self.end_date = None
        if not (self.start_date and self.end_date):
            messagebox.showwarning("Внимание", "Пожалуйста, укажите оба диапазона дат.")
            return
        # Update preview to reflect new range
        self.preview()
        self.refresh_preview_tree()

    def refresh_preview_tree(self):
        # Updated: keep existing, but also render a minimal textual preview in the main text box
        self.render_text_preview()

    def _resolve_columns(self) -> Dict[str, str]:
        if self.df is None:
            return {}
        cols = list(self.df.columns.astype(str))
        # возможные названия столбцов
        map_aliases = {
            'fio': ["ФИО", "FIO", "Employee", "EmployeeName", "Name"],
            'date': ["Дата", "Date", "StartDate"],
            'time': ["Время", "Time"],
            'reason': ["Причина", "Reason", "Purpose"],
            'signature': ["Подпись", "Signature", "Sign"],
            'department': ["Department", "Отдел"],
        }
        def pick(names: List[str]) -> str:
            for n in names:
                for c in cols:
                    if str(c).strip().lower() == n.lower():
                        return c
            return None
        result = {
            'fio': pick(map_aliases['fio']),
            'date': pick(map_aliases['date']),
            'time': pick(map_aliases['time']),
            'reason': pick(map_aliases['reason']),
            'signature': pick(map_aliases['signature']),
            'department': pick(map_aliases['department']),
        }
        return result

    def preview(self):
        if self.df is None:
            messagebox.showinfo("Пояснение", "Загрузите таблицу сначала.")
            return
        # date range comes from apply_date_range or defaults
        if not (hasattr(self, 'start_date') and hasattr(self, 'end_date') and self.start_date and self.end_date):
            messagebox.showinfo("Пояснение", "Неверно указан диапазон дат. Нажмите 'Применить'.")
            return
        # Build a textual status message and refresh the textual preview
        self.render_text_preview()
        self.status.set("Предпросмотр обновлён")

    def save_docx(self):
        if self.df is None:
            messagebox.showinfo("Пояснение", "Загрузите таблицу сначала.")
            return
        ed_start = self.entry_start.get() if not DateEntry else None
        ed_end = self.entry_end.get() if not DateEntry else None
        try:
            if ed_start:
                self.start_date = datetime.strptime(ed_start, "%Y-%m-%d").date()
            else:
                self.start_date = None
            if ed_end:
                self.end_date = datetime.strptime(ed_end, "%Y-%m-%d").date()
            else:
                self.end_date = None
        except Exception:
            messagebox.showerror("Ошибка", "Неправильный формат дат. Используйте YYYY-MM-DD.")
            return
        out_dir = self.entry_out.get() or self.out_dir
        self.out_dir = out_dir
        os.makedirs(out_dir, exist_ok=True)

        cols = self._resolve_columns()
        fio_col = cols.get('fio')
        date_col = cols.get('date')
        time_col = cols.get('time')
        reason_col = cols.get('reason')
        department_col = cols.get('department')

        doc = Document()
        # Set Times New Roman 12pt
        style = doc.styles['Normal']
        style.font.name = 'Times New Roman'
        style.font.size = Pt(12)

        # Build per-week blocks within the selected period
        # Helper: generate week blocks (start, end)
        def _weeks(start: date, end: date):
            if not start or not end:
                return []
            cur = start - timedelta(days=start.weekday())
            weeks = []
            while cur <= end:
                wk_s = cur
                wk_e = min(cur + timedelta(days=6), end)
                weeks.append((wk_s, wk_e))
                cur += timedelta(days=7)
            return weeks
        weeks = _weeks(self.start_date, self.end_date)
        if not weeks:
            weeks = [(self.start_date, self.end_date)]
        cols = self._resolve_columns()
        fio_col = cols.get('fio')
        date_col = cols.get('date')
        time_col = cols.get('time')
        reason_col = cols.get('reason')
        doc = Document()
        doc_styles = doc.styles
        # Prepare for multiple weeks with page breaks
        for widx, (wk_s, wk_e) in enumerate(weeks):
            header_text = f"Журнал местных командировок за период: {wk_s:%d.%m.%Y} - {wk_e:%d.%m.%Y}"
            doc.add_paragraph(header_text).alignment = 0
            doc.add_paragraph("")
            # Table with borders
            table = doc.add_table(rows=1, cols=5)
            table.style = 'Table Grid'
            hdr = table.rows[0].cells
            hdr[0].text = 'ФИО'
            hdr[1].text = 'Дата'
            hdr[2].text = 'Время'
            hdr[3].text = 'Причина'
            hdr[4].text = 'Подпись'
            # Fill rows for this week
            for _, row in self.df.iterrows():
                if date_col and not pd.isna(row.get(date_col)):
                    try:
                        r_date = pd.to_datetime(row.get(date_col)).date()
                    except Exception:
                        r_date = None
                else:
                    r_date = None
                if r_date is None:
                    continue
                if not (wk_s <= r_date <= wk_e):
                    continue
                fio = str(row.get(fio_col, "")) if fio_col else ""
                dt = self._format_date_ddmmyyyy(r_date)
                tm = ""  # time not defined per-week; keep empty or parse from time_col if exists
                if time_col:
                    val = row.get(time_col, "")
                    tm = str(val) if val is not None else ""
                pr = str(row.get(reason_col, "")) if reason_col else ""
                rcell = table.add_row().cells
                rcell[0].text = fio
                rcell[1].text = dt
                rcell[2].text = tm
                rcell[3].text = pr
                rcell[4].text = ""
            # Bottom signature for this page/week
            doc.add_paragraph("")
            doc.add_paragraph("Начальник отдела операционного анализа: Стариков А.Ю.   ____________________")
            doc.add_paragraph("Дата: ____________________")
            if widx < len(weeks) - 1:
                doc.add_page_break()

        fname = os.path.join(out_dir, f"Journal_{self.start_date:%d.%m.%Y}_{self.end_date:%d.%m.%Y}.docx")
        doc.save(fname)
        self.generated_docx = fname
        messagebox.showinfo("Готово", f"Документ сохранён: {fname}")
        doc.add_paragraph("")

        # (no longer duplication; ensure single block per week)

    def print_docx(self):
        if not self.generated_docx or not os.path.exists(self.generated_docx):
            messagebox.showinfo("Пояснение", "Сначала сохраните DOCX.")
            return
        try:
            if sys.platform.startswith("win"):
                os.startfile(self.generated_docx, "print")
            else:
                messagebox.showinfo("Печать", "Печать поддерживается в этой сборке только на Windows.")
        except Exception as e:
            messagebox.showerror("Ошибка печати", str(e))


if __name__ == '__main__':
    app = TripJournalApp()
    app.mainloop()
