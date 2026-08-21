#!/usr/bin/env python3
"""Extract trait and spell rules from the OAaH PDF into JSON."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

PDF = Path(__file__).resolve().parents[1] / "docs" / "of-armies-and-hordes.pdf"
OUT = Path(__file__).resolve().parents[1] / "src" / "assets" / "data" / "trait-rules.json"

FOOTER_RE = re.compile(
    r"^(Thomas billaud.*|\d+|A barbarian chariot.*|This Giant negates.*|"
    r"28mm .*|A Close Order.*)$",
    re.I,
)

TRAIT_TITLES = [
    "Adventuring Party",
    "Airship",
    "Amphibious",
    "Animal",
    "Aquatic",
    "Army Standard",
    "Artificial",
    "Artillery",
    "Assassin",
    "Astrologer",
    "Beast Lord",
    "Berserk",
    "Boat",
    "Bodyguards",
    "Burrowing",
    "Champion",
    "Chariot",
    "Coward",
    "Desert-Walk",
    "Devastating Charge",
    "Difficult Target",
    "Discipline Master",
    "Dragon Breath",
    "Drilled",
    "Elan",
    "Engineers",
    "Expendable",
    "Extra Lives x4",
    "Extra Lives x2/x3",
    "Extra Lives",
    "Fast",
    "Fear Projectiles",
    "Fearless",
    "Fear",
    "Flaming Projectiles",
    "Flying",
    "Forester",
    "Gaze Attack",
    "General",
    "Giant",
    "Grenades",
    "Hero",
    "High Priest",
    "Highwaymen",
    "Horde",
    "Immaterial",
    "Inspiring Leader",
    "Lurkers",
    "Monster",
    "Mountaineer",
    "Mounted",
    "Necromancer",
    "Nonreactive",
    "Pikes",
    "Plague-Carriers",
    "Plague Projectiles",
    "Poisoned Missiles",
    "Poison/Venom",
    "Rabble",
    "Ranger",
    "Reluctant",
    "Resilient",
    "Savage",
    "Scout",
    "Shieldwall",
    "Shooters",
    "Siege Engine",
    "Skirmishers",
    "Slayers",
    "Slow",
    "Snow-Walk",
    "Spell-Caster",
    "Spy",
    "Static",
    "Stealth",
    "Steadfast",
    "Sub-Commander",
    "Swamp-Walk",
    "Talisman vs. Fey Creatures",
    "Teleport",
    "Thief",
    "Tough",
    "Trample",
    "Undead",
    "Unpredictable",
    "Unreliable",
    "Vampire",
    "Warband",
]

SPELL_TITLES = [
    "Alter Terrain",
    "Armor",
    "Blessing",
    "Bolster",
    "Chaos",
    "Curse",
    "Destroy Constructs",
    "Destroy Undead",
    "Eagle's Eyes",
    "Fireball",
    "Fury",
    "Futuresight",
    "Lightning Bolt",
    "Meteor Storm",
    "Rain of Arrows",
    "Steal Spell",
    "Summon Monster",
    "Teleportation",
    "Terror",
    "Windriders",
    "Windstorm",
]

OVERRIDES = {
    "Assassin": (
        "This Trait comes in three levels. An Assassin may not be attacked by "
        "non-Personality units unless he attacks the unit or a Personality attached "
        "to the unit. Hits from Assassin are assigned by the Assassin's controlling "
        "player. An Assassin's ranged and melee dice may be directed against any "
        "target figure in an area, ignoring Shielding; however, if the target "
        "personality is attached to a unit with the Bodyguards Trait, the Assassin "
        "must assign his hits to the Bodyguards before he can assign them to the "
        "personality. An Assassin rolls one melee die per level. In campaigns, "
        "Assassins may be sent to perform assassination missions."
    ),
    "Astrologer": (
        "If you have an Astrologer in your army, you have a +1 to the Scouting roll "
        "at the beginning of the game. In addition, once per game, you may reroll "
        "any one single die for a unit in the same area with the Astrologer OR you "
        "may disregard an enemy's Ambush bonus for an entire combat. This reroll "
        "represents the Astrologer's fortune-telling that provides some degree of "
        "control over fate or a warning about an Ambush or stratagem."
    ),
    "Berserk": (
        "When a player announces that the Berserk unit will perform an attack, the "
        "player rolls a die. On a 1-3, nothing happens. On a 4+, the unit goes "
        "Berserk, getting -1 to D but +1 to A and Morale rolls for the duration of "
        "the combat. Roll each time the unit enters a new combat. Berserk units may "
        "shoot missiles but may not perform hit and run tactics with missile "
        "weapons. If a General is attached to a Berserk unit, and the unit goes "
        "Berserk, the General must Lead from the Front. Any character attached to a "
        "Berserk unit will suffer the same effects of the Berserk Trait. If multiple "
        "Berserk units are in the same area, roll once per unit, but if at least one "
        "unit goes Berserk, ALL the units in the area go Berserk."
    ),
    "Drilled": (
        "Drilled units may reroll one failed Activation die each turn. Reaction "
        "rolls may not be rerolled."
    ),
    "Elan": (
        "On the first turn of the game, the unit has +1 on Activation rolls. This "
        "applies even if the opponent has the initiative. Elan gives no modifier to "
        "Reaction rolls."
    ),
    "Engineers": (
        "The unit may attack bridges and Fortifications. In addition, it has +1 to "
        "A in melee against Artillery."
    ),
    "Fear": (
        "The unit causes fear. Any enemy wishing to attack the area occupied by the "
        "fearsome unit must first pass a Morale roll on one die. If successful, the "
        "attack proceeds as normal. On a failure, the unit may not attack the area. "
        "The unit failing the Morale roll may perform other actions, such as "
        "attacking a different enemy. A unit may try the Morale roll against Fear "
        "each turn until they succeed. Once a unit has surpassed its Fear, they will "
        "be able to attack that specific enemy unit in later turns without having to "
        "pass additional Morale rolls. Units with Fear or Fearless are immune to Fear."
    ),
    "Unique": (
        "This profile is unique. Take it only once unless a scenario says otherwise. "
        "The rulebook does not give Unique its own Trait entry."
    ),
    "Ambushers": (
        "A unit with a terrain-based Trait in the appropriate terrain (e.g. Foresters "
        "in forests, units with Swamp-Walk in swamps) may spend one action to set up "
        "an Ambush. Mark the Ambush by placing the figures in appropriate positions. "
        "The ambushers gain +1 to A and D both in melee and missile combat against "
        "any enemy entering the area. This bonus is negated if the enemy has Scouts "
        "in the unit. The Ambush bonus is cumulative with the elevation bonus. Units "
        "with the Ambushers Trait may also be deployed as ambushes if their side wins "
        "the Scouting roll."
    ),
    "Futuresight": (
        "Target unit may reroll 1, 2 or 3 dice in its next turn (one die per each "
        "action spent in casting the spell). Rerolls may be used for any Q or melee "
        "rolls. This spell may be cast on any friendly unit in play with no range "
        "restrictions. (1, 2 or 3 Actions)"
    ),
    "Lightning Bolt": (
        "This spell causes a missile attack of one die of Special Damage per action "
        "used. It may be used in the shooting phase like a regular ranged attack, or "
        "to attack a target up to one area away. It may cause a maximum of one "
        "casualty (one stand removed) against any target unit, but against single "
        "targets with Extra Lives (personalities, monsters, giants, dragons), the "
        "Spell-Caster may reroll any die that fails. Rerolls are final. (1, 2 or 3 Actions)"
    ),
    "Rain of Arrows": (
        "This spell causes a missile attack of one die per action used. The arrows "
        "hit at +1, and all results of one are rerolled (reroll only once). This "
        "spell is NOT Special Damage; it hits like a regular missile attack. The +1 "
        "does not stack with the bonus from any Shooter Trait possessed by the "
        "Spell-Caster. (2 or 3 Actions)"
    ),
    "Steal Spell": (
        "This spell may only be cast on an enemy Spell-Caster during an attack on "
        "that spell-caster's area. The Spell-Caster chooses and steals one of the "
        "target's spells and may cast the stolen spell only once per game. The target "
        "may not cast the stolen spell until the spell-thief has cast it, at which "
        "point it immediately returns to its original owner. (2 Actions)"
    ),
    "Summon Monster": (
        "This spell summons a monster that fights for the caster. A single monster "
        "per game may be summoned. It appears in the Spell-Caster's area, ignoring "
        "stacking rules, or up to one area away, and may be placed to shield another "
        "unit. The monster may be chosen from any army lists allowed in the game and "
        "must have the Monster Trait. It may be summoned into an enemy-occupied area "
        "and immediately activated to attack. The monster disappears at the end of "
        "the melee. If killed, hits on the monster are ignored for Morale; hits it "
        "inflicted count as normal. (3 Actions)"
    ),
}

ALIASES = {
    "Adventuring Party": ["Adventuring Party"],
    "Airship": ["Airship"],
    "Amphibious": ["Amphibious"],
    "Animal": ["Animal"],
    "Aquatic": ["Aquatic"],
    "Army Standard": ["Army Standard"],
    "Artificial": ["Artificial"],
    "Artillery": ["Artillery", "Artillery level 2", "Artillery level 3", "Artillery level 4", "Artillery level 5"],
    "Assassin": ["Assassin", "Assassin Level 1", "Assassin Level 2", "Assassin Level 3"],
    "Astrologer": ["Astrologer"],
    "Beast Lord": ["Beast Lord"],
    "Berserk": ["Berserk"],
    "Boat": ["Boat"],
    "Bodyguards": ["Bodyguards"],
    "Burrowing": ["Burrowing"],
    "Champion": ["Champion"],
    "Chariot": ["Chariot", "Chariot level 2", "Chariot level 3", "Chariot level 4", "Chariot level 5", "Chariot level 6"],
    "Coward": ["Coward"],
    "Desert-Walk": ["Desert-Walk"],
    "Devastating Charge": ["Devastating Charge"],
    "Difficult Target": ["Difficult Target"],
    "Discipline Master": ["Discipline Master"],
    "Dragon Breath": [
        "Dragon Breath",
        "Dragon Breath level 2",
        "Dragon Breath level 3",
        "Dragon Breath level 6",
    ],
    "Drilled": ["Drilled"],
    "Elan": ["Elan"],
    "Engineers": ["Engineers"],
    "Expendable": ["Expendable"],
    "Extra Lives": ["Extra Lives", "Extra Lives x2", "Extra Lives x3", "Extra Lives x4"],
    "Fast": ["Fast"],
    "Fear": ["Fear"],
    "Fear Projectiles": ["Fear Projectiles"],
    "Fearless": ["Fearless"],
    "Flaming Projectiles": ["Flaming Projectiles"],
    "Flying": ["Flying"],
    "Forester": ["Forester"],
    "Gaze Attack": ["Gaze Attack", "Gaze Attack Level 1", "Gaze Attack Level 2", "Gaze Attack Level 3"],
    "General": ["General"],
    "Giant": ["Giant", "Giant Level 2", "Giant Level 3", "Giant Level 4", "Giant Level 5"],
    "Grenades": ["Grenades"],
    "Hero": ["Hero"],
    "High Priest": ["High Priest"],
    "Highwaymen": ["Highwaymen"],
    "Horde": ["Horde"],
    "Immaterial": ["Immaterial"],
    "Inspiring Leader": ["Inspiring Leader"],
    "Lurkers": ["Lurkers"],
    "Monster": ["Monster", "Monster Level 1", "Monster Level 2", "Monster Level 3", "Monster Level 4"],
    "Mountaineer": ["Mountaineer"],
    "Mounted": ["Mounted"],
    "Necromancer": ["Necromancer"],
    "Nonreactive": ["Nonreactive"],
    "Pikes": ["Pikes"],
    "Plague-Carriers": ["Plague-Carriers"],
    "Plague Projectiles": ["Plague Projectiles"],
    "Poisoned Missiles": ["Poisoned Missiles"],
    "Poison/Venom": ["Poison/Venom"],
    "Rabble": ["Rabble"],
    "Ranger": ["Ranger"],
    "Reluctant": ["Reluctant"],
    "Resilient": ["Resilient"],
    "Savage": ["Savage"],
    "Scout": ["Scout"],
    "Shieldwall": ["Shieldwall"],
    "Shooters": ["Shooters", "Shooters 0", "Shooters 1", "Shooters 2", "Shooters 3"],
    "Siege Engine": ["Siege Engine", "Siege Engine Level 1", "Siege Engine Level 2", "Siege Engine Level 3"],
    "Skirmishers": ["Skirmishers"],
    "Slayers": ["Slayers"],
    "Slow": ["Slow"],
    "Snow-Walk": ["Snow-Walk"],
    "Spell-Caster": ["Spell-Caster"],
    "Spy": ["Spy"],
    "Static": ["Static"],
    "Stealth": ["Stealth"],
    "Steadfast": ["Steadfast"],
    "Sub-Commander": ["Sub-Commander", "SubCommander"],
    "Swamp-Walk": ["Swamp-Walk"],
    "Talisman vs. Fey Creatures": ["Talisman vs. Fey Creatures"],
    "Teleport": ["Teleport"],
    "Thief": ["Thief"],
    "Tough": ["Tough"],
    "Trample": ["Trample"],
    "Undead": ["Undead"],
    "Unpredictable": ["Unpredictable"],
    "Unreliable": ["Unreliable"],
    "Vampire": ["Vampire"],
    "Warband": ["Warband", "warband"],
    "Ambushers": ["Ambushers"],
    "Unique": ["Unique"],
}


def pdf_text(start: int, end: int) -> str:
    result = subprocess.run(
        ["pdftotext", "-f", str(start), "-l", str(end), str(PDF), "-"],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def clean_lines(text: str) -> list[str]:
    lines = []
    for raw in text.splitlines():
        line = raw.replace("\u00ad", "").replace("­", "-").strip()
        if not line or FOOTER_RE.match(line):
            continue
        if line.startswith(""):
            continue
        lines.append(re.sub(r"\s+", " ", line))
    return lines


def title_pattern(titles: list[str]) -> re.Pattern[str]:
    escaped = sorted((re.escape(t) for t in titles), key=len, reverse=True)
    return re.compile(
        rf"^(?P<title>{'|'.join(escaped)})(?:\s*[-–—,]?\s*[LPR\d,\s]+)?(?:\s*\([^)]+\))?$",
        re.I,
    )


def split_entries(lines: list[str], titles: list[str]) -> dict[str, str]:
    pattern = title_pattern(titles)
    canonical = {t.lower(): t for t in titles}
    entries: dict[str, list[str]] = {}
    current: str | None = None
    for line in lines:
        match = pattern.match(line.replace("–", "-").replace("—", "-"))
        if match:
            raw_title = match.group("title")
            current = canonical.get(raw_title.lower(), raw_title)
            entries.setdefault(current, [])
            continue
        if current:
            entries[current].append(line)
    cleaned = {}
    for name, body_lines in entries.items():
        body = " ".join(body_lines)
        body = re.sub(r"\s+", " ", body).strip()
        body = re.sub(r"hyphenation artifacts", "", body)
        cleaned[name] = body
    return cleaned


def hyphen_fix(text: str) -> str:
    text = text.replace("nonPersonality", "non-Personality")
    text = text.replace("nonAmphibious", "non-Amphibious")
    text = text.replace("SpellCaster", "Spell-Caster")
    text = text.replace("SubCom-", "Sub-")
    text = text.replace("Sub-Com mander", "Sub-Commander")
    text = text.replace("num- ber", "number")
    text = text.replace("differen- tiate", "differentiate")
    text = text.replace("seaworthy", "seaworthy")
    text = re.sub(r"(\w)- (\w)", r"\1\2", text)
    return re.sub(r"\s+", " ", text).strip()


def main() -> None:
    trait_text = pdf_text(65, 80)
    spell_text = pdf_text(61, 64)
    artillery = pdf_text(56, 56)

    traits = split_entries(clean_lines(trait_text), TRAIT_TITLES)
    spells = split_entries(clean_lines(spell_text), SPELL_TITLES)

    extra_lives_parts = [
        traits.get("Extra Lives x2/x3", ""),
        traits.get("Extra Lives x4", ""),
        traits.get("Extra Lives", ""),
    ]
    traits["Extra Lives"] = " ".join(p for p in extra_lives_parts if p)
    traits.pop("Extra Lives x2/x3", None)
    traits.pop("Extra Lives x4", None)

    artillery_lines = clean_lines(artillery)
    artillery_body = hyphen_fix(" ".join(artillery_lines[1:]))
    if "Artillery" in traits:
        traits["Artillery"] = hyphen_fix(traits["Artillery"]) + " " + artillery_body

    for name, body in OVERRIDES.items():
        if name in SPELL_TITLES:
            spells[name] = body
        else:
            traits[name] = body

    records = []
    for name, body in traits.items():
        records.append(
            {
                "name": name,
                "kind": "trait",
                "text": hyphen_fix(body) if name not in OVERRIDES else body,
                "aliases": ALIASES.get(name, [name]),
            }
        )
    for name, body in spells.items():
        records.append(
            {
                "name": name,
                "kind": "spell",
                "text": hyphen_fix(body) if name not in OVERRIDES else body,
                "aliases": [name, f"Spell: {name}"],
            }
        )

    records.sort(key=lambda item: item["name"].lower())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": "of-armies-and-hordes.pdf", "entries": records}, indent=2), encoding="utf-8")
    print(f"Wrote {len(records)} rules -> {OUT}")
    missing = [t for t in TRAIT_TITLES if t not in {r["name"] for r in records} and t not in {"Extra Lives x2/x3", "Extra Lives x4"}]
    print("missing titles", missing)


if __name__ == "__main__":
    main()
