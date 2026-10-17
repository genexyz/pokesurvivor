#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Downloads the Mystery Dungeon style sprites from SpriteCollab (normal and shiny)
into assets/pokemon/ and generates js/data/sprites-meta.js.

    python scripts/fetch_sprites.py            # every one that exists (1-1025)
    python scripts/fetch_sprites.py 1 151      # only a Pokédex range
    python scripts/fetch_sprites.py --megas    # only the Mega/Primal forms (and their stone icons)

It can be interrupted and restarted: whatever was already downloaded is reused (.cache/).

Source: https://github.com/PMDCollab/SpriteCollab  (CC BY-NC 4.0)
Credits: python scripts/fetch_credits.py

SpriteCollab format:
  sprite/{dex}/            normal sprite
  sprite/{dex}/0000/0001/  shiny sprite (form 0000, variant 0001)
  sprite/{dex}/{form}/     other forms: the Mega/Primal ones go to assets/pokemon/m{dex}[x|y]/
  - columns = frames, rows = 8 directions
    (Down, DownRight, Right, UpRight, Up, UpLeft, Left, DownLeft; verified
     against the -Offsets.png)
  - every animation has its own frame size, so they are aligned by the
    ground anchor, taken from the -Shadow.png

Sheets are saved as palette PNGs (lossless): they take half the space.
"""
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master'
BASE = RAW + '/sprite'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_ASSETS = os.path.join(ROOT, 'public', 'assets', 'pokemon')
OUT_META = os.path.join(ROOT, 'src', 'js', 'data', 'sprites-meta.js')
CACHE = os.path.join(ROOT, '.cache')

WANT = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint']
FALLBACK = {
    'Idle': ['Walk'],
    'Walk': ['Idle'],
    'Attack': ['Strike', 'Swing', 'Shoot', 'Idle'],
    'Shoot': ['Attack', 'Strike', 'Idle'],
    'Charge': ['DeepBreath', 'Idle'],
    'Hurt': ['Cringe', 'Idle'],
    'Faint': ['Hurt', 'Idle'],
}
REQUIRED = {'Idle', 'Walk', 'Attack'}


def fetch(url, retries=4):
    last = None
    for _ in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'pokesurvivor/1.0'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            last = e
        except Exception as e:
            last = e
    print(f'    ! {url.split("/sprite/")[-1]} -> {last}')
    return None


def parse_animdata(xml):
    anims = {}
    for blk in re.findall(r'<Anim>(.*?)</Anim>', xml, re.S):
        name = re.search(r'<Name>(\w+)</Name>', blk)
        if not name:
            continue
        name = name.group(1)
        copy = re.search(r'<CopyOf>(\w+)</CopyOf>', blk)
        if copy:
            anims[name] = {'copyOf': copy.group(1)}
            continue
        fw = re.search(r'<FrameWidth>(\d+)</FrameWidth>', blk)
        fh = re.search(r'<FrameHeight>(\d+)</FrameHeight>', blk)
        if not (fw and fh):
            continue
        durs = [int(x) for x in re.findall(r'<Duration>(\d+)</Duration>', blk)]
        anims[name] = {'w': int(fw.group(1)), 'h': int(fh.group(1)), 'n': len(durs), 'd': durs}
    shadow = re.search(r'<ShadowSize>(\d+)</ShadowSize>', xml)
    return anims, int(shadow.group(1)) if shadow else 1


def resolve(anims, name, seen=None):
    seen = seen or set()
    if name not in anims or name in seen:
        return None, None
    seen.add(name)
    a = anims[name]
    if 'copyOf' in a:
        return resolve(anims, a['copyOf'], seen)
    return name, a


def ground_anchor(png, w, h):
    try:
        im = Image.open(io.BytesIO(png)).convert('RGBA')
    except Exception:
        return None
    px = im.crop((0, 0, w, h)).load()
    xs = ys = n = 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 40:
                xs += x; ys += y; n += 1
    return (round(xs / n, 1), round(ys / n, 1)) if n else None


def save_optimized(png, path):
    """Saves as a PNG with an exact palette (lossless). Returns (width, height)."""
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    cols = im.getcolors(256)
    if cols is None:                          # more than 256 colors: save as is
        im.save(path, 'PNG', optimize=True)
        return im.size
    colors = [c for _, c in cols]
    # Transparent first: some decoders appreciate it.
    colors.sort(key=lambda c: c[3])
    idx = {c: i for i, c in enumerate(colors)}
    pim = Image.new('P', im.size)
    data = im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()
    pim.putdata([idx[p] for p in data])
    flat = []
    for c in colors:
        flat += c[:3]
    pim.putpalette(flat + [0] * (768 - len(flat)))
    pim.save(path, 'PNG', optimize=True, transparency=bytes(c[3] for c in colors))
    return im.size


def download_set(url_base, out_dir, anims, geometry_from=None):
    """Downloads the WANT animations from url_base. `geometry_from` reuses
    the anchors of the normal sprite (the shiny is the same drawing recolored)."""
    os.makedirs(out_dir, exist_ok=True)
    meta = {}
    for want in WANT:
        src, geom = None, None
        for cand in [want] + FALLBACK[want]:
            src, geom = resolve(anims, cand)
            if geom:
                break
        if not geom:
            continue
        png = fetch(f'{url_base}/{src}-Anim.png')
        if not png:
            continue
        path = os.path.join(out_dir, want + '.png')
        w, h = save_optimized(png, path)
        cols, rows = w // geom['w'], h // geom['h']
        if rows < 1 or cols < 1:
            os.remove(path)
            continue

        ref = geometry_from.get(want) if geometry_from else None
        if ref and ref['w'] == geom['w'] and ref['h'] == geom['h']:
            ax, ay = ref['ax'], ref['ay']
        else:
            sh = fetch(f'{url_base}/{src}-Shadow.png')
            anchor = ground_anchor(sh, geom['w'], geom['h']) if sh else None
            ax, ay = (anchor if anchor else (geom['w'] / 2, geom['h'] * 0.78))
        meta[want] = {'w': geom['w'], 'h': geom['h'], 'n': min(geom['n'], cols), 'r': rows,
                      'd': geom['d'][:cols], 'ax': ax, 'ay': ay}
    return meta


def do_set(job):
    """Downloads one sprite set. job = (key, url tag, shiny url tag or None)."""
    key, tag, stag = job
    cache_file = os.path.join(CACHE, f'{key}.json')
    out_dir = os.path.join(OUT_ASSETS, str(key))
    if os.path.exists(cache_file):
        meta = json.load(open(cache_file, encoding='utf-8'))
        if all(os.path.exists(os.path.join(out_dir, a + '.png')) for a in meta['a']):
            return key, meta

    xml = fetch(f'{BASE}/{tag}/AnimData.xml')
    if not xml:
        return key, None
    anims, shadow = parse_animdata(xml.decode('utf-8', 'replace'))
    normal = download_set(f'{BASE}/{tag}', out_dir, anims)
    if not REQUIRED & set(normal):
        return key, None
    meta = {'s': shadow, 'a': normal}

    if stag:
        sxml = fetch(f'{BASE}/{stag}/AnimData.xml')
        sanims = parse_animdata(sxml.decode('utf-8', 'replace'))[0] if sxml else anims
        shiny = download_set(f'{BASE}/{stag}', os.path.join(out_dir, 's'), sanims, normal)
        if REQUIRED <= set(shiny) or ('Idle' in shiny and 'Walk' in shiny):
            meta['sh'] = 1
            # The shiny geometry is only stored if it differs from the normal one.
            diff = {k: v for k, v in shiny.items() if normal.get(k) != v}
            if diff:
                meta['sa'] = diff
            missing_s = [k for k in normal if k not in shiny]
            if missing_s:
                meta['sm'] = missing_s

    with open(cache_file, 'w', encoding='utf-8') as f:
        json.dump(meta, f, separators=(',', ':'))
    return key, meta


def do_dex(job):
    dex, want_shiny = job
    tag = f'{dex:04d}'
    return do_set((dex, tag, f'{tag}/0000/0001' if want_shiny else None))


def mega_key(dex, name):
    """Asset key of a Mega/Primal form: m6x, m150y, m382..."""
    suffix = name[-1].lower() if re.search(r'_[XY]$', name) else ''
    return f'm{dex}{suffix}'


def mega_jobs(tracker):
    """Mega and Primal forms with the required animations (alternate colors and
    variants like Mega_Z or Shadow_Mega_X left out)."""
    jobs, seen = [], set()
    for tag, e in sorted(tracker.items()):
        if not tag.isdigit():
            continue
        dex = int(tag)
        for fid, sg in sorted(e.get('subgroups', {}).items()):
            name = sg.get('name', '')
            if not re.fullmatch(r'(Mega|Primal)(_[XY])?', name):
                continue
            if not REQUIRED <= set(sg.get('sprite_files', {})):
                continue
            key = mega_key(dex, name)
            if key in seen:
                continue
            seen.add(key)
            s = sg.get('subgroups', {}).get('0001', {})
            stag = f'{tag}/{fid}/0001' if {'Idle', 'Walk'} <= set(s.get('sprite_files', {})) else None
            jobs.append(((key, f'{tag}/{fid}', stag), {'b': dex, 'f': fid, 'n': name}))
    return jobs


# Mega Stone / Orb icons (data/megas.js `stone`), from PokeAPI's item sprites.
ITEM_ICONS = ['key-stone', 'charizardite-x', 'alakazite', 'slowbronite', 'gengarite', 'kangaskhanite',
              'aerodactylite', 'mewtwonite-y', 'steelixite', 'houndoominite', 'tyranitarite',
              'gardevoirite', 'sablenite', 'mawilite', 'medichamite', 'manectite', 'sharpedonite',
              'cameruptite', 'altarianite', 'banettite', 'absolite', 'glalitite', 'latiasite', 'latiosite',
              'blue-orb', 'red-orb', 'meteorite', 'lopunnite', 'lucarionite', 'galladite', 'adamant-orb',
              'skarmorite', 'excadrite', 'scraftinite', 'eelektrossite', 'floettite', 'dragalgite',
              'zygardite', 'diancite', 'drampanite', 'zeraorite', 'tatsugirinite', 'darkranite']
OUT_ITEMS = os.path.join(ROOT, 'public', 'assets', 'items')
OUT_MEGA_META = os.path.join(ROOT, 'src', 'js', 'data', 'sprites-meta-mega.js')


ICON = 16


def icon16(png):
    """Item sprite -> 16×16 PNG, trimmed. The classic ones are 30×30 pixel art with a
    wide margin; the newer ones (Legends Z-A) are 160×160 art, scaled down."""
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    im = im.crop(im.getbbox() or (0, 0, im.width, im.height))
    if max(im.size) > ICON:
        k = ICON / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
        # Hard edges, like the pixel art ones.
        a = im.getchannel('A').point(lambda v: 255 if v >= 110 else 0)
        im.putalpha(a)
    out = Image.new('RGBA', (ICON, ICON))
    out.paste(im, ((ICON - im.width) // 2, (ICON - im.height) // 2))
    buf = io.BytesIO()
    out.save(buf, 'PNG')
    return buf.getvalue()


def fetch_item_icons():
    os.makedirs(OUT_ITEMS, exist_ok=True)
    missing = []
    for slug in ITEM_ICONS:
        path = os.path.join(OUT_ITEMS, slug + '.png')
        if os.path.exists(path):
            continue
        png = fetch(f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/{slug}.png')
        if png:
            save_optimized(icon16(png), path)
        else:
            missing.append(slug)
    if missing:
        print(f'Item icons not found (the game draws its own): {missing}')


def do_megas(tracker):
    jobs = mega_jobs(tracker)
    print(f'{len(jobs)} Mega/Primal forms with sprites ({sum(1 for j, _ in jobs if j[2])} with shiny)')
    metas, missing = {}, []
    with ThreadPoolExecutor(max_workers=16) as ex:
        for (key, meta), (_, extra) in zip(ex.map(do_set, [j for j, _ in jobs]), jobs):
            if meta:
                metas[key] = {**meta, **extra}
            else:
                missing.append(key)
    order = sorted(metas, key=lambda k: (metas[k]['b'], k))
    print('  ' + ' '.join(order))

    lines = [
        '/* ============ sprites-meta-mega.js — GENERATED, do not edit by hand ============',
        ' * Produced by scripts/fetch_sprites.py (Mega and Primal forms from SpriteCollab).',
        ' * Same format as sprites-meta.js, keyed by asset key (assets/pokemon/{key}/),',
        ' * plus  b base Pokédex number · f SpriteCollab form id · n form name.',
        ' */',
        'export const MEGA_META = {',
    ]
    for key in order:
        lines.append(f'  {key}: {json.dumps(metas[key], separators=(",", ":"))},')
    lines += ['};', '']
    with io.open(OUT_MEGA_META, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))
    fetch_item_icons()
    if missing:
        print(f'Failed ({len(missing)}): {missing}')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    lo = int(args[0]) if len(args) > 0 else 1
    hi = int(args[1]) if len(args) > 1 else 1025
    os.makedirs(OUT_ASSETS, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)

    print('Reading SpriteCollab tracker.json...')
    tracker = json.loads(fetch(RAW + '/tracker.json').decode('utf-8'))
    if '--megas' in sys.argv:
        do_megas(tracker)
        return
    jobs = []
    for dex in range(lo, hi + 1):
        e = tracker.get(f'{dex:04d}')
        if not e or not REQUIRED <= set(e.get('sprite_files', {})):
            continue
        s = e.get('subgroups', {}).get('0000', {}).get('subgroups', {}).get('0001', {})
        jobs.append((dex, {'Idle', 'Walk'} <= set(s.get('sprite_files', {}))))
    print(f'{len(jobs)} Pokemon with sprites in {lo}-{hi} ({sum(1 for _, s in jobs if s)} with shiny)')

    metas, missing, done = {}, [], 0
    with ThreadPoolExecutor(max_workers=16) as ex:
        for dex, meta in ex.map(do_dex, jobs):
            done += 1
            if meta:
                metas[dex] = meta
            else:
                missing.append(dex)
            if done % 50 == 0 or done == len(jobs):
                print(f'  {done}/{len(jobs)}', flush=True)

    # Compatibility with old caches: record what the shiny is missing.
    for dex, m in metas.items():
        if m.get('sh') and 'sm' not in m:
            sdir = os.path.join(OUT_ASSETS, str(dex), 's')
            miss = [k for k in m['a'] if not os.path.exists(os.path.join(sdir, k + '.png'))]
            if miss:
                m['sm'] = miss

    # Merge with whatever was already cached outside the requested range.
    for fn in os.listdir(CACHE):
        if not (fn.endswith('.json') and fn[:-5].isdigit()):
            continue  # Mega forms (m6x.json) and other tools' files
        d = int(fn[:-5])
        if d not in metas and os.path.isdir(os.path.join(OUT_ASSETS, str(d))):
            metas[d] = json.load(open(os.path.join(CACHE, fn), encoding='utf-8'))

    lines = [
        '/* ============ sprites-meta.js — GENERATED, do not edit by hand ============',
        ' * Produced by scripts/fetch_sprites.py from the SpriteCollab',
        ' * AnimData.xml files. It is a .js and not a .json because fetch() is',
        ' * blocked on file:// and the game opens with a double click.',
        ' *',
        ' * Per Pokémon:    s ShadowSize · a animations · sh=1 if there is a shiny',
        ' *                 sa shiny geometry that differs from the normal one (rare)',
        ' *                 sm animations the shiny is missing',
        ' * Per animation:  w,h frame · n frames · r rows',
        ' *                 d duration of each frame (1/60 s)',
        ' *                 ax,ay ground anchor inside the frame',
        ' * Filas: 0 Down · 1 DownRight · 2 Right · 3 UpRight',
        ' *        4 Up   · 5 UpLeft    · 6 Left  · 7 DownLeft',
        ' */',
        'export const SPRITE_META = {',
    ]
    for dex in sorted(metas):
        lines.append(f'  {dex}: {json.dumps(metas[dex], separators=(",", ":"))},')
    lines += ['};', '']
    with io.open(OUT_META, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))

    size = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(OUT_ASSETS) for fn in fns)
    print(f'\n{len(metas)} Pokemon ({sum(1 for m in metas.values() if m.get("sh"))} with shiny), {size / 1e6:.1f} MB')
    if missing:
        print(f'Failed ({len(missing)}): {missing}')
    if lo == 1 and hi == 1025:
        do_megas(tracker)


if __name__ == '__main__':
    main()
