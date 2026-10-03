# body-bake: the sprite parts of the drawn (2D) fighters

Without WebGL2 (`?flat`, an old phone, a browser that blocks it) and in the power-saving mode that turns the 3D figures off, the fighters are drawn on the 2D canvas.
They are not drawn with thick cartoon outlines any more: `21d-parts2d.js` puts them together from pictures of the parts of the 3D model, baked offline with the very same 3D shader,
and uses the realistic portrait of the person as the head (`drawBakedHead`, `Baked.head2d` in `21c-portrait-baked.js`). So a drawn fight shows the same jacket, trousers, shoes and face as the 3D one.

| part | what | anchor (the joint) |
| --- | --- | --- |
| `torso` | the jacket with its lapels, shirt, tie, buttons and the neck, upright | the hips (`S.O`) |
| `uarm` | the sleeve from the shoulder to the elbow | the shoulder |
| `farm` | the sleeve from the elbow to the wrist, the cuff and the fist | the elbow |
| `thigh`, `shin` | the trousers from the hip to the knee and from the knee to the ankle | the hip, the knee |
| `shoe` | the shoe, seen from the side | the ankle |

Each part is rendered straight and hanging down by `F3D.bakePart(look, part, pxu)` (`26-f3d-body.js`): the same meshes as in the fight (`emitBody` with `opt.only`), lit by the neutral stage light,
4 pixels per rig unit (`PXU`), with a transparent background. In the fight `Parts.draw` takes the skeleton the 3D figure uses (`skeleton3D`: shoulders, elbows, wrists, hips, knees, ankles, the head),
turns every part to run from its joint to the next one, stretches it to the length of the bone, and puts the portrait on top of the neck. The far arm and leg are drawn a little darker.
A hit flash and the ghost tint are applied on a scratch copy of the picture.
The neck of the torso goes on up behind the chin in the baked picture (`S.bake`), because the head of the drawn fight is a front view that does not have the 3D head's neck joint.

A fighter without baked parts (the boss robot, the minions) keeps the cartoon body.

## Run

```
node bake-parts.mjs ../../index.html OUTDIR            # all fighters, all parts: OUTDIR/<id>.<part>.png + meta.json
PARTS=torso node bake-parts.mjs ../../index.html OUTDIR bibi,gantz   # only some parts / fighters (meta.json keeps the rest)
python3 pack.py OUTDIR ../../src/assets/parts            # WebP, 126 parts (PXU=4 pixels per rig unit by default)
node ../../build.mjs                                     # embeds them (PARTS_DATA, PARTS_META)
```

Needs Playwright and a Chromium with WebGL2 (a software one such as SwiftShader is fine; `PW_MODULES`, `CHROME` point to them) and the built `index.html`
(the baked portraits are needed too, because the skin of the neck and the hands is taken from the realistic face).
Bake the parts again after any change of the 3D body (`26-f3d-body.js`), of the looks (`30-looks.js`) or of the faces.
