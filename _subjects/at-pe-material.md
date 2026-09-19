---
seq: at
sid: pe-material
title: RenderDragon material
edition: pocket
render_class: shadered
tier: 3
stack: Bedrock RenderDragon
where: renderer/materials/*.material.bin
permalink: /subjects/pe-material/
layout: subject
---

A compiled blob keyed by pass name (entity_alphatest, sky, blocks) holding per-platform HLSL/GLSL/MSL variants. Retail clients do not load overrides of these, which is why "Bedrock shaders" are really texture tricks.
