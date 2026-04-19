import os
import re
import json
from typing import Optional
from openai import OpenAI

REPLIT_AI_BASE_URL = "https://ai.replit.com"

def get_openai_client() -> OpenAI:
    return OpenAI(
        api_key=os.environ.get("REPLIT_OPENAI_API_KEY", os.environ.get("OPENAI_API_KEY", "")),
        base_url=REPLIT_AI_BASE_URL if os.environ.get("REPLIT_OPENAI_API_KEY") else None,
    )


def analyze_stutter(transcript: str) -> dict:
    if not transcript or not transcript.strip():
        return {"stutter_score": 0, "stutter_notes": "No speech detected"}

    clean = transcript.lower()
    clean = re.sub(r'[.,?!;:\'""]', "", clean)
    words = [w for w in clean.split() if w]

    if not words:
        return {"stutter_score": 0, "stutter_notes": "No speech detected"}

    filler_set = {"um", "uh", "er", "ah", "hmm", "like", "basically", "literally", "actually", "right", "so", "okay"}
    filler_count = sum(1 for w in words if w in filler_set)

    phrase_fillers = len(re.findall(r'\b(you know|i mean|kind of|sort of|you see)\b', transcript.lower()))
    filler_count += phrase_fillers

    repetitions = sum(1 for i in range(len(words) - 1) if words[i] == words[i + 1] and len(words[i]) > 1)

    filler_rate = filler_count / len(words)
    score = min(100, round(filler_rate * 160 + repetitions * 12))

    notes = []
    if filler_count > 3:
        notes.append(f"{filler_count} filler words (um/uh/like)")
    if repetitions > 0:
        notes.append(f"{repetitions} word repetition(s)")
    if len(words) < 8:
        notes.append("Very short answer")
    if score == 0 and len(words) >= 8:
        notes.append("Fluent, no issues detected")

    return {
        "stutter_score": score,
        "stutter_notes": "; ".join(notes) if notes else "Speech patterns normal"
    }


def analyze_communication(transcripts: list[str]) -> dict:
    joined = " ".join(transcripts).strip()
    clean = joined.lower()
    clean = re.sub(r'[.,?!;:\'""]', "", clean)
    words = [w for w in clean.split() if w]

    filler_words_list = ["um", "uh", "er", "ah", "hmm", "like", "basically", "literally", "actually", "right", "so", "okay"]
    filler_counts = {w: words.count(w) for w in filler_words_list if words.count(w) > 0}
    total_fillers = sum(filler_counts.values())

    sentences = [s.strip() for s in re.split(r"[.!?]+", joined) if s.strip()]
    avg_sentence_length = round(len(words) / len(sentences)) if sentences else 0

    filler_rate = total_fillers / len(words) if words else 0
    clarity_score = max(35, min(100, round(92 - filler_rate * 250 - max(0, avg_sentence_length - 28) * 1.5)))
    sentence_structure_score = max(35, min(100, round(88 - abs(avg_sentence_length - 18) * 1.4)))

    return {
        "clarity_score": clarity_score,
        "filler_words": filler_counts,
        "total_fillers": total_fillers,
        "sentence_structure_score": sentence_structure_score,
        "average_sentence_length": avg_sentence_length,
        "summary": (
            "Reduce filler words and pause deliberately before answering."
            if total_fillers > 8
            else "Communication is generally clear; keep answers concise and structured."
        ),
    }


async def analyze_facial_frames(frames: list[str]) -> dict:
    if not frames:
        return {"confidence_score": 70, "confidence_notes": "No facial data collected"}

    client = get_openai_client()
    to_analyze = frames[:3]
    parsed = []

    for frame in to_analyze:
        try:
            resp = client.chat.completions.create(
                model="gpt-4o",
                max_tokens=150,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{frame}", "detail": "low"},
                        },
                        {
                            "type": "text",
                            "text": 'Analyze this interview candidate. Score their confidence 0-100 based on eye contact, expression, posture. Return ONLY JSON: {"score":75,"notes":"brief observation","alert":null}. alert can be null, "looking_away", "distracted", or "other_person".',
                        },
                    ],
                }],
            )
            raw = resp.choices[0].message.content or '{"score":70,"notes":"Unable to analyze","alert":null}'
            raw = re.sub(r"```json|```", "", raw).strip()
            parsed.append(json.loads(raw))
        except Exception:
            pass

    if not parsed:
        return {"confidence_score": 70, "confidence_notes": "Analysis unavailable"}

    avg_score = round(sum(a.get("score", 70) for a in parsed) / len(parsed))
    alerts = [a["alert"] for a in parsed if a.get("alert")]
    notes = ". ".join(a["notes"] for a in parsed if a.get("notes"))
    alert_note = f" Alerts: {', '.join(alerts)}." if alerts else ""

    return {"confidence_score": avg_score, "confidence_notes": notes + alert_note}


def parse_json_response(raw: str, fallback: any) -> any:
    try:
        clean = re.sub(r"```json|```", "", raw).strip()
        return json.loads(clean)
    except Exception:
        return fallback
