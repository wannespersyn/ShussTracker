# Camera model — dataset

Van de camera-beta naar een trainingsset voor een dop-detector (één klasse: `dop`).

## 1. Exporteren (op je Mac)

```bash
npx tsx scripts/camera-model/export-dataset.ts camera-dataset
```

Leest `DATABASE_URL` uit `.env` en schrijft:

- `camera-dataset/images/` — één top-down foto per worp (824 × 265 uit Blob, anders de kleine 412 × 133)
- `camera-dataset/frames.json` — per foto alle doppen op het veld (mat-eenheden), de ronde, en `verified`
- `camera-dataset/label-studio-tasks.json` — dezelfde foto's met de doppen als voorlabel

**Nieuwe worpen (vanaf migratie 0028)** bewaren de hele mat (`field`). Een ✓ of correctie op de camera of een meekijk-gsm maakt die foto meteen `verified`: geen Label Studio nodig.

**Oudere worpen: volledige mat per foto.** Een worp bewaart enkel wat veranderde (`spots`, `gone`). Het script bouwt de mat per ronde op: leeg beginnen, `spots` erbij, de dichtste dop bij elke `gone` eraf. De posities komen altijd van de camera (tikken op de foto zijn precies). Een `label` uit de mat-logger is enkel een controle: in de logger tik je ongeveer in het vak, dus elke logger-dop moet een camera-dop binnen 70 eenheden hebben (`agree`), anders `mismatch` → eerst nakijken. Rondes komen uit de mat-logger (`camera_game`); zonder logger telt een pauze van 45 s als nieuwe ronde.

**`verified`** = een mens heeft de hele mat gezien: elke worp van die ronde tot nu ✓ of gecorrigeerd op een camerascherm, of een bevestigd logger-label dat overeenkomt met de camera.

## 2. Nakijken in Label Studio

```bash
pip install label-studio
LABEL_STUDIO_LOCAL_FILES_SERVING_ENABLED=true \
LABEL_STUDIO_LOCAL_FILES_DOCUMENT_ROOT="$PWD/camera-dataset" \
label-studio start
```

1. Nieuw project → *Labeling Setup* → *Custom template*:
   ```xml
   <View>
     <Image name="image" value="$image" zoom="true"/>
     <RectangleLabels name="label" toName="image">
       <Label value="dop" background="#5FB7FF"/>
     </RectangleLabels>
   </View>
   ```
2. *Settings → Cloud Storage → Add Source Storage → Local files*, absolute path: `…/camera-dataset/images` (niet synchroniseren).
3. *Import* → `label-studio-tasks.json`. Elke foto komt binnen met de doppen al aangeduid.
4. Sorteer op `verified` en kijk eerst de onverifieerde na: doppen verschuiven, bijtekenen, wissen. **Doppen in de shooting boxes niet aanduiden** (die worden weggemaskeerd). Submit = nagekeken.
5. *Export* → JSON → bv. `label-studio-export.json`.

## 3. YOLO-set maken

```bash
pip install pillow
python3 scripts/camera-model/prepare.py camera-dataset --ls-export label-studio-export.json --out camera-yolo
```

- Wat je in Label Studio submitte, vervangt het voorlabel en telt als verified.
- De 4 shooting boxes worden zwart geschilderd.
- **Test** = de verified foto's van een of meer sessies die nooit in train/val zitten (±20 %). Zo meet je op een avond die het model nog niet zag.
- Onverifieerde voorlabels gaan enkel mee met `--include-unverified` (ze bevatten de fouten van de huidige detector).

Resultaat: `camera-yolo/data.yaml` + `images/` en `labels/` per split, klaar voor een YOLO-trainer.

> Licentie: Ultralytics (YOLOv8/11) is AGPL-3.0. Prima om te testen; voor gebruik in Shussapp een Apache-2.0-alternatief kiezen of een licentie nemen.

`camera-dataset/` en `camera-yolo/` staan in `.gitignore` (foto's van crews horen niet in git).
