"""
Generate tennis_calendar.ics from data/tournaments.json.
Produces one all-day event per tournament, compatible with
Google Calendar, Apple Calendar, Outlook, and any iCal-compliant app.

Usage:  python scripts/export_ics.py
Output: tennis_calendar.ics (project root)
"""

import json
import uuid
from datetime import datetime, date, timedelta
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent / "data" / "tournaments.json"
OUT_FILE = Path(__file__).parent.parent / "tennis_calendar.ics"

LEVEL_LABELS = {
    2000: "Grand Slam",
    1500: "Finals",
    1000: "1000",
    500:  "500",
    250:  "250",
}


def level_label(level: int) -> str:
    return LEVEL_LABELS.get(level, str(level))


def ics_date(d: str) -> str:
    """YYYY-MM-DD -> YYYYMMDD"""
    return d.replace("-", "")


def next_day(d: str) -> str:
    """iCal DTEND for all-day events is exclusive, so add 1 day."""
    dt = date.fromisoformat(d) + timedelta(days=1)
    return dt.strftime("%Y%m%d")


def escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def fold(line: str) -> str:
    """RFC 5545 line folding: max 75 octets, continuation lines start with a space."""
    encoded = line.encode("utf-8")
    if len(encoded) <= 75:
        return line
    result = []
    chunk_bytes = []
    byte_count = 0
    for ch in line:
        ch_bytes = ch.encode("utf-8")
        if byte_count + len(ch_bytes) > 75:
            result.append("".join(chunk_bytes))
            chunk_bytes = [" ", ch]
            byte_count = 1 + len(ch_bytes)
        else:
            chunk_bytes.append(ch)
            byte_count += len(ch_bytes)
    if chunk_bytes:
        result.append("".join(chunk_bytes))
    return "\r\n".join(result)


def build_event(tour: str, t: dict, now_stamp: str) -> list[str]:
    uid = str(uuid.uuid5(uuid.NAMESPACE_DNS, t["id"]))
    tier = level_label(t["level"])
    summary = f"[{tour} - {tier}] {t['name']}"

    description_parts = [
        f"Tour: {tour}",
        f"Level: {tier}",
        f"Surface: {t.get('surface', 'Unknown')}",
        f"Location: {t.get('location', 'TBD')}",
        f"Dates: {t['start']} to {t['end']}",
    ]
    winner = t.get("winner")
    runner_up = t.get("runner_up")
    score = t.get("score")
    if winner:
        description_parts.append(f"Winner: {winner}")
    if runner_up:
        description_parts.append(f"Runner-up: {runner_up}")
    if score:
        description_parts.append(f"Score: {score}")

    description = "\n".join(description_parts)
    location = t.get("location", "")

    lines = [
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{now_stamp}",
        f"DTSTART;VALUE=DATE:{ics_date(t['end'])}",
        f"DTEND;VALUE=DATE:{next_day(t['end'])}",
        f"SUMMARY:{escape(summary)}",
        f"DESCRIPTION:{escape(description)}",
        f"LOCATION:{escape(location)}",
        "END:VEVENT",
    ]
    return lines


def main():
    with open(DATA_FILE) as f:
        data = json.load(f)

    now_stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//tennis-calendar//EN",
        "CALSCALE:GREGORIAN",
        "X-WR-CALNAME:Tennis Calendar 2026",
        "X-WR-CALDESC:ATP and WTA tournament schedule for 2026",
        "X-WR-TIMEZONE:UTC",
    ]

    for t in data.get("atp", []):
        lines.extend(build_event("ATP", t, now_stamp))

    for t in data.get("wta", []):
        lines.extend(build_event("WTA", t, now_stamp))

    lines.append("END:VCALENDAR")

    with open(OUT_FILE, "w", encoding="utf-8", newline="") as f:
        for line in lines:
            f.write(fold(line) + "\r\n")

    print(f"Written {OUT_FILE}  ({len(data['atp'])} ATP + {len(data['wta'])} WTA events)")


if __name__ == "__main__":
    main()
