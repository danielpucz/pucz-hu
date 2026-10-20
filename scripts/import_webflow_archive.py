#!/usr/bin/env python3
"""Import original publicly hosted Pucz.hu Webflow writing once, as CMS Markdown.
The original owner-provided ZIP was used to validate selectors and inventory.
A local --zip FILE option can instead import directly from that authoritative ZIP.
"""
import argparse
import json
import re
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from bs4 import BeautifulSoup
from markdownify import markdownify

BASE = "https://www.pucz.hu/"
EXISTING = {
    "blog/keep-the-tiny-detectives-busy.html": "/articles/keep-the-tiny-detectives-busy/",
    "meals/the-perfect-ramen-egg.html": "/recipes/the-perfect-ramen-egg/",
}
UNLISTED = ["blog/getting-the-mojo-back.html"]
LABELS = {
    "blog/a-better-internet.html": "A Better Internet",
    "blog/my-therapist-burns-the-system.html": "My Therapist is Burning the System Down",
    "blog/sleeping-on-the-couch.html": "The Sleeping on the Couch Thing",
    "blog/apparently-not-into-tiny-women-anymore.html": "I’m Not Into Tiny Women Anymore",
    "blog/jump-in-the-car-no-time-to-explain.html": "Jump in the Car There’s No Time to Explain!",
    "blog/i-didnt-do-the-work.html": "I didn’t do the Work",
    "blog/where-is-the-fucking-money.html": "Where’s the Fucking Money?",
    "blog/fuck-you-to-apple-tv.html": "A Very Personal Fuck You To Apple TV+",
    "list/things-that-sparks-joy.html": "Things That Spark Joy",
    "list/list-of-songs-that-doesnt-end-but-fade-out.html": "Songs that doesn’t End",
}

def ws(s):
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()

def q(s):
    return json.dumps(ws(s), ensure_ascii=False)

class Source:
    def __init__(self, zip_path):
        self.z = zipfile.ZipFile(zip_path) if zip_path else None
        self.names = {n.casefold(): n for n in self.z.namelist()} if self.z else {}

    def fetch(self, path):
        if self.z:
            return self.z.read(self.names[path.casefold()])
        base = urllib.parse.urljoin(BASE, re.sub(r"\.html$", "", path))
        for url in (base, urllib.parse.urljoin(BASE, path)):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=40) as f:
                    return f.read()
            except Exception:
                continue
        raise RuntimeError("Webflow page inaccessible: " + path)

    def image(self, src, output):
        if not src:
            return ""
        url = urllib.parse.urljoin(BASE, src)
        name = Path(urllib.parse.unquote(urllib.parse.urlsplit(url).path)).name
        if not name:
            return ""
        dest = output / "public/images/archive" / name
        if not dest.exists():
            source_path = ("images/" + name).casefold()
            if self.z and source_path in self.names:
                data = self.z.read(self.names[source_path])
            else:
                with urllib.request.urlopen(
                    urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=50
                ) as response:
                    data = response.read()
            if len(data) == 0 or len(data) > 24_000_000:
                raise RuntimeError("Invalid media file: " + url)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        return "/images/archive/" + name

def toc(home):
    box = home.select_one(".blogs-container")
    if not box:
        raise RuntimeError("Webflow writing directory not found, refusing an incomplete import")
    items = []
    category = ""
    for node in box.find_all(["div", "a"]):
        if "footer-heading" in node.get("class", []):
            category = ws(node.get_text(" ", strip=True))
            if category == "Very Good Lists I've Made":
                category = "Very Good Lists I’ve Made"
        if node.name == "a" and "blog-chips" in node.get("class", []):
            href = urllib.parse.urlsplit(urllib.parse.urljoin(BASE, node.get("href", ""))).path.lstrip("/")
            if re.fullmatch(r"(blog|list|meals)/[\w-]+", href):
                href += ".html"
            if not category or not re.fullmatch(r"(blog|list|meals)/[\w-]+\.html", href):
                raise RuntimeError("Unexpected Webflow menu entry: " + href)
            items.append({"path": href, "category": category,
                          "navigationTitle": LABELS.get(href, ws(node.get_text(" ", strip=True)))})
    if len(items) < 45:
        raise RuntimeError(f"Missing Webflow pages from directory ({len(items)})")
    for page in UNLISTED:
        if page not in {i["path"] for i in items}:
            items.append({"path": page, "category": "Uncategorized",
                          "navigationTitle": "", "unlisted": True})
    return items

def markdown(el):
    s = markdownify(str(el), heading_style="ATX", bullets="-", strip=["div", "span"])
    s = re.sub(r"\n{3,}", "\n\n", s.replace("\xa0", " ")).strip()
    if not s:
        raise RuntimeError("Empty content")
    return s

def write_content(src, output, item):
    path = item["path"]
    section, filename = path.split("/")
    slug = filename.removesuffix(".html")
    try:
        soup = BeautifulSoup(src.fetch(path), "html.parser")
    except Exception:
        if item.get("unlisted"):
            print("WARN: unlisted export-only draft not publicly accessible:", path)
            return {**item, "status": "source-only", "target": None}
        raise
    header = soup.select_one("h1.page-title")
    text = soup.select_one(".rich-text-block.w-richtext")
    if not header or not text:
        raise RuntimeError("Missing original title/body " + path)
    title = ws(header.get_text(" ", strip=True))
    meta = soup.select_one('meta[name="description"]')
    description = ws(meta.get("content", "")) if meta else ws(text.get_text(" ", strip=True))[:180]
    hero = soup.select_one("img.article-hero, img.recipe-hero")
    if not hero and section == "blog":
        hero = next((img for img in soup.select('img[src]')
            if img.get("src", "").startswith(("../images/", "/images/"))
            and not set(img.get("class", [])) & {"hero-illustration", "fire", "star-illustration"}), None)
    image = src.image(hero.get("src", ""), output) if hero and section != "list" else ""
    alt = ws(hero.get("alt") or title) if hero else title
    for img in text.select('img[src]'):
        img["src"] = src.image(img["src"], output)
        img.attrs.pop("srcset", None)
        img.attrs.pop("sizes", None)
    if section == "list":
        grid = soup.select_one(".people-list, .project-list, .movie-list")
        if not grid:
            raise RuntimeError("Missing original cards " + path)
        for img in grid.select("img[src]"):
            img["src"] = src.image(img["src"], output)
            img.attrs.pop("srcset", None)
            img.attrs.pop("sizes", None)
        original = output / "src/data/archive-lists" / (slug + ".html")
        original.parent.mkdir(parents=True, exist_ok=True)
        original.write_text(str(grid), encoding="utf-8")
        parts = [markdown(text)]
        count = 0
        for child in grid.find_all(recursive=False):
            label = ws(child.get_text(" ", strip=True))
            if label:
                count += 1
                parts.append(f"## Item {count}\n\n{label}")
        if not count:
            raise RuntimeError("No list entries " + path)
        body = "\n\n".join(parts)
        collection, published = "lists", False
    else:
        body = markdown(text)
        collection = "recipes" if section == "meals" else "articles"
        published = not item.get("unlisted", False)
    target = Path("src/content") / collection / (slug + ".md")
    absolute = output / target
    if absolute.exists():
        # Safe re-runs never replace already imported or subsequently edited CMS entries.
        return {**item, "title": title, "status": "imported", "target": str(target), "cover": image}
    fields = {
        "title": title, "navigationTitle": item["navigationTitle"],
        "description": description, "category": item["category"],
        "image": image, "imageAlt": alt,
        "published": published, "legacyPath": f"/{section}/{slug}/",
        "primaryPath": "blog" if section == "blog" else "meals" if section == "meals" else "list",
    }
    head = ["---"] + [f"{key}: {'true' if val is True else 'false' if val is False else q(val)}"
                        for key, val in fields.items()] + ["---", "", body, ""]
    absolute.parent.mkdir(parents=True, exist_ok=True)
    absolute.write_text("\n".join(head), encoding="utf-8")
    return {**item, "title": title, "status": "imported",
            "target": str(target), "cover": image}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--zip", help="Use the exact owner-provided Webflow ZIP instead of the live copy")
    p.add_argument("--output", default=".")
    args = p.parse_args()
    out = Path(args.output)
    source = Source(args.zip)
    items = toc(BeautifulSoup(source.fetch("index.html"), "html.parser"))
    records = []
    redirects = []
    for item in items:
        path = item["path"]
        kind, name = path.split("/")
        slug = name[:-5]
        if path in EXISTING:
            records.append({**item, "status": "already-migrated"})
            redirects.extend([
                f"/{kind}/{slug} {EXISTING[path]} 301",
                f"/{kind}/{slug}/ {EXISTING[path]} 301",
                f"/{kind}/{slug}.html {EXISTING[path]} 301",
            ])
        else:
            entry = write_content(source, out, item)
            records.append(entry)
            if entry["status"] == "imported" and kind != "list" and not item.get("unlisted"):
                redirects.append(f"/{kind}/{slug}.html /{kind}/{slug}/ 301")
    location = out / "src/data/webflow-archive-manifest.json"
    location.parent.mkdir(parents=True, exist_ok=True)
    location.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    redirect_path = out / "public/_redirects"
    redirect_path.parent.mkdir(parents=True, exist_ok=True)
    redirect_path.write_text("# Original Webflow page URLs\n" + "\n".join(redirects) + "\n", encoding="utf-8")
    print("Source pages", len(records), "migrated",
          sum(r["status"] == "imported" for r in records),
          "kept existing", len(EXISTING),
          "unpublished lists", sum(r["path"].startswith("list/") for r in records))
    print("Publication dates are unspecified; list pages stay unpublished pending design.")

if __name__ == "__main__":
    main()
