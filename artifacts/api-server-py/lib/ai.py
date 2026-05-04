import os
import re
import json
from typing import Optional
from openai import OpenAI


def get_openai_client() -> OpenAI:
    base_url = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
    api_key = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
    return OpenAI(api_key=api_key, base_url=base_url or None)


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

    # Word count per answer for pacing
    word_counts = [len(t.split()) for t in transcripts if t.strip()]
    avg_words = round(sum(word_counts) / len(word_counts)) if word_counts else 0
    total_words = sum(word_counts)

    return {
        "clarity_score": clarity_score,
        "filler_words": filler_counts,
        "total_fillers": total_fillers,
        "sentence_structure_score": sentence_structure_score,
        "average_sentence_length": avg_sentence_length,
        "total_words": total_words,
        "avg_words_per_answer": avg_words,
        "answer_word_counts": word_counts,
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
                max_completion_tokens=150,
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


def parse_json_response(raw: str, fallback) -> any:
    try:
        clean = re.sub(r"```json|```", "", raw).strip()
        return json.loads(clean)
    except Exception:
        return fallback


def build_grading_prompt(
    qa_text: str,
    coding_section: str,
    role: str,
    difficulty: str,
    interview_style: str,
    skills_line: str,
    avg_confidence: int,
    confidence_notes: str,
    comm_analysis: dict,
    resume_excerpt: str,
) -> str:
    return f"""You are an elite interview evaluation expert with 20 years of experience at top-tier companies. Your job is to produce a thorough, fair, and actionable interview assessment.

## Interview Context
- Role: {role}
- Difficulty: {difficulty}
- Style: {interview_style}
- {skills_line}
- Candidate Confidence (facial analysis): {avg_confidence}/100{f" — {confidence_notes}" if confidence_notes else ""}
- Measured Communication Stats: {json.dumps(comm_analysis)}
{f"- Resume Excerpt: {resume_excerpt[:800]}" if resume_excerpt else ""}

## Full Interview Transcript
{qa_text}
{coding_section}

## Scoring Rubric
Score each dimension from 0–100 using this calibration:
- 90-100: Exceptional — clearly above bar for the role
- 75-89: Strong — meets or exceeds bar
- 60-74: Adequate — mostly meets bar with minor gaps
- 45-59: Below bar — significant gaps that need growth
- 0-44: Poor — not ready for this role

## Required Output
Return ONLY a valid JSON object with this exact structure:

{{
  "englishScore": <0-100, grammar + vocabulary + articulation + fluency>,
  "englishFeedback": "<2-3 sentences of specific English language feedback>",

  "behavioralScore": <0-100, based on STAR structure, depth, EQ, examples>,
  "technicalScore": <0-100 or null if no technical questions asked>,
  "codingScore": <0-100 or null if no coding challenges given>,

  "behavioralAnalysis": {{
    "starCompleteness": "<assessment of how well candidate uses Situation-Task-Action-Result>",
    "missingElements": ["<list of missing STAR elements, e.g. 'Result quantification', 'Action specificity'>"],
    "problemSolving": "<assessment of problem solving approach>",
    "emotionalIntelligence": "<assessment of EQ indicators in answers>",
    "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>", "<actionable suggestion 3>"]
  }},

  "communicationAnalysis": {{
    "clarityScore": <0-100>,
    "fillerWords": {{}},
    "sentenceStructureScore": <0-100>,
    "vocabularyRichness": "<assessment of vocabulary range and appropriateness>",
    "pacingAssessment": "<brief comment on answer length and pacing>",
    "summary": "<2-sentence overall communication assessment>"
  }},

  "answerQualityBreakdown": [
    {{
      "question": "<exact question text>",
      "yourAnswer": "<brief summary of what candidate said>",
      "rating": <0-100>,
      "dimensions": {{
        "relevance": <0-100>,
        "depth": <0-100>,
        "clarity": <0-100>,
        "starUsage": <0-100 or null if not behavioral>
      }},
      "strengths": "<what was strong about this answer>",
      "gaps": "<what was missing or weak>",
      "suggestedBetterAnswer": "<a concise example of a stronger answer structure>"
    }}
  ],

  "skillScores": [
    {{
      "skill": "<skill name>",
      "score": <0-100>,
      "evidence": "<specific evidence from the interview>",
      "feedback": "<actionable skill-specific feedback>",
      "meetRequirement": <true|false|null>
    }}
  ],

  "strengths": [
    "<specific, evidence-backed strength 1>",
    "<specific, evidence-backed strength 2>",
    "<specific, evidence-backed strength 3>"
  ],

  "redFlags": [
    "<specific concern 1 with evidence>",
    "<specific concern 2 with evidence>"
  ],

  "growthAreas": [
    {{
      "area": "<skill or competency name>",
      "currentLevel": "<brief assessment>",
      "suggestion": "<concrete improvement suggestion>",
      "resources": "<type of resource: e.g. system design practice, LeetCode, behavioral coaching>"
    }}
  ],

  "hiringRationale": {{
    "forHiring": ["<reason to hire 1>", "<reason to hire 2>"],
    "againstHiring": ["<concern 1>", "<concern 2>"],
    "conditions": "<any conditions or caveats to a hire decision>"
  }},

  "interviewPacing": {{
    "overallAssessment": "<brief: did candidate use time well, too brief, too verbose?>",
    "shortestAnswer": "<which question got the shortest/weakest answer>",
    "bestAnswer": "<which question the candidate handled best>"
  }},

  "overallScore": <0-100, weighted: behavioral 30% + english 20% + technical/coding 25% + confidence 15% + communication 10%>,
  "recommendation": "hire|no_hire|maybe",
  "feedback": "<4-5 sentence executive summary that a hiring manager would read, covering overall impression, top strength, biggest concern, and final recommendation rationale>"
}}"""
