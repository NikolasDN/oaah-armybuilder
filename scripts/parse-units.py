#!/usr/bin/env python3
"""Parse the OAaH spreadsheet CSV into a JSON unit catalog."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

CSV_PATH = Path(__file__).resolve().parents[1] / "docs" / "oaah-builder version 4_1.ods · versie 1 - Units.csv"
OUT_PATH = Path(__file__).resolve().parents[1] / "src" / "assets" / "data" / "units.json"

INVALID_COST = {"", "#n/a", "#num!", "#div/0!", "#value!", "#ref!"}

FACTION_COLORS = {
    "Dragonslayers": "#c9a227",
    "Monsters": "#9b2c2c",
    "Orcs": "#5a7a3a",
    "Elves": "#2f6b4f",
    "Goblins": "#6b8f3a",
    "Undead": "#6b5b95",
    "Dwarves": "#8a5a2b",
    "Gnomes": "#3d7a7a",
    "Humans": "#3d5a80",
    "Lizardmen": "#2f7a5a",
    "Trolls": "#4a6b3a",
    "Hobgoblins": "#a35a32",
    "Ratmen": "#5c5c66",
    "Halflings": "#b08d57",
}

HOME_TERRAIN_HINTS = {
    "Dragonslayers": "Hills",
    "Monsters": "Hills",
    "Orcs": "Hills",
    "Elves": "Forest",
    "Goblins": "Forest",
    "Undead": "Burial Ground",
    "Dwarves": "Hills",
    "Gnomes": "Hills",
    "Humans": "Plains",
    "Lizardmen": "Swamp",
    "Trolls": "Hills",
    "Hobgoblins": "Hills",
    "Ratmen": "Ruins",
    "Halflings": "Hills",
}


def title_faction(raw: str) -> str:
    name = raw.strip()
    if name.upper() == "HALFLING":
        return "Halflings"
    return name.title()


def is_faction_header(name: str, rest: list[str]) -> bool:
    if not name or not name.strip():
        return False
    compact = name.replace(" ", "")
    if not compact.isupper() or not compact.isalpha():
        return False
    quality = (rest[1] if len(rest) > 1 else "").strip()
    return quality == "" or quality.lower() in INVALID_COST


def parse_int(value: str) -> int | None:
    value = (value or "").strip()
    if not value or value.lower() in INVALID_COST:
        return None
    try:
        return int(float(value.replace(",", ".")))
    except ValueError:
        return None


def parse_cost(value: str) -> int | None:
    value = (value or "").strip()
    if not value or value.lower() in INVALID_COST:
        return None
    try:
        return int(round(float(value.replace(",", "."))))
    except ValueError:
        return None


CODE_TAIL_RE = re.compile(
    r"^(?P<name>.+?)\s*[-–—]\s*(?P<codes>[LPR]\d*(?:\s*,\s*[LPR]\d*)*)\s*$",
    re.IGNORECASE,
)
TRAILING_L_RE = re.compile(r"^(?P<name>.+?)\s+(?P<codes>L\d*)\s*$", re.IGNORECASE)
CODE_TOKEN_RE = re.compile(r"([LPR])(\d*)", re.IGNORECASE)


def apply_codes(codes: str) -> tuple[bool, bool, int | None]:
    limited = False
    personality = False
    rare = None
    for match in CODE_TOKEN_RE.finditer(codes):
        letter = match.group(1).upper()
        number = match.group(2)
        if letter == "L":
            limited = True
        elif letter == "P":
            personality = True
        elif letter == "R" and number:
            rare = int(number)
    return limited, personality, rare


def parse_trait(raw: str) -> dict | None:
    text = (raw or "").strip()
    if not text or text in {"0", "-"}:
        return None

    limited = False
    personality = False
    rare = None
    name = text

    matched = CODE_TAIL_RE.match(text) or TRAILING_L_RE.match(text)
    if matched:
        name = matched.group("name").strip(" -–—")
        limited, personality, rare = apply_codes(matched.group("codes"))

    name = re.sub(r"\s+", " ", name).strip()
    if not name:
        name = text

    return {
        "name": name,
        "raw": raw.strip(),
        "limited": limited,
        "personality": personality,
        "rare": rare,
    }


def unit_kind(traits: list[dict], quality: int | None, name: str) -> str:
    joined = " ".join(t["name"].lower() for t in traits)
    raw = " ".join(t["raw"].lower() for t in traits)
    blob = f"{joined} {raw} {name.lower()}"
    if any(t["personality"] for t in traits) or (quality is not None and quality <= 2):
        return "character"
    if any(
        key in blob
        for key in (
            "monster level",
            "giant level",
            "dragon breath",
            "titan",
        )
    ):
        return "monster"
    if any(
        key in blob
        for key in (
            "artillery",
            "siege engine",
            "chariot",
            "airship",
            "war wagon",
        )
    ):
        return "war-engine"
    return "troop"


def stand_limits(kind: str) -> tuple[int, int, int]:
    if kind in {"character", "monster"}:
        return 1, 1, 1
    if kind == "war-engine":
        return 1, 4, 1
    return 2, 16, 8


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "unit"


def main() -> None:
    factions: list[dict] = []
    current: dict | None = None
    seen_ids: dict[str, int] = {}

    with CSV_PATH.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader, None)
        if not header:
            raise SystemExit("CSV is empty")

        for row in reader:
            if not row:
                continue
            name = (row[0] or "").strip()
            rest = row[1:]
            if not name:
                continue
            if is_faction_header(name, rest):
                faction_name = title_faction(name)
                current = {
                    "id": slugify(faction_name),
                    "name": faction_name,
                    "color": FACTION_COLORS.get(faction_name, "#7a6a4f"),
                    "suggestedHomeTerrain": HOME_TERRAIN_HINTS.get(faction_name, "Plains"),
                    "units": [],
                }
                factions.append(current)
                continue
            if current is None:
                continue

            quality = parse_int(row[2] if len(row) > 2 else "")
            attack = parse_int(row[3] if len(row) > 3 else "")
            defense = parse_int(row[4] if len(row) > 4 else "")
            cost = parse_cost(row[11] if len(row) > 11 else "")
            if cost is None or quality is None or attack is None or defense is None:
                continue

            traits = []
            for col in range(5, 11):
                parsed = parse_trait(row[col] if len(row) > col else "")
                if parsed:
                    traits.append(parsed)

            kind = unit_kind(traits, quality, name)
            min_stands, max_stands, default_stands = stand_limits(kind)
            limited = any(t["limited"] for t in traits) or quality <= 3
            personality = any(t["personality"] for t in traits) or quality <= 2
            if personality:
                limited = True

            base_id = f"{current['id']}-{slugify(name)}"
            seen_ids[base_id] = seen_ids.get(base_id, 0) + 1
            unit_id = base_id if seen_ids[base_id] == 1 else f"{base_id}-{seen_ids[base_id]}"

            current["units"].append(
                {
                    "id": unit_id,
                    "name": name,
                    "factionId": current["id"],
                    "cost": cost,
                    "quality": quality,
                    "attack": attack,
                    "defense": defense,
                    "traits": traits,
                    "kind": kind,
                    "limited": limited,
                    "personality": personality,
                    "minStands": min_stands,
                    "maxStands": max_stands,
                    "defaultStands": default_stands,
                }
            )

    factions = [f for f in factions if f["units"]]
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": CSV_PATH.name,
        "rules": {
            "limitedCap": 0.5,
            "personalityCap": 0.33,
            "q3IsLimited": True,
            "q2IsPersonality": True,
            "q2IsRare1": True,
            "mercenaryDiscount": 0.1,
            "defaultBudget": 1500,
            "budgetPresets": [1000, 1500, 2000],
            "homeTerrains": [
                "Plains",
                "Hills",
                "Forest",
                "Jungle",
                "Swamp",
                "Desert",
                "Snow",
                "Mountains",
                "Coast",
                "Ruins",
                "Underground",
                "Burial Ground",
            ],
        },
        "factions": factions,
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    total = sum(len(f["units"]) for f in factions)
    print(f"Wrote {len(factions)} factions, {total} units -> {OUT_PATH}")
    for faction in factions:
        print(f"  {faction['name']}: {len(faction['units'])}")


if __name__ == "__main__":
    main()
