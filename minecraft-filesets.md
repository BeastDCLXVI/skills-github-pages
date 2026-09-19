---
title: "The Zalgo deployment: .minecraft filesets"
permalink: /minecraft-filesets/
layout: page
---

<style>
  .zalgo-mark { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 1.15rem; line-height: 1; }
  .zalgo-roll { font-size: 1.05rem; line-height: 2.6; list-style: none; padding-left: 0; }
  .zalgo-roll code { font-size: .8rem; opacity: .75; }
  table.zalgo { border-collapse: collapse; width: 100%; font-size: .92rem; }
  table.zalgo th, table.zalgo td { border: 1px solid rgba(128,128,128,.35); padding: .45rem .55rem; vertical-align: top; text-align: left; }
  table.zalgo th { white-space: nowrap; }
  table.zalgo code { font-size: .82rem; }
  .tier { font-variant-numeric: tabular-nums; }
  .status { font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
  .status-legacy { opacity: .7; }
  .status-unverified { font-weight: 700; }
</style>

The companion registry to the [render subjects]({{ '/minecraft-zalgo/' | relative_url }}):
the entries on disk, in the order of the source sprite listing, one row per
sprite. The sprites already sorted them into **file**, **directory** and
**archive** — the marks carry that same split, plus how much of the entry is
yours to touch.

## How to read a mark

| Encoding | Value | Meaning |
| --- | --- | --- |
| Marks **above** the letters | `directory` | a container of other entries |
| Marks **below** the letters | `file` | a leaf |
| Marks **above and below** | `archive` | a container that is also a leaf |
| **Light** density (1 mark) | tier 1 | open it in an editor and it makes sense |
| **Medium** density (2 marks) | tier 2 | structured binary — NBT, PNG — needs a tool |
| **Heavy** density (4 marks) | tier 3 | machine-owned: generated, locked, cached or rotated |

Same spine as the subject page: **direction is what it is, density is how far
you can reach into it.** A heavily marked row is one the client owns; editing
it by hand is how worlds get corrupted.

`status` is separate from tier. `legacy` means the entry belongs to an older
layout and current clients no longer write it; `unverified` means it came
through in the source listing but is not confirmed here, and is carried rather
than guessed at.

## The fileset

{% assign entries = site.data.minecraft_filesets.entries %}
<table class="zalgo">
  <thead>
    <tr><th>Mark</th><th>Entry</th><th>Kind</th><th class="tier">Tier</th><th>Status</th><th>What it is</th><th>Feeds</th></tr>
  </thead>
  <tbody>
  {% for e in entries %}
    {% assign m = site.data.zalgo_filesets[e.id] %}
    <tr id="{{ e.id }}">
      <td class="zalgo-mark" aria-hidden="true" title="{{ e.kind }}, tier {{ e.tier }}">{{ m.sigil }}</td>
      <td><code>{{ e.name | escape }}</code><br><small>{{ e.location | escape }}</small></td>
      <td>{{ e.kind }}</td>
      <td class="tier">{{ e.tier }}</td>
      <td class="status status-{{ e.status }}">{{ e.status }}</td>
      <td>{{ e.tell | escape }}</td>
      <td>
        {% if e.see %}
          {% for sid in e.see %}<a href="{{ '/minecraft-zalgo/' | relative_url }}#{{ sid }}"><code>{{ sid }}</code></a>{% unless forloop.last %}<br>{% endunless %}{% endfor %}
        {% else %}—{% endif %}
      </td>
    </tr>
  {% endfor %}
  </tbody>
</table>

## Roll call

The copy with the marks on the names themselves, grouped by sprite kind. This
is the view for spotting a kind at a glance rather than reading a table.

{% assign kinds = "directory,archive,file" | split: "," %}
{% for kind in kinds %}
{% assign group = entries | where: "kind", kind %}

**{{ kind }}** ({{ group | size }})

<ul class="zalgo-roll">
{% for e in group %}
  <li><span aria-hidden="true">{{ site.data.zalgo_filesets[e.id].name }}</span>
      <code>{{ e.id }}</code> — tier {{ e.tier }}, {{ e.status }}</li>
{% endfor %}
</ul>
{% endfor %}

## Where the renderer actually reads from

Of the whole fileset, only a handful of entries reach the render path. The rest
is state, backup and cache:

{% assign feeding = entries | where_exp: "e", "e.see" %}

| Entry | Feeds |
| --- | --- |
{% for e in feeding %}| [`{{ e.name }}`](#{{ e.id }}) | {% for sid in e.see %}[`{{ sid }}`]({{ '/minecraft-zalgo/' | relative_url }}#{{ sid }}){% unless forloop.last %}, {% endunless %}{% endfor %} |
{% endfor %}

Note the shape of that list: every entry feeding the renderer is either a pack
folder or an atlas dump. Nothing in `.minecraft` holds geometry or a shader
program of its own — the game ships those inside the jar, and a pack folder is
the only door in. That is the same asymmetry the subject page ends on, seen
from the filesystem instead of the renderer.

## Regenerating

Both registries share one generator, each with its own direction map:

```sh
python3 tools/zalgoize.py          # rewrite _data/zalgo_marks.yml and _data/zalgo_filesets.yml
python3 tools/zalgoize.py --check  # fail if either committed mark file is stale
```

Marks are seeded from each entry's `id`, so adding a row here never reshuffles
the marks on any other row, in either registry.
