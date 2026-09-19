---
title: "The Zalgo deployment: Minecraft render subjects"
permalink: /minecraft-zalgo/
layout: page
---

<style>
  .zalgo-mark { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 1.15rem; line-height: 1; }
  .zalgo-roll { font-size: 1.05rem; line-height: 2.6; }
  .zalgo-roll code { font-size: .8rem; opacity: .75; }
  table.zalgo { border-collapse: collapse; width: 100%; font-size: .92rem; }
  table.zalgo th, table.zalgo td { border: 1px solid rgba(128,128,128,.35); padding: .45rem .55rem; vertical-align: top; text-align: left; }
  table.zalgo th { white-space: nowrap; }
  table.zalgo code { white-space: nowrap; font-size: .82rem; }
  .tier { font-variant-numeric: tabular-nums; }
</style>

Every visible thing in Minecraft is either **modelled**, **shaded**, or both — but the
two editions keep those subjects in completely different places, under completely
different names. This page is the registry, and the Zalgo marks are the index:
they tell you what kind of subject you are looking at before you read the row.

The companion page, [the `.minecraft` fileset]({{ '/minecraft-filesets/' | relative_url }}),
does the same for the entries on disk — which of them a renderer ever reads, and
which are just state, backup and cache. A third,
[inside the jar]({{ '/minecraft-jar/' | relative_url }}), covers where the
defaults for every subject below actually ship.

## How to read a mark

The marks are generated, not typed. Two properties are encoded:

| Encoding | Value | Meaning |
| --- | --- | --- |
| Marks **above** the letters | `modeled` | geometry — vertices, bones, cuboids |
| Marks **below** the letters | `shadered` | shading — programs, materials, lighting inputs |
| Marks **above and below** | `both` | resolves geometry *and* shading in one subject |
| **Light** density (1 mark) | tier 1 | a plain asset file you can open and grep |
| **Medium** density (2 marks) | tier 2 | engine-side config resolved at runtime |
| **Heavy** density (4 marks) | tier 3 | compiled or code-only — not authorable from a pack |

So a name crowned with accents is a model; a name dragging tails is a shader; a
name doing both is a controller. The heavier it looks, the less of it you can
reach from a resource pack.

{% assign editions = "java,pocket" | split: "," %}
{% assign classes = "modeled,both,shadered" | split: "," %}

{% for edition in editions %}
{% if edition == "java" %}
## Java Edition
Renderer: vanilla OpenGL core profile, optionally displaced by an Iris/OptiFine
deferred pipeline. Geometry is JSON for blocks and items, hard-coded for entities.
{% else %}
## Pocket Edition (Bedrock)
Renderer: RenderDragon. Geometry is JSON all the way down — entities included —
but the shading side is compiled and closed, so packs author *inputs* to shading
rather than shading itself.
{% endif %}

{% assign rows = site.subjects | sort: "seq" | where: "edition", edition %}
<table class="zalgo">
  <thead>
    <tr><th>Mark</th><th class="tier">Seq</th><th>Subject</th><th>Class</th><th class="tier">Tier</th><th>Where it lives</th><th>The tell</th></tr>
  </thead>
  <tbody>
  {% for class in classes %}
    {% assign group = rows | where: "render_class", class %}
    {% for s in group %}
      {% assign m = site.data.zalgo_marks[s.sid] %}
    <tr id="{{ s.sid }}">
      <td class="zalgo-mark" aria-hidden="true" title="{{ s.render_class }}, tier {{ s.tier }}">{{ m.sigil }}</td>
      <td class="tier"><code>{{ s.seq }}</code></td>
      <td><a href="{{ s.url | relative_url }}"><strong>{{ s.title | escape }}</strong></a><br><small>{{ s.stack | escape }}</small></td>
      <td>{{ s.render_class }}</td>
      <td class="tier">{{ s.tier }}</td>
      <td><code>{{ s.where | escape }}</code></td>
      <td>{{ s.content | strip_html | strip_newlines | strip }}</td>
    </tr>
    {% endfor %}
  {% endfor %}
  </tbody>
</table>
{% endfor %}

## Roll call

The same registry with the marks applied to the names themselves — this is the
view to skim when you want to spot a class at a glance rather than read a table.

{% assign roll = site.subjects | sort: "seq" %}
<ul class="zalgo-roll">
{% for s in roll %}
  <li><a href="{{ s.url | relative_url }}"><span aria-hidden="true">{{ site.data.zalgo_marks[s.sid].name }}</span></a>
      <code>{{ s.seq }}</code> <code>{{ s.sid }}</code> — {{ s.title | escape }} ({{ s.render_class }}, tier {{ s.tier }})</li>
{% endfor %}
</ul>

## Same subject, different edition

The pairs that cause the most confusion when a model or a shader is ported
between editions:

| Subject | Java Edition | Pocket Edition |
| --- | --- | --- |
| Entity geometry | hard-coded `ModelPart` in client code ([je-entity-model]({{ '/subjects/je-entity-model/' | relative_url }})) | `models/entity/*.geo.json` ([pe-geometry]({{ '/subjects/pe-geometry/' | relative_url }})) |
| Block geometry | `models/block/*.json` + blockstates ([je-block-model]({{ '/subjects/je-block-model/' | relative_url }})) | `minecraft:geometry` component ([pe-block-geometry]({{ '/subjects/pe-block-geometry/' | relative_url }})) |
| Choosing model + texture at runtime | blockstate variants / code ([je-blockstate]({{ '/subjects/je-blockstate/' | relative_url }})) | render controllers ([pe-render-controller]({{ '/subjects/pe-render-controller/' | relative_url }})) |
| Held-item rendering | item model `display` transforms ([je-item-model]({{ '/subjects/je-item-model/' | relative_url }})) | attachables ([pe-attachable]({{ '/subjects/pe-attachable/' | relative_url }})) |
| Shader programs | `shaders/core/*.vsh`/`.fsh`, editable ([je-core-shader]({{ '/subjects/je-core-shader/' | relative_url }})) | `*.material.bin`, compiled and closed ([pe-material]({{ '/subjects/pe-material/' | relative_url }})) |
| Screen effects | post chains ([je-post-chain]({{ '/subjects/je-post-chain/' | relative_url }})) | no pack-side equivalent — closest is [pe-fog]({{ '/subjects/pe-fog/' | relative_url }}) |
| Per-surface shading data | baked into the atlas + lightmap ([je-texture-atlas]({{ '/subjects/je-texture-atlas/' | relative_url }})) | texture sets with `_mer`/normal maps ([pe-texture-set]({{ '/subjects/pe-texture-set/' | relative_url }})) |

The asymmetry is the point: on Java the shading side is the open half and the
entity models are the closed half; on Bedrock it is exactly reversed.

## Regenerating

Each subject is its own file in `_subjects/`, named `<seq>-<id>.md`, and each one
publishes as its own page. The sequence is two fixed-width letters — `aa`, `ab`,
… `az`, `ba` — so lexical order and append order never diverge and a new subject
never renumbers an existing one:

```sh
python3 tools/zalgoize.py --next   # -> _subjects/ax-<id>.md
```

The front matter carries the fields and the body carries the tell. Note the two
renamed keys: a Jekyll collection document already owns `id`, and `class` is taken
on every Liquid drop, so the files use `sid` and `render_class`.

The marks in
`_data/zalgo_marks.yml` are generated and seeded from each subject's `id`, so
they are stable across runs and the diff stays empty unless the registry changed.
The same generator also marks the
[`.minecraft` fileset]({{ '/minecraft-filesets/' | relative_url }}), with its own
direction map:

```sh
python3 tools/zalgoize.py          # rewrite both mark files
python3 tools/zalgoize.py --check  # fail if either is stale
```

Add a subject by appending to the registry with an `id`, a `class`
(`modeled` / `shadered` / `both`) and a `tier` (1–3); the mark, the table row and
the roll-call entry all follow from that.
