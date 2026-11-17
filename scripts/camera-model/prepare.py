"""
Camera dataset → YOLO training set

Turns the export of scripts/camera-model/export-dataset.ts (frames.json +
images/) into a YOLO-format dataset for a one-class cap detector ("dop"):

- Reviewed boxes from a Label Studio export (optional) replace the
  pre-labels and make that picture verified.
- The 4 shooting boxes are painted over: caps waiting there are never
  labelled, so the model must not learn to ignore (or find) them there.
- Split per camera session, so test pictures come from an evening the
  model never saw: test = verified pictures of the held-out session(s)
  (about TEST_SHARE of all verified), val = a slice of the rest, train =
  the remainder. Unverified pre-labels only go to train with
  --include-unverified (they carry the old detector's mistakes).

Usage:
  python3 scripts/camera-model/prepare.py camera-dataset \
      [--ls-export label-studio-export.json] [--include-unverified] [--out camera-yolo]
Needs: Pillow (pip install pillow).
Writes: <out>/images/{train,val,test}, <out>/labels/{train,val,test}, <out>/data.yaml, <out>/split.json
"""

import argparse
import json
import random
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

TEST_SHARE = 0.2
VAL_SHARE = 0.15
# Paint for the shooting boxes: the dark of the field.
MASK_RGB = (18, 18, 18)


def ls_boxes(export_path: Path) -> dict:
    """Label Studio JSON export → {file: [(cx, cy) in % of the picture]} for reviewed tasks."""
    out = {}
    for task in json.loads(export_path.read_text()):
        anns = [a for a in task.get("annotations", []) if not a.get("was_cancelled")]
        if not anns:
            continue
        ann = max(anns, key=lambda a: a.get("updated_at") or a.get("created_at") or "")
        file = task["data"].get("file") or Path(task["data"]["image"]).name
        boxes = []
        for r in ann.get("result", []):
            if r.get("type") != "rectanglelabels":
                continue
            v = r["value"]
            boxes.append((v["x"] + v["width"] / 2, v["y"] + v["height"] / 2, v["width"], v["height"]))
        out[file] = boxes
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("dataset", type=Path)
    ap.add_argument("--ls-export", type=Path)
    ap.add_argument("--include-unverified", action="store_true")
    ap.add_argument("--out", type=Path, default=Path("camera-yolo"))
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()

    data = json.loads((a.dataset / "frames.json").read_text())
    meta, frames = data["meta"], data["frames"]
    mw, mh, cap = meta["matUnits"]["w"], meta["matUnits"]["h"], meta["capDiameter"]

    # Boxes per picture, as YOLO (cx, cy, w, h) in 0–1.
    reviewed = ls_boxes(a.ls_export) if a.ls_export else {}
    for f in frames:
        if f["file"] in reviewed:
            f["boxes"] = [(x / 100, y / 100, w / 100, h / 100) for x, y, w, h in reviewed[f["file"]]]
            f["verified"] = True
        else:
            f["boxes"] = [(c["x"] / mw, c["y"] / mh, cap / mw, cap / mh) for c in f["caps"]]

    # Hold out whole sessions for the test set, smallest first, until ~TEST_SHARE of the verified pictures.
    verified = [f for f in frames if f["verified"]]
    per_session: dict = {}
    for f in verified:
        per_session[f["session"]] = per_session.get(f["session"], 0) + 1
    target = max(1, round(len(verified) * TEST_SHARE))
    test_sessions, n = set(), 0
    for s, k in sorted(per_session.items(), key=lambda x: x[1]):
        if n >= target:
            break
        test_sessions.add(s)
        n += k
    if len(test_sessions) == len(per_session) and len(per_session) > 1:
        test_sessions.pop()  # keep at least one session to train on

    rng = random.Random(a.seed)
    split = {"train": [], "val": [], "test": []}
    rest = []
    for f in frames:
        if f["session"] in test_sessions:
            if f["verified"]:
                split["test"].append(f)
        elif f["verified"] or a.include_unverified:
            rest.append(f)
    rng.shuffle(rest)
    n_val = round(len(rest) * VAL_SHARE)
    split["val"], split["train"] = rest[:n_val], rest[n_val:]

    if a.out.exists():
        shutil.rmtree(a.out)
    for part, items in split.items():
        (a.out / "images" / part).mkdir(parents=True)
        (a.out / "labels" / part).mkdir(parents=True)
        for f in items:
            img = Image.open(a.dataset / "images" / f["file"]).convert("RGB")
            sx, sy = img.width / mw, img.height / mh
            draw = ImageDraw.Draw(img)
            for box in meta["shootingBoxes"]:
                draw.polygon([(x * sx, y * sy) for x, y in box], fill=MASK_RGB)
            img.save(a.out / "images" / part / f["file"], quality=95)
            lines = [f"0 {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}" for cx, cy, w, h in f["boxes"]]
            (a.out / "labels" / part / f["file"].replace(".jpg", ".txt")).write_text("\n".join(lines) + ("\n" if lines else ""))

    (a.out / "data.yaml").write_text(
        f"path: {a.out.resolve()}\ntrain: images/train\nval: images/val\ntest: images/test\nnames:\n  0: dop\n"
    )
    (a.out / "split.json").write_text(
        json.dumps({k: [f["file"] for f in v] for k, v in split.items()} | {"testSessions": sorted(test_sessions)}, indent=1)
    )
    print(
        f"train {len(split['train'])} · val {len(split['val'])} · test {len(split['test'])} "
        f"(test = {len(test_sessions)} held-out session(s); {len(reviewed)} reviewed in Label Studio)"
    )
    if not a.include_unverified:
        skipped = sum(1 for f in frames if not f["verified"] and f["session"] not in test_sessions)
        print(f"{skipped} unverified pictures left out — review them in Label Studio, or pass --include-unverified")


if __name__ == "__main__":
    main()
