---
title: "The Zalgo deployment: inside the jar"
permalink: /minecraft-jar/
layout: page
---

<style>
  .zalgo-mark { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 1.15rem; line-height: 1; }
  table.zalgo { border-collapse: collapse; width: 100%; font-size: .92rem; }
  table.zalgo th, table.zalgo td { border: 1px solid rgba(128,128,128,.35); padding: .45rem .55rem; vertical-align: top; text-align: left; }
  table.zalgo th { white-space: nowrap; }
  table.zalgo code { font-size: .82rem; }
  .tier { font-variant-numeric: tabular-nums; }
  .node { white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
</style>

The [fileset]({{ '/minecraft-filesets/' | relative_url }}) ends on a gap: nothing
in `.minecraft` holds geometry or a shader program of its own. This is where they
are — and the jar lands inside `.minecraft` too, at
`versions/<version>/<version>.jar`, a path the source sprite listing did not
cover.

Same marking as the fileset, because it is the same question: 📁 above, 📄 below,
📦 both, and density for how far in you can reach. The jar is a resource pack —
the lowest one in the stack — so everything under `assets/` is laid out exactly
as a pack in `resourcepacks/` lays itself out.

## The tree

{% assign nodes = site.data.minecraft_jar.entries | sort: "seq" %}
<table class="zalgo">
  <thead>
    <tr><th class="tier">Seq</th><th>Mark</th><th>Entry</th><th class="tier">Tier</th><th>What it is</th><th>Supplies</th></tr>
  </thead>
  <tbody>
  {% for e in nodes %}
    {% assign m = site.data.zalgo_jar[e.id] %}
    {% if e.kind == "directory" %}{% assign icon = "📁" %}{% elsif e.kind == "archive" %}{% assign icon = "📦" %}{% else %}{% assign icon = "📄" %}{% endif %}
    <tr id="{{ e.id }}">
      <td class="tier"><code>{{ e.seq }}</code></td>
      <td class="zalgo-mark" aria-hidden="true" title="{{ e.kind }}, tier {{ e.tier }}">{{ m.sigil }}</td>
      <td class="node" style="padding-left: {{ e.depth | times: 1.3 | plus: 0.55 }}rem">
        <span aria-hidden="true">{{ icon }}</span> <code>{{ e.name | escape }}</code>
        <br><small>{{ e.kind }}</small>
      </td>
      <td class="tier">{{ e.tier }}</td>
      <td>{{ e.tell | escape }}</td>
      <td>
        {% if e.see %}
          {% for sid in e.see %}<a href="{{ '/subjects/' | append: sid | append: '/' | relative_url }}"><code>{{ sid }}</code></a>{% unless forloop.last %}<br>{% endunless %}{% endfor %}
        {% else %}—{% endif %}
      </td>
    </tr>
  {% endfor %}
  </tbody>
</table>

## What the jar supplies

{% assign supplying = nodes | where_exp: "e", "e.see" %}

Of {{ nodes | size }} entries, {{ supplying | size }} reach the renderer — and
between them they account for every render subject that has a file at all:

| Entry | Supplies |
| --- | --- |
{% for e in supplying %}| [`{{ e.name }}`](#{{ e.id }}) | {% for sid in e.see %}[`{{ sid }}`]({{ '/subjects/' | append: sid | append: '/' | relative_url }}){% unless forloop.last %}, {% endunless %}{% endfor %} |
{% endfor %}

The one that is not a directory of JSON is
[`net/minecraft/`](#jar-classes): entity models, block entity renderers, render
types and the lightmap live there as bytecode. That single row is the whole
reason those subjects are tier 3 — there is no file to open, so a pack can
retexture them but never reshape them.

## Two things that are not in the jar

**Sounds and the other languages.** `sounds.json` and `lang/en_us.json` ship
here, but the `.ogg` files and every other locale are downloaded into
`.minecraft/assets/` as hash-named objects and resolved through an index. The
jar is smaller than the game's assets, and neither path appears in the source
sprite listing.

**Bedrock's equivalent.** Pocket Edition has no jar. Its defaults ship inside
the application package as ordinary folders — `data/resource_packs/vanilla/…` —
which is why Bedrock entity geometry is readable JSON on disk while its
materials, in the same package, are compiled `.material.bin`. Java hides the
models and exposes the shaders; Bedrock does the reverse. Both asymmetries are
visible as mark density on the [subject registry]({{ '/minecraft-zalgo/' | relative_url }}).

## Regenerating

All three registries share one generator and one sequence scheme — two
fixed-width letters, dense, per registry:

```sh
python3 tools/zalgoize.py          # rewrite all three mark files
python3 tools/zalgoize.py --check  # fail if any is stale
python3 tools/zalgoize.py --next   # the next free letters in each registry
```
