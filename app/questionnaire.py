"""Questionnaire definition, validation and status rules (thresholds: see README)."""
import math



# Status: 0 = stable, 1 = attention, 2 = critical.  Bands are [lo, hi) ; None = open end.
# Thresholds are prototype values based on general clinical ranges and spaceflight
# practice (e.g. NASA radiation limits). They MUST be reviewed by a flight surgeon
# before operational use. The result is a preliminary assessment, not a diagnosis.
def N(key, cat, label, unit, mn, mx, step, norm, bands):
    return dict(key=key, cat=cat, label=label, type="num", unit=unit, min=mn, max=mx,
                step=step, norm=norm, bands=bands, req=True)


def C(key, cat, label, *opts):
    return dict(key=key, cat=cat, label=label, type="choice", unit="", req=True,
                options=[dict(value=str(i), label=l, status=s) for i, (l, s) in enumerate(opts)])


PAIN = [(None, 4, 0), (4, 7, 1), (7, None, 2)]
BONE = [(None, 3, 0), (3, 6, 1), (6, None, 2)]
GOOD = [(None, 4, 2), (4, 6, 1), (6, None, 0)]      # higher is better (1-10)
LOAD = [(None, 5, 0), (5, 8, 1), (8, None, 2)]      # lower is better (0-10)

CATS = [("cardio", "Cardiovascular health"), ("immune", "Immune system"),
        ("musculo", "Bone and muscle health"), ("psych", "Psychological health"),
        ("sleep", "Sleep quality and duration"), ("radiation", "Radiation monitoring"),
        ("general", "General well-being and other complaints")]

FIELDS = [
    N("hr_rest", "cardio", "Resting heart rate", "bpm", 30, 220, 1, "50–90", [(None, 40, 2), (40, 50, 1), (50, 91, 0), (91, 111, 1), (111, None, 2)]),
    N("bp_sys", "cardio", "Systolic blood pressure", "mmHg", 60, 260, 1, "100–129", [(None, 90, 2), (90, 100, 1), (100, 130, 0), (130, 160, 1), (160, None, 2)]),
    N("bp_dia", "cardio", "Diastolic blood pressure", "mmHg", 30, 160, 1, "60–84", [(None, 50, 2), (50, 60, 1), (60, 85, 0), (85, 100, 1), (100, None, 2)]),
    N("spo2", "cardio", "Blood oxygen saturation (SpO₂)", "%", 70, 100, 1, "≥ 95", [(None, 92, 2), (92, 95, 1), (95, None, 0)]),
    C("palpitations", "cardio", "Palpitations, irregular heartbeat, or chest pain",
      ("None", 0), ("Rare and brief", 1), ("Frequent, chest pain, or loss of consciousness", 2)),
    C("head_fullness", "cardio", "Head pressure or dizziness when changing position",
      ("None", 0), ("Mild", 1), ("Severe or vision darkening", 2)),

    N("temp", "immune", "Body temperature", "°C", 33, 43, 0.1, "36.0–37.5", [(None, 35.5, 2), (35.5, 36.0, 1), (36.0, 37.6, 0), (37.6, 38.0, 1), (38.0, None, 2)]),
    C("infection", "immune", "Signs of infection (runny nose, cough, sore throat)",
      ("None", 0), ("Mild cold symptoms", 1), ("High fever with cough, shortness of breath, or pain", 2)),
    C("skin", "immune", "Skin: rash, irritation, or wounds",
      ("No changes", 0), ("Mild irritation or rash", 1), ("Spreading rash, swelling, or a wound that is not healing", 2)),

    N("exercise_min", "musculo", "Exercise in the past 24 hours", "min", 0, 600, 1, "≥ 60", [(None, 60, 1), (60, None, 0)]),
    N("back_pain", "musculo", "Back pain (0 = none, 10 = unbearable)", "score", 0, 10, 1, "0–3", PAIN),
    N("bone_pain", "musculo", "Bone and joint pain (0–10)", "score", 0, 10, 1, "0–2", BONE),
    N("muscle_weak", "musculo", "Muscle weakness or fatigue (0–10)", "score", 0, 10, 1, "0–3", PAIN),
    C("injury", "musculo", "Injuries",
      ("None", 0), ("Minor strain or bruise", 1), ("Suspected fracture or dislocation", 2)),

    N("mood", "psych", "Mood (1 = very poor, 10 = excellent)", "score", 1, 10, 1, "6–10", GOOD),
    N("stress", "psych", "Stress level (0–10)", "score", 0, 10, 1, "0–4", LOAD),
    N("anxiety", "psych", "Anxiety (0–10)", "score", 0, 10, 1, "0–4", LOAD),
    N("isolation", "psych", "Feelings of isolation or loneliness (0–10)", "score", 0, 10, 1, "0–4", LOAD),
    N("focus", "psych", "Focus (1 = very poor, 10 = excellent)", "score", 1, 10, 1, "6–10", GOOD),
    C("self_harm", "psych", "Have you had thoughts of harming yourself?", ("No", 0), ("Yes", 2)),

    N("sleep_hours", "sleep", "Sleep duration", "h", 0, 24, 0.5, "6–9", [(None, 5, 2), (5, 6, 1), (6, 9.01, 0), (9.01, 10.01, 1), (10.01, None, 2)]),
    N("sleep_quality", "sleep", "Sleep quality (1 = very poor, 10 = excellent)", "score", 1, 10, 1, "6–10", [(None, 6, 1), (6, None, 0)]),
    N("awakenings", "sleep", "Number of nighttime awakenings", "times", 0, 20, 1, "0–3", [(None, 4, 0), (4, None, 1)]),
    C("sleep_aid", "sleep", "Sleep medication or aids",
      ("None", 0), ("Occasionally", 1), ("Regularly", 1)),

    N("dose_day", "radiation", "Personal dosimeter dose in the past 24 hours", "µSv", 0, 100000, 1, "< 1000", [(None, 1000, 0), (1000, 3000, 1), (3000, None, 2)]),
    N("dose_30d", "radiation", "Cumulative dose over the past 30 days", "mSv", 0, 2000, 0.1, "< 100 (NASA limit: 250)", [(None, 100, 0), (100, 200, 1), (200, None, 2)]),
    C("spe_alert", "radiation", "Solar particle event (SPE) alert today",
      ("None", 0), ("Alert issued; no protective measures needed", 1), ("Shelter or protective measures used", 2)),
    C("phosphenes", "radiation", "Flashes of light in your vision (phosphenes)",
      ("None", 0), ("Rare", 0), ("Frequent", 1)),

    N("wellbeing", "general", "Overall well-being (1 = very poor, 10 = excellent)", "score", 1, 10, 1, "6–10", GOOD),
    N("headache", "general", "Headache (0–10)", "score", 0, 10, 1, "0–3", PAIN),
    C("nausea", "general", "Nausea or motion sickness",
      ("None", 0), ("Mild", 1), ("Severe, with vomiting", 2)),
    C("appetite", "general", "Appetite", ("Normal", 0), ("Reduced", 1), ("None", 1)),
    C("vision", "general", "Vision",
      ("No changes", 0), ("Mild blurring or difficulty focusing", 1), ("Sudden decline or loss of vision", 2)),
    dict(key="complaints", cat="general", label="Additional complaints (free text)", type="text",
         unit="", req=False, hint="Optional. Not automatically assessed."),
]
FBY = {f["key"]: f for f in FIELDS}
SOS_REASONS = ["Medical issue", "Injury", "Radiation hazard", "Psychological support",
               "Habitat or equipment issue", "Other"]
SOS_STATUSES = ("new", "in_progress", "done")


def public_schema():
    cats = []
    for cid, title in CATS:
        fs = []
        for f in FIELDS:
            if f["cat"] != cid:
                continue
            o = {k: f[k] for k in ("key", "label", "type", "unit", "req")}
            if f["type"] == "num":
                o.update(min=f["min"], max=f["max"], step=f["step"], norm=f["norm"])
            elif f["type"] == "choice":
                o["options"] = [dict(value=x["value"], label=x["label"]) for x in f["options"]]
            else:
                o["hint"] = f.get("hint", "")
            fs.append(o)
        cats.append(dict(id=cid, title=title, fields=fs))
    return dict(categories=cats, sos_reasons=SOS_REASONS, cooldown_hours=24)


def band_status(f, v):
    for lo, hi, s in f["bands"]:
        if (lo is None or v >= lo) and (hi is None or v < hi):
            return s
    return 2


def evaluate(ans):
    out, errs = [], {}
    for f in FIELDS:
        k, raw = f["key"], ans.get(f["key"])
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            if f["req"]:
                errs[k] = "This field is required."
            continue
        m = dict(key=k, category=f["cat"], label=f["label"], value_num=None, value_text=None, unit=f["unit"], status=0, note="")
        if f["type"] == "num":
            try:
                if isinstance(raw, bool):
                    raise ValueError
                v = float(raw)
                if not math.isfinite(v):
                    raise ValueError
            except (TypeError, ValueError):
                errs[k] = "Enter a number."
                continue
            if v < f["min"] or v > f["max"]:
                errs[k] = f"Enter a value between {f['min']} and {f['max']}."
                continue
            m["value_num"] = round(v, 2)
            m["status"] = band_status(f, v)
        elif f["type"] == "choice":
            opt = next((o for o in f["options"] if o["value"] == str(raw)), None)
            if not opt:
                errs[k] = "Select an option from the list."
                continue
            m["value_text"], m["status"] = opt["label"], opt["status"]
        else:
            s = str(raw).strip()
            if len(s) > 1000:
                errs[k] = "Enter no more than 1000 characters."
                continue
            m["value_text"], m["note"] = s, "Free text; not automatically assessed."
        if m["status"] == 1:
            m["note"] = "Out of range; monitoring is recommended."
        elif m["status"] == 2:
            m["note"] = "Significant deviation: prompt medical assessment is recommended. Use SOS in an emergency."
        if m["status"] and f["type"] == "num":
            m["note"] += f" Reference: {f['norm']} {f['unit']}."
        out.append(m)
    return out, errs
