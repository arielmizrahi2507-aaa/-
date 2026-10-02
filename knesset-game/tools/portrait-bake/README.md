# portrait-bake: the realistic front portraits

The images in `src/assets/portraits/<id>.<face>.webp` are made by the code in this folder. `build.mjs` embeds them in `index.html` (`PORTRAIT_DATA`),
`21c-portrait-baked.js` loads them and `drawPortrait` (`21-fighter-render.js`) draws them. The painted faces of `21b-portrait-front.js` stay as the fallback
(a browser without WebP, a fighter without a baked face).

Six faces per fighter, because those are the ones the game asks for:

| file | eyes + mouth | size | used for |
| --- | --- | --- | --- |
| `base` | open + smile | 512 | character select, results, ladder, the HUD badge, the head of the drawn (2D) fighter |
| `angry_shout`, `angry_grin` | angry + shout / grin | 512 | the fight intro and the versus screen, the head of the drawn fighter when attacking |
| `hurt_shout`, `hurt_sad`, `ko_sad` | eyes closed + shout / sad | 160 | the HUD badge when hit, low on health, knocked out; the head of the drawn fighter when hit or knocked out |

The drawn (2D) fighters (no WebGL2, `?flat`, the power-saving mode) wear these same pictures as their heads (`Baked.head2d` cuts one along the jaw and rounds it under the chin; `drawBakedHead` in `21-fighter-render.js`), on bodies put together from pictures of the 3D model (`../body-bake/`).

## What the renderer is

A small offline renderer written with numpy / scipy / OpenCV, **not** a photo filter: no pixel of any photo ends up in an image.

- **Geometry**: the 478 face-landmark points measured on the reference photo (rotated to the front, in units of the distance between the eyes, symmetrised, and exaggerated against the
  average of the cast: 1.6 x on the outline, 1.3 x inside, see `KOUT` / `KIN` below) give a height field of the face: the inflated head, the measured relief, the nose, eye sockets, brow ridge, lips, ears.
- **Light and skin** (`rend2.py`): one key light from the upper left, cast shadows, per-channel blur for the light under the skin, a little gloss, red and yellow variation, age spots, bags,
  wrinkles that follow the face, pores. The eyes (iris fibres, lids, lashes), brows (hundreds of single hairs), lips and teeth are painted procedurally. Expressions change the lips,
  lids, brows and the creases.
- **Hair** (`hair3.py`, `hairmodel.py`, `hp.json`): the outline of the head and the hairline are given by hand per person in units of the distance between the eyes (`hp.json`); the strands are made
  by line-integral convolution along a flow field (swept back, radial, falling), with clumps, grey strands, a soft hairline over a scalp layer, thin hair that lets the scalp show, a ragged edge and loose hairs.
- **Beards** (`beard3.py`): a soft shade under the hairs, low-contrast fibres, patchy grey, thin coverage on the cheeks; short beards are thousands of tiny strokes.
- **Clothes, glasses, kippah, earrings** are drawn with the colours of `30-looks.js`; `looks.json` is that data as JSON with a few portrait-only changes (the beard `stub` flag for stubble, thinner glasses frames).

`spec.json` holds the per-person overrides, all optional: the eyes (`eye_open`, `hood` heavy lids, `puff` bags, `iris_k`, `iris_dark`, `sclera`, `lid_shadow`), the brows (`brow`: `k` size, `tilt`, `dy`),
the strength of each group of wrinkles (`wr`: `fore`, `glab`, `crow`, `bag`, `nl`, `mar`, `chin`), marks on the skin (`blotch` red patches, `freckles`, `moles`, `scars`), `tilt` of the head,
the smile (`smile_k`, `smile_teeth`), `hair` (`thin`, `shadow` ...), `beard` (`cheek` where the beard reaches up the cheeks, `off`, `dense`, `curl`) and `stache` (`w`, `h`, `taper`, `droop`, `alpha`).

## The faces of the 3D fighters

The same renderer makes the faces of the 3D heads (`25-f3d-head.js`, `26-f3d-body.js`). `facetex.py` renders the head without glasses, kippah, earring and clothes (those are 3D geometry in the game) and flattens it onto the face space of
the 3D head (a picture projected from the front: lateral +-20 head units, from the height 18.5 down 47 units, 256 x 256, with the eye line at -1 and 12.6 head units per distance between the eyes; the edges fade into the skin tone so
there is no seam at the back of the head). `bake3d.py` writes, per fighter:

| file | what |
| --- | --- |
| `t_rest`, `t_blink`, `t_angry`, `t_shout`, `t_hurt`, `t_ko`, `t_happy` | the face in the poses the fight asks for (eyes + mouth: open+closed, blink+closed, angry+closed, angry+shout, hurt+shout, ko+sad, happy+grin); `state3()` in `21c-portrait-baked.js` maps every pose to one of them |
| `t_relief` | 128 x 128, 8 bit, 128 = flat: the shape of the face (nose, brows, eye sockets, lips, cheeks, chin) without the broad dome of the head, so the skull is pushed out by it |
| `layout.json` (one file) | where the brows, nose, lips, chin, jaw, cheeks and the hairline of each face are, in eye distances below the eye line (`layout()` in `facetex.py`); the 3D head takes its width, the length of the lower face and the heights of its bumps from it |

```
PORTRAIT_DATA=/path/to/data python3 bake3d.py OUTDIR            # all fighters (7 faces + the relief each); python3 layout_only.py OUTDIR  refreshes layout.json only
cp OUTDIR/* ../../src/assets/portraits/ && node ../../build.mjs
```

`KOUT` / `KIN` (default 1.6 / 1.3) are the exaggeration of the outline (jaw, chin, cheeks, forehead) and of the inside of the face (eyes, nose, mouth) against the cast average, used by `bake.py` and `bake3d.py` alike so that the
portraits and the 3D heads show the same face.

## Inputs that are not in the repository

The reference photos are the author's and stay private. The renderer needs three things derived from them, in a folder `data/` (or wherever `PORTRAIT_DATA` points):

- `lm.json`: the 478 landmarks of every face, made by `../face-fit/landmarks.py` (`{ "<fighter id>": [[x, y, z] * 478], ... }`, in photo pixels);
- `front_info.json`: per fighter `{ "asym": <how much the head is turned, -1..1>, "scale": ... }`, from the same landmarks (used by `geom.py` to decide which half of the face is symmetrised into the other);
- `lab_<id>.npy`: a face-parsing label map (BiSeNet, CelebAMask-HQ classes) of the head rotated to the front, on the 1024 px canvas of `rend2.py`; only the ears are read from it, because the outline and the hair come from `hp.json`.

Without them the code is a reference of how the images were made; the images themselves are in `src/assets/portraits`.

## Run

```
pip install numpy scipy opencv-python-headless pillow
PORTRAIT_DATA=/path/to/data python3 bake.py OUTDIR            # all fighters; or: python3 bake.py OUTDIR bibi,gantz
cp OUTDIR/*.webp ../../src/assets/portraits/ && node ../../build.mjs
```

`TUNE='{"spec":0.5,"red":0.6}'` overrides the global look settings (see `T(...)` in `rend2.py`:
`spec` gloss, `red` blood colour, `blue` skin tone, `lkx/lky/lkz` light direction, `nosek` nose relief, `neckw/neckdrop` neck width and where the collar starts ...).
Add a fighter: a row in `looks.json` (colours, hair style, beard, glasses ...; `30-looks.js` is the source), a silhouette in `hp.json`, optional overrides in `spec.json`.
