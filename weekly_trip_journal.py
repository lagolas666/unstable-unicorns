#!/usr/bin/env python3
import argparse
import os
import re
from datetime import date, timedelta
from typing import List, Dict, Any, Tuple

import pandas as pd
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm


def _sanitize_filename(name: str) -> str:
    # Remove/replace characters not suitable for filenames
    name = str(name)
    name = re.sub(r'[\\/*?:"<>|]+', "_", name)
    return name


def _week_range(days_back: int = 7) -> Tuple[date, date]:
    today = date.today()
    # Monday of current week
    current_monday = today - timedelta(days=today.weekday())
    # Previous week range
    start = current_monday - timedelta(days=days_back)
    end = start + timedelta(days=6)
    return start, end


def _read_excel(excel_path: str) -> pd.DataFrame:
    # Read Excel with best effort; no sheet specified, use first sheet
    df = pd.read_excel(excel_path, engine="openpyxl")
    if df is None:
        raise ValueError("Failed to read Excel file")
    # Normalize column names to easier access
    df.columns = [str(c).strip() for c in df.columns]
    return df


def _trip_days(start, end) -> int:
    if pd.isna(start) or pd.isna(end):
        return 0
    try:
        s = pd.to_datetime(start).date()
        e = pd.to_datetime(end).date()
        if e < s:
            s, e = e, s
        return (e - s).days + 1
    except Exception:
        return 0


def _parse_cost(row: Dict[str, Any]) -> float:
    # Try a few common cost representations
    cost_cols = [
        "TotalCost",
        "Total",
        "Cost",
        "DailyRate",
        "Daily_Rate",
    ]
    total = 0.0
    for c in cost_cols:
        if c in row and not pd.isna(row[c]):
            val = float(row[c]) if not isinstance(row[c], str) else 0.0
            try:
                total += float(row[c])
            except Exception:
                pass
    # If no explicit cost, try to compute from daily rate if available
    if total == 0.0:
        if "DailyRate" in row and not pd.isna(row.get("DailyRate")):
            days = _trip_days(row.get("StartDate"), row.get("EndDate"))
            try:
                total = float(row["DailyRate"]) * max(0, days)
            except Exception:
                total = 0.0
    return float(total)


def _collect_week_trips(df: pd.DataFrame, week_start: date, week_end: date) -> Dict[str, List[Dict[str, Any]]]:
    # Normalize date columns
    if "StartDate" not in df.columns or "EndDate" not in df.columns:
        raise ValueError("Excel sheet must contain StartDate and EndDate columns")
    df["StartDate"] = pd.to_datetime(df["StartDate"], errors="coerce").dt.date
    df["EndDate"] = pd.to_datetime(df["EndDate"], errors="coerce").dt.date

    trips_by_emp: Dict[str, List[Dict[str, Any]]] = {}
    for idx, row in df.iterrows():
        emp = str(row.get("Employee", "Unknown"))
        s = row.get("StartDate")
        e = row.get("EndDate")
        if s is None or e is None:
            continue
        # Check if trip falls within the week
        if (week_start <= s <= week_end) or (week_start <= e <= week_end) or (s <= week_end and e >= week_start):
            days = _trip_days(s, e)
            trip = {
                "Employee": emp,
                "StartDate": s,
                "EndDate": e,
                "Destination": str(row.get("Destination", "")) or "",
                "Purpose": str(row.get("Purpose", "")) or "",
                "Days": days,
                "DailyRate": row.get("DailyRate"),
                "TotalCost": _parse_cost(row),
            }
            trips_by_emp.setdefault(emp, []).append(trip)
    return trips_by_emp


def _draw_header(c: canvas.Canvas, week_start: date, week_end: date):
    title = f"Weekly Local Trip Journal: {week_start:%Y-%m-%d} - {week_end:%Y-%m-%d}"
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, 820, title)
    c.setFont("Helvetica", 10)
    c.drawString(40, 804, f"Generated: {date.today():%Y-%m-%d}")


def _wrap_text(text: str, width: int) -> List[str]:
    # Simple word wrap for a single line
    if not text:
        return [""]
    lines = []
    words = text.split()
    line = ""
    for w in words:
        if len(line) + len(w) + 1 <= width:
            line = (line + " " + w).strip()
        else:
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def _collect_week_trips_flat(df: pd.DataFrame, week_start: date, week_end: date, department: str = None) -> List[Dict[str, Any]]:
    # Normalize date columns
    if "StartDate" not in df.columns or "EndDate" not in df.columns:
        raise ValueError("Excel sheet must contain StartDate and EndDate columns")
    df["StartDate"] = pd.to_datetime(df["StartDate"], errors="coerce").dt.date
    df["EndDate"] = pd.to_datetime(df["EndDate"], errors="coerce").dt.date

    trips: List[Dict[str, Any]] = []
    for idx, row in df.iterrows():
        s = row.get("StartDate")
        e = row.get("EndDate")
        if s is None or e is None:
            continue
        # Check if trip falls within the week
        if (week_start <= s <= week_end) or (week_start <= e <= week_end) or (s <= week_end and e >= week_start):
            dept = str(row.get("Department", "")) if "Department" in df.columns else ""
            if department and dept != department:
                continue
            emp = str(row.get("Employee", "Unknown"))
            destination = str(row.get("Destination", ""))
            purpose = str(row.get("Purpose", ""))
            days = _trip_days(s, e)
            total = _parse_cost(row)
            trips.append({
                "Employee": emp,
                "Department": dept,
                "StartDate": s,
                "EndDate": e,
                "Destination": destination,
                "Purpose": purpose,
                "Days": days,
                "TotalCost": total,
            })
    return trips


def _draw_department_header(c: canvas.Canvas, week_start: date, week_end: date) -> float:
    from time import time
    height = A4[1]
    y = height - 40
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, f"Журнал местных командировок за период: {week_start:%Y-%m-%d} — {week_end:%Y-%m-%d}")
    c.setFont("Helvetica", 10)
    c.drawString(40, y - 14, f"Дата формирования: {date.today():%Y-%m-%d}")
    return y - 34


def _draw_department_signature_footer(c: canvas.Canvas, margin: int = 20):
    # Bottom signature area on a page
    height = A4[1]
    y = 60
    c.setFont("Helvetica", 11)
    c.drawString(margin, y, "Подпись начальника отдела: ______________________")
    c.drawString(margin, y - 16, "Дата: _____________________")


def generate_pdf_for_department(trips: List[Dict[str, Any]], week_start: date, week_end: date, out_path: str, department: str = None):
    os.makedirs(out_path, exist_ok=True)
    fname = os.path.join(out_path, f"Journal_{week_start:%Y%m%d}_{week_end:%Y%m%d}.pdf")
    c = canvas.Canvas(fname, pagesize=A4)
    width, height = A4

    margin = 20
    y = _draw_department_header(c, week_start, week_end)
    # If a department is specified, show it above the table
    if department:
        c.setFont("Helvetica-Oblique", 11)
        c.drawString(margin, y, f"Отдел: {department}")
        y -= 20
        c.setFont("Helvetica", 11)

    # Table-like entries: simple multi-line blocks per trip with per-row signature placeholder
    for t in trips:
        # Page break if needed
        if y < 120:
            _draw_department_signature_footer(c)
            c.showPage()
            y = _draw_department_header(c, week_start, week_end)
            if department:
                c.setFont("Helvetica-Oblique", 11)
                c.drawString(margin, y, f"Отдел: {department}")
                y -= 20
                c.setFont("Helvetica", 11)

        emp = t.get("Employee", "Unknown")
        dept = t.get("Department", "") if t.get("Department") else department or ""
        s = t.get("StartDate")
        e = t.get("EndDate")
        dest = t.get("Destination", "")
        purp = t.get("Purpose", "")
        days = t.get("Days", 0)
        total = t.get("TotalCost", 0.0)

        # Print trip details as multiple small lines to fit on page
        c.setFont("Helvetica", 11)
        c.drawString(margin, y, f"Дата: {s} - {e}")
        y -= 14
        c.drawString(margin, y, f"Сотрудник: {emp}")
        y -= 14
        c.drawString(margin, y, f"Подразделение: {dept}")
        y -= 14
        c.drawString(margin, y, f"Направление: {dest}")
        y -= 14
        c.drawString(margin, y, f"Цель: {purp}")
        y -= 14
        c.drawString(margin, y, f"Дни: {days} | Стоимость: {total:.2f}")
        y -= 14
        # Per-row signature placeholder
        c.drawString(margin, y, "Подпись сотрудника: ____________________")
        y -= 20

    # Page footer with department head signature
    _draw_department_signature_footer(c)
    c.showPage()
    c.save()

def generate_pdf_for_employee(emp: str, trips: List[Dict[str, Any]], week_start: date, week_end: date, out_path: str):
    os.makedirs(out_path, exist_ok=True)
    safe_name = _sanitize_filename(emp)
    fname = os.path.join(out_path, f"{safe_name}_{week_start:%Y%m%d}_{week_end:%Y%m%d}.pdf")
    c = canvas.Canvas(fname, pagesize=A4)
    width, height = A4
    margin = 20
    y = height - margin

    _draw_header(c, week_start, week_end)
    y -= 40

    c.setFont("Helvetica", 12)
    # Employee header
    c.drawString(margin, y, f"Employee: {emp}")
    y -= 20

    if not trips:
        c.drawString(margin, y, "No trips recorded for this week.")
        c.showPage()
        c.save()
        return

    for i, t in enumerate(trips, 1):
        if y < 100:
            c.showPage()
            y = height - margin
            _draw_header(c, week_start, week_end)
            y -= 40
        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin, y, f"Trip {i}:")
        y -= 16
        c.setFont("Helvetica", 11)
        # Trip fields
        s = t.get("StartDate")
        e = t.get("EndDate")
        dest = t.get("Destination", "")
        purp = t.get("Purpose", "")
        days = t.get("Days", 0)
        total = t.get("TotalCost", 0.0)
        lines = [
            f"Date: {s or ''} - {e or ''}",
            f"Destination: {dest}",
            f"Purpose: {purp}",
            f"Days: {days}",
            f"Total Cost: {total:.2f}",
        ]
        for line in lines:
            y -= 14
            c.drawString(margin + 10, y, line)
        y -= 6

    c.showPage()
    c.save()


def main():
    ap = argparse.ArgumentParser(description="Generate printable weekly local trip journal for department from Excel data.")
    ap.add_argument("excel", help="Path to Excel file with trip data")
    ap.add_argument("output", help="Output directory for PDF reports")
    ap.add_argument("--week-start", dest="week_start", help="Week start date (YYYY-MM-DD). If not provided, previous complete week is used.")
    ap.add_argument("--department", dest="department", default=None, help="Filter by department name (optional)")
    ap.add_argument("--sheet", dest="sheet", default=None, help="Sheet name or index to read from Excel (default: first sheet)")
    args = ap.parse_args()

    excel_path = args.excel
    if not os.path.exists(excel_path):
        raise SystemExit(f"Excel file not found: {excel_path}")
    out_dir = args.output
    os.makedirs(out_dir, exist_ok=True)

    df = _read_excel(excel_path)
    if args.week_start:
        try:
            week_start = pd.to_datetime(args.week_start).date()
        except Exception:
            raise SystemExit("Invalid --week-start date format; expected YYYY-MM-DD")
        week_end = week_start + timedelta(days=6)
    else:
        week_start, week_end = _week_range()

    trips = _collect_week_trips_flat(df, week_start, week_end, department=args.department)
    if not trips:
        print("No trips found for the selected week range and department filter.")
        return

    generate_pdf_for_department(trips, week_start, week_end, out_dir, department=args.department)
    print(f"Generated department journal for period {week_start:%Y-%m-%d} - {week_end:%Y-%m-%d}")


if __name__ == "__main__":
    main()
