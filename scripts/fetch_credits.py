#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generates CREDITS.md with the artists of every downloaded sprite.

    python scripts/fetch_credits.py

Every SpriteCollab folder has a credits.txt (no header) with lines
    date <TAB> author <TAB> ...
where the author is a name or a Discord ID ("<@!123...>"). IDs are
resolved with the credit_names.txt at the root of the repo.
"""
import io
import json
import os
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor

RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'public', 'assets', 'pokemon')
OUT = os.path.join(ROOT, 'CREDITS.md')
MEGA_META = os.path.join(ROOT, 'src', 'js', 'data', 'sprites-meta-mega.js')


def fetch(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'pokesurvivor/1.0'})
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.read().decode('utf-8', 'replace')
    except Exception:
        return ''


def main():
    # Discord ID / alias -> (display name, contact)
    names = {}
    for line in fetch(f'{RAW}/credit_names.txt').splitlines()[1:]:
        parts = line.split('\t')
        if len(parts) >= 2:
            display = parts[0].strip()
            contact = parts[2].strip() if len(parts) > 2 else ''
            names[parts[1].strip()] = (display, contact)
            names[display] = (display, contact)

    # (sort key, label, SpriteCollab folder, its shiny folder, asset folder)
    sets = [((d, ''), str(d), f'{d:04d}', f'{d:04d}/0000/0001', str(d))
            for d in sorted(int(d) for d in os.listdir(ASSETS) if d.isdigit())]
    # Mega and Primal forms (scripts/fetch_sprites.py --megas).
    if os.path.exists(MEGA_META):
        for line in open(MEGA_META, encoding='utf-8'):
            m = re.match(r'\s*(m\w+): (\{.*\}),$', line)
            if m:
                key, meta = m[1], json.loads(m[2])
                tag = f"{meta['b']:04d}/{meta['f']}"
                label = f"{meta['b']} ({meta['n'].replace('_', ' ')})"
                sets.append(((meta['b'], key), label, tag, tag + '/0001', key))

    def one(entry):
        sort, label, tag, stag, folder = entry
        # Credits for the normal sprite and the shiny one (which may be by another artist).
        txt = fetch(f'{RAW}/sprite/{tag}/credits.txt')
        if os.path.isdir(os.path.join(ASSETS, folder, 's')):
            txt += '\n' + fetch(f'{RAW}/sprite/{stag}/credits.txt')
        authors = []
        for line in txt.splitlines():
            parts = line.split('\t')
            a = parts[1].strip() if len(parts) > 1 else ''
            if a and names.get(a, (a, ''))[0]:
                authors.append(a)
        return (sort, label), authors

    per_artist = {}
    with ThreadPoolExecutor(max_workers=12) as ex:
        for entry, authors in ex.map(one, sets):
            for a in set(authors):
                display, contact = names.get(a, (a, ''))
                per_artist.setdefault((display, contact), set()).add(entry)

    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('# Credits\n\n')
        f.write('## Sprites\n\n')
        f.write('The *Pokémon Mystery Dungeon*-style sprites come from\n')
        f.write('[SpriteCollab](https://github.com/PMDCollab/SpriteCollab), under the\n')
        f.write('[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) license:\n')
        f.write('**non-commercial** use with attribution to their artists.\n\n')
        f.write('| Artist | Contact | Sprites (Pokédex no.) |\n|---|---|---|\n')
        for (display, contact), dx in sorted(per_artist.items(), key=lambda kv: kv[0][0].lower()):
            nums = ', '.join(label for _, label in sorted(dx))
            f.write(f'| {display} | {contact} | {nums} |\n')
        f.write('\n## Gym leader sprites\n\n')
        f.write('The gym leaders in Story mode (`public/assets/trainers/<region>/`) are the official trainer sprites\n')
        f.write('of *FireRed / LeafGreen* (Kanto), *HeartGold / SoulSilver* (Johto), *Ruby / Sapphire* and *Emerald*\n')
        f.write("(Hoenn), *Diamond / Pearl* (Sinnoh) and *Black / White* (Unova), taken from Smogon's sprite repository\n")
        f.write('([smogon/sprites](https://github.com/smogon/sprites), `src/_uncategorized/canonical/trainers/`),\n')
        f.write('the collection behind Pokémon Showdown. They are © Nintendo / Creatures / GAME FREAK and are used\n')
        f.write('here non-commercially, as in the rest of this fan project. Regions without official sprites there\n')
        f.write("(Kalos, Alola, Galar, Paldea) show only the leader's Pokémon.\n")
        f.write('\n## Item sprites\n\n')
        f.write('The Mega Stone and Orb icons (`public/assets/items/`) are the official item sprites, taken from\n')
        f.write('[PokeAPI/sprites](https://github.com/PokeAPI/sprites). They are © Nintendo / Creatures / GAME FREAK\n')
        f.write('and are used here non-commercially.\n')
        f.write('\n## Data\n\n')
        f.write('Base stats and names: [PokeAPI](https://pokeapi.co/),\n')
        f.write('downloaded once and stored in `js/data/pokedex.js`.\n\n')
        f.write('## Font\n\n')
        f.write('[Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) (SIL Open Font License 1.1,\n')
        f.write('license in `assets/fonts/OFL.txt`). The game uses a modified version,\n')
        f.write('"Pixelify PS", with redrawn digits to tell them apart more easily\n')
        f.write('(`scripts/make_font.py`).\n\n')
        f.write('## Trademark\n\n')
        f.write('Pokémon is the property of Nintendo, Creatures Inc. and GAME FREAK.\n')
        f.write('This is a non-profit fan project.\n')

    print(f'{len(per_artist)} artists for {len(sets)} sprite sets -> CREDITS.md')


if __name__ == '__main__':
    main()
