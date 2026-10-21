#!/usr/bin/env python3
"""One-time offline conversion of preserved Webflow card HTML into CMS data.
Requires beautifulsoup4, PyYAML and markdownify. Run from repository root.
No public list/event/project pages are created by this migration.
"""
from pathlib import Path
import json
import re
import unicodedata
import yaml
from bs4 import BeautifulSoup
from markdownify import markdownify

SRC = Path("src/content/lists")
HTML = Path("src/data/archive-lists")
OUT = Path("src/content")
FUN = {
    "incredible-people": "people",
    "things-that-sparks-joy": "joy",
    "list-of-songs-that-doesnt-end-but-fade-out": "songs",
}
COUNTS = {"people": 45, "joy": 134, "songs": 41, "events": 7, "projects": 225}

def clean(value):
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()

def text(node):
    return clean(node.get_text(" ", strip=True)) if node else ""

def slugify(value):
    normalized = unicodedata.normalize("NFKD", value)
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return (re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")[:70].rstrip("-") or "item")

def original(slug):
    raw = (SRC / (slug + ".md")).read_text(encoding="utf-8")
    match = re.match(r"^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$", raw)
    if not match:
        raise ValueError("Bad original frontmatter in " + slug)
    metadata = yaml.safe_load(match.group(1))
    introduction = re.split(r"(?m)^## Item 1\s*$", match.group(2), maxsplit=1)[0].strip()
    return metadata, introduction

def cards(slug):
    html = (HTML / (slug + ".html")).read_text(encoding="utf-8")
    document = BeautifulSoup(html, "html.parser")
    if not document.find():
        raise ValueError("Empty archived markup: " + slug)
    return document.find().find_all("div", recursive=False)

def save(path, fields, body=""):
    if path.exists() and path.stat().st_size:
        raise FileExistsError("Refusing to overwrite an existing CMS entry: " + str(path))
    path.parent.mkdir(parents=True, exist_ok=True)
    frontmatter = yaml.safe_dump(fields, allow_unicode=True, sort_keys=False, width=140)
    path.write_text("---\n" + frontmatter + "---\n\n" + body.strip() + "\n", encoding="utf-8")

def import_fun_lists():
    imported = {}
    for slug, kind in FUN.items():
        metadata, introduction = original(slug)
        items = []
        for index, card in enumerate(cards(slug), 1):
            stable_id = f"{kind}-{index:03d}"
            if kind == "people":
                name = text(card.select_one(".text-size-regular"))
                if not name:
                    raise ValueError("Missing original person " + str(index))
                item = {"_block": "person", "id": stable_id, "name": name,
                        "role": text(card.select_one(".text-size-small")),
                        "note": text(card.select_one(".handwritten-postit"))}
                anchor = card.select_one(".text-size-regular a[href]")
                if anchor:
                    item["url"] = anchor["href"]
            elif kind == "songs":
                anchor = card.select_one(".text-size-huge a")
                if not anchor:
                    raise ValueError("Missing original song " + str(index))
                pieces = [clean(piece) for piece in anchor.stripped_strings]
                if len(pieces) != 2:
                    raise ValueError("Ambiguous song split: " + repr(pieces))
                item = {"_block": "song", "id": stable_id, "artist": pieces[0],
                        "track": pieces[1], "url": anchor.get("href", "")}
            else:
                phrase = text(card.select_one(".handwritten"))
                if not phrase:
                    raise ValueError("Missing original joyful thought " + str(index))
                item = {"_block": "joy", "id": stable_id, "text": phrase}
                anchor = card.select_one("a[href]")
                if anchor:
                    item["url"] = anchor["href"]
            items.append(item)
        if len(items) != COUNTS[kind]:
            raise ValueError(f"{slug}: expected {COUNTS[kind]}, got {len(items)}")
        entry = {key: metadata[key] for key in
                 ("title", "navigationTitle", "description", "category", "legacyPath")}
        entry.update(listType=kind, published=False, items=items)
        if entry["legacyPath"] != "/list/" + slug + "/":
            raise ValueError("Original /list slug mismatch: " + slug)
        save(OUT / "fun-lists" / (slug + ".md"), entry, introduction)
        imported[slug] = len(items)
    return imported

def import_events():
    slug = "dinner-and-movie-night"
    metadata, introduction = original(slug)
    series = {key: metadata[key] for key in
              ("title", "navigationTitle", "description", "category", "legacyPath")}
    series.update(
        slug=slug,
        published=False,
        labels={"title": "Film", "date": "Date"},
        detailDefinitions=[
            {"key": "food", "label": "Food"},
            {"key": "attendance", "label": "Nr. of guests"},
        ],
    )
    save(OUT / "event-series" / (slug + ".md"), series, introduction)
    entries = cards(slug)
    if len(entries) != COUNTS["events"]:
        raise ValueError("Wrong event count")
    filenames = set()
    for index, card in enumerate(entries, 1):
        name = text(card.select_one(".text-size-huge.is-bold"))
        food = text(card.select_one(".handwritten"))
        note_node = card.select_one(".italic-text")
        note = markdownify(str(note_node), heading_style="ATX").strip("*\n ") if note_node else ""
        attributes = {}
        for row in card.select(".table-row"):
            label = row.select_one(".first-set")
            if label:
                attributes[text(label)] = text(label.find_next_sibling())
        date = attributes.get("Date", "").replace("/", "-")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
            raise ValueError("Invalid original event date: " + str(attributes))
        stem = date + "-" + slugify(name)
        if stem in filenames:
            stem += "-" + str(index)
        filenames.add(stem)
        entry = {
            "title": name, "series": slug, "date": date, "note": note,
            "sourceOrder": index, "published": False,
            "details": [
                {"key": "food", "value": food},
                {"key": "attendance", "value": attributes.get("Nr. of guests", "")},
            ],
        }
        save(OUT / "events" / (stem + ".md"), entry)
    return len(entries)

def import_projects():
    slug = "every-project-ever"
    metadata, introduction = original(slug)
    page = {key: metadata[key] for key in
            ("title", "navigationTitle", "description", "category", "legacyPath")}
    page.update(published=False)
    save(Path("src/data/project-archive.md"), page, introduction)
    records = [card for card in cards(slug) if card.select_one(".table-row .first-set")]
    if len(records) != COUNTS["projects"]:
        raise ValueError(f"Project count {len(records)} did not match {COUNTS['projects']}")
    filenames = set()
    for index, card in enumerate(records, 1):
        name = text(card.select_one(".text-size-huge.is-bold"))
        attributes = {}
        for row in card.select(".table-row"):
            label = row.select_one(".first-set")
            if label:
                attributes[text(label)] = text(label.find_next_sibling())
        if set(attributes) != {"Year", "Type", "Client", "Work"}:
            raise ValueError("Unrecognized original project fields: " + repr(attributes))
        stem = slugify(name)
        original_stem = stem
        collision = 2
        while stem in filenames:
            stem = original_stem + "-" + str(collision)
            collision += 1
        filenames.add(stem)
        data = {
            "title": name,
            "summary": text(card.select_one(".italic-text")),
            "year": attributes["Year"],
            "type": attributes["Type"],
            "client": attributes["Client"],
            "work": attributes["Work"],
            "sourceOrder": index,
            "published": False,
        }
        anchor = card.select_one(".text-size-huge.is-bold a[href]")
        if anchor:
            data["url"] = anchor["href"]
        save(OUT / "projects" / (stem + ".md"), data)
    return len(records)

def main():
    fun = import_fun_lists()
    events = import_events()
    projects = import_projects()
    payload = {
        "source": "src/data/archive-lists/*.html (original archived Webflow cards)",
        "funLists": fun,
        "events": events,
        "projects": projects,
        "note": "All imported collections remain unpublished; no site templates altered.",
    }
    Path("src/data/structured-archive-manifest.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(payload, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
