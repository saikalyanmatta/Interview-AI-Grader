import io
import json
import base64
from fastapi import APIRouter, Request, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response as FastAPIResponse
from sqlalchemy.orm import Session as DBSession
from db.database import get_db
from db.models import Interview, InterviewQuestion, InterviewAnswer, InterviewReport, Job, ScheduledInterview, InterviewCandidate, User
from routes.auth import get_current_user
from lib.ai import analyze_stutter, analyze_communication, analyze_facial_frames, parse_json_response, get_openai_client

router = APIRouter()


def _interview_to_dict(iv: Interview, extra: dict = None) -> dict:
    d = {
        "id": iv.id,
        "userId": iv.user_id,
        "jobId": iv.job_id,
        "scheduledInterviewId": iv.scheduled_interview_id,
        "role": iv.role,
        "difficulty": iv.difficulty,
        "interviewStyle": iv.interview_style,
        "status": iv.status,
        "candidateName": iv.candidate_name,
        "resumeText": iv.resume_text,
        "codingLanguage": iv.coding_language,
        "codingAnswers": iv.coding_answers or [],
        "createdAt": iv.created_at.isoformat() if iv.created_at else None,
        "updatedAt": iv.updated_at.isoformat() if iv.updated_at else None,
    }
    if extra:
        d.update(extra)
    return d


def _question_to_dict(q: InterviewQuestion) -> dict:
    return {
        "id": q.id, "interviewId": q.interview_id,
        "questionText": q.question_text, "questionIndex": q.question_index,
        "category": q.category, "skill": q.skill,
        "createdAt": q.created_at.isoformat() if q.created_at else None,
    }


def _answer_to_dict(a: InterviewAnswer) -> dict:
    return {
        "id": a.id, "interviewId": a.interview_id, "questionId": a.question_id,
        "transcript": a.transcript, "stutterScore": a.stutter_score,
        "stutterNotes": a.stutter_notes, "confidenceScore": a.confidence_score,
        "confidenceNotes": a.confidence_notes,
        "createdAt": a.created_at.isoformat() if a.created_at else None,
    }


def _report_to_dict(r: InterviewReport) -> dict:
    return {
        "id": r.id, "interviewId": r.interview_id,
        "englishScore": r.english_score, "englishFeedback": r.english_feedback,
        "overallScore": r.overall_score, "confidenceScore": r.confidence_score,
        "confidenceNotes": r.confidence_notes, "behavioralScore": r.behavioral_score,
        "behavioralAnalysis": r.behavioral_analysis,
        "communicationAnalysis": r.communication_analysis,
        "answerQualityBreakdown": r.answer_quality_breakdown,
        "stutterAnalysis": r.stutter_analysis, "skillScores": r.skill_scores,
        "recommendation": r.recommendation, "feedback": r.feedback,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/interviews")
async def list_interviews(request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    interviews = db.query(Interview).filter(Interview.user_id == user["id"]).all()
    result = []
    for iv in interviews:
        questions = db.query(InterviewQuestion).filter(InterviewQuestion.interview_id == iv.id).all()
        answers = db.query(InterviewAnswer).filter(InterviewAnswer.interview_id == iv.id).all()
        job_title = None
        if iv.job_id:
            j = db.query(Job).filter(Job.id == iv.job_id).first()
            job_title = j.title if j else None
        overall_score = None
        recommendation = None
        if iv.status == "completed":
            r = db.query(InterviewReport).filter(InterviewReport.interview_id == iv.id).first()
            if r:
                overall_score = r.overall_score
                recommendation = r.recommendation
        result.append(_interview_to_dict(iv, {
            "jobTitle": job_title,
            "totalQuestions": len(questions),
            "answeredQuestions": len(answers),
            "overallScore": overall_score,
            "recommendation": recommendation,
        }))
    return result


@router.post("/interviews", status_code=201)
async def create_interview(request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    body = await request.json()

    job_id = body.get("jobId")
    role = body.get("role", "Software Engineer")
    difficulty = body.get("difficulty", "Medium")
    interview_style = body.get("interviewStyle", "Friendly")
    scheduled_id = body.get("scheduledInterviewId")
    coding_language = body.get("codingLanguage")

    if scheduled_id:
        from datetime import datetime
        si = db.query(ScheduledInterview).filter(ScheduledInterview.id == int(scheduled_id)).first()
        if not si:
            raise HTTPException(status_code=404, detail="Scheduled interview not found")
        now = datetime.utcnow()
        if now < si.start_time:
            raise HTTPException(status_code=403, detail="Interview has not started yet")
        if now > si.deadline_time:
            raise HTTPException(status_code=403, detail="Interview deadline has passed")

        db_user_obj = db.query(User).filter(User.id == user["id"]).first()
        user_email = (db_user_obj.email or "").lower().strip() if db_user_obj else ""
        if user_email:
            candidate = db.query(InterviewCandidate).filter(
                InterviewCandidate.scheduled_interview_id == si.id,
                InterviewCandidate.email == user_email
            ).first()
            if not candidate:
                raise HTTPException(status_code=403, detail="You are not registered for this interview")

        role = si.role
        difficulty = si.difficulty
        interview_style = si.interview_style
        job_id = si.job_id
        scheduled_id = si.id

    iv = Interview(
        user_id=user["id"],
        job_id=job_id,
        scheduled_interview_id=scheduled_id,
        role=role,
        difficulty=difficulty,
        interview_style=interview_style,
        coding_language=coding_language,
        status="pending",
    )
    db.add(iv)
    db.commit()
    db.refresh(iv)
    return _interview_to_dict(iv, {"jobTitle": None, "totalQuestions": 0, "answeredQuestions": 0})


@router.get("/interviews/{interview_id}")
async def get_interview(interview_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    iv = db.query(Interview).filter(Interview.id == interview_id, Interview.user_id == user["id"]).first()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")
    questions = db.query(InterviewQuestion).filter(InterviewQuestion.interview_id == interview_id).all()
    answers = db.query(InterviewAnswer).filter(InterviewAnswer.interview_id == interview_id).all()
    report = db.query(InterviewReport).filter(InterviewReport.interview_id == interview_id).first()
    job_title = None
    if iv.job_id:
        j = db.query(Job).filter(Job.id == iv.job_id).first()
        job_title = j.title if j else None
    return _interview_to_dict(iv, {
        "jobTitle": job_title,
        "questions": [_question_to_dict(q) for q in questions],
        "answers": [_answer_to_dict(a) for a in answers],
        "report": _report_to_dict(report) if report else None,
    })


@router.post("/interviews/{interview_id}/resume")
async def submit_resume(interview_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    iv = db.query(Interview).filter(Interview.id == interview_id, Interview.user_id == user["id"]).first()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")
    body = await request.json()
    resume_text = body.get("resumeText")
    if not resume_text:
        raise HTTPException(status_code=400, detail="resumeText is required")

    client = get_openai_client()
    resp = client.chat.completions.create(
        model="gpt-4o", max_tokens=1024,
        messages=[
            {"role": "system", "content": 'Extract a list of technical skills, technologies, and subjects from the resume. Return ONLY a JSON array of strings. Example: ["JavaScript","React","Python","SQL"]'},
            {"role": "user", "content": resume_text},
        ],
    )
    skills = parse_json_response(resp.choices[0].message.content or "[]", [])

    iv.resume_text = resume_text
    if body.get("candidateName"):
        iv.candidate_name = body["candidateName"]
    db.commit()
    return {"success": True, "skills": skills}


@router.post("/interviews/{interview_id}/resume/upload")
async def upload_resume(
    interview_id: int, request: Request,
    file: UploadFile = File(...),
    db: DBSession = Depends(get_db)
):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    iv = db.query(Interview).filter(Interview.id == interview_id, Interview.user_id == user["id"]).first()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")

    content = await file.read()
    filename = (file.filename or "").lower()
    resume_text = ""

    if filename.endswith(".pdf") or file.content_type == "application/pdf":
        import pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            resume_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    elif filename.endswith(".docx"):
        from docx import Document
        doc = Document(io.BytesIO(content))
        resume_text = "\n".join(p.text for p in doc.paragraphs)
    elif filename.endswith(".txt") or file.content_type == "text/plain":
        resume_text = content.decode("utf-8")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Please upload PDF, DOCX, or TXT.")

    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file. Please paste your resume instead.")

    client = get_openai_client()
    resp = client.chat.completions.create(
        model="gpt-4o", max_tokens=1024,
        messages=[
            {"role": "system", "content": 'Extract a list of technical skills, technologies, and subjects from the resume. Return ONLY a JSON array of strings.'},
            {"role": "user", "content": resume_text[:6000]},
        ],
    )
    skills = parse_json_response(resp.choices[0].message.content or "[]", [])

    iv.resume_text = resume_text
    iv.candidate_name = request.headers.get("X-Candidate-Name") or None
    db.commit()
    return {"success": True, "skills": skills, "resumeText": resume_text[:300] + ("..." if len(resume_text) > 300 else "")}


@router.delete("/interviews/{interview_id}")
async def delete_interview(interview_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    iv = db.query(Interview).filter(Interview.id == interview_id, Interview.user_id == user["id"]).first()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")
    db.delete(iv)
    db.commit()
    return {"success": True}


@router.post("/interviews/{interview_id}/next-question")
async def next_question(interview_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    iv = db.query(Interview).filter(Interview.id == interview_id, Interview.user_id == user["id"]).first()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")

    if iv.status == "pending":
        iv.status = "in_progress"
        db.commit()

    questions = db.query(InterviewQuestion).filter(InterviewQuestion.interview_id == interview_id).all()
    answers = db.query(InterviewAnswer).filter(InterviewAnswer.interview_id == interview_id).all()

    job_skills = []
    job_role = None
    if iv.job_id:
        j = db.query(Job).filter(Job.id == iv.job_id).first()
        if j:
            job_skills = j.skills or []
            job_role = j.role

    client = get_openai_client()

    if not questions:
        name = f", {iv.candidate_name}" if iv.candidate_name else ""
        resume_section = f"\n\nCandidate Resume:\n{iv.resume_text[:3000]}" if iv.resume_text else ""
        skills_section = f"\nRequired skills: {', '.join(s['name'] for s in job_skills)}" if job_skills else ""

        prompt = f"""You are a professional interviewer for a {iv.role or 'Software Engineer'} position.
Start with a warm, professional greeting{name} and then ask your first interview question.
Interview style: {iv.interview_style or 'Friendly'}. Difficulty: {iv.difficulty or 'Medium'}.{skills_section}{resume_section}

Return ONLY JSON: {{"question": "Your greeting and first question here", "category": "introduction", "skill": null}}"""

        resp = client.chat.completions.create(model="gpt-4o", max_tokens=500, messages=[{"role": "user", "content": prompt}])
        q_data = parse_json_response(resp.choices[0].message.content or "{}", {"question": "Tell me about yourself.", "category": "introduction", "skill": None})

        q = InterviewQuestion(
            interview_id=interview_id,
            question_text=q_data.get("question", "Tell me about yourself."),
            question_index=0,
            category=q_data.get("category", "introduction"),
            skill=q_data.get("skill"),
        )
        db.add(q)
        db.commit()
        db.refresh(q)
        return _question_to_dict(q)

    answered_ids = {a.question_id for a in answers}
    unanswered = [q for q in questions if q.id not in answered_ids]
    if unanswered:
        return _question_to_dict(unanswered[0])

    max_questions = 8
    if len(questions) >= max_questions:
        return {"done": True, "message": "Interview complete. Please submit for grading."}

    qa_lines = []
    for q in questions:
        a = next((ans for ans in answers if ans.question_id == q.id), None)
        stutter_info = f" [Stutter: {a.stutter_score}/100]" if a else ""
        qa_lines.append(f"Q ({q.category}{f' - {q.skill}' if q.skill else ''}): {q.question_text}\nA: {a.transcript if a else '(no answer)'}{stutter_info}")
    qa_text = "\n\n".join(qa_lines)

    resume_ctx = f"\nResume excerpt: {iv.resume_text[:1500]}" if iv.resume_text else ""
    skills_ctx = f"\nRequired skills: {', '.join(s['name'] for s in job_skills)}" if job_skills else ""

    prompt = f"""You are an adaptive AI interviewer for a {job_role or iv.role or 'Software Engineer'} role.
Here is the conversation so far:
{qa_text}
{resume_ctx}{skills_ctx}

Generate the next interview question. Vary topics, probe deeper on weak areas, check STAR framework for behavioral answers.
Style: {iv.interview_style or 'Friendly'}. Difficulty: {iv.difficulty or 'Medium'}.

Return ONLY JSON: {{"question": "...", "category": "behavioral|technical|english_fluency|situational", "skill": "skill name or null"}}"""

    resp = client.chat.completions.create(model="gpt-4o", max_tokens=400, messages=[{"role": "user", "content": prompt}])
    q_data = parse_json_response(resp.choices[0].message.content or "{}", {"question": "Can you describe a challenging project?", "category": "behavioral", "skill": None})

    q = InterviewQuestion(
        interview_id=interview_id,
        question_text=q_data.get("question", "Can you describe a challenging project?"),
        question_index=len(questions),
        category=q_data.get("category", "general"),
        skill=q_data.get("skill"),
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return _question_to_dict(q)


@router.get("/interviews/{interview_id}/questions/{question_id}/audio")
async def get_question_audio(interview_id: int, question_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    q = db.query(InterviewQuestion).filter(InterviewQuestion.id == question_id, InterviewQuestion.interview_id == interview_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    client = get_openai_client()
    tts_resp = client.audio.speech.create(model="tts-1", voice="alloy", input=q.question_text)
    audio_data = tts_resp.content
    return FastAPIResponse(content=audio_data, media_type="audio/mpeg")


@router.post("/interviews/{interview_id}/answers")
async def submit_answer(interview_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    iv = db.query(Interview).filter(Interview.id == interview_id, Interview.user_id == user["id"]).first()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")

    body = await request.json()
    question_id = body.get("questionId")
    audio_base64 = body.get("audioBase64")
    facial_frames = body.get("facialFrames", [])

    q = db.query(InterviewQuestion).filter(InterviewQuestion.id == question_id, InterviewQuestion.interview_id == interview_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    client = get_openai_client()
    transcript = ""
    if audio_base64:
        try:
            audio_bytes = base64.b64decode(audio_base64)
            transcript_resp = client.audio.transcriptions.create(
                model="whisper-1",
                file=("audio.webm", io.BytesIO(audio_bytes), "audio/webm"),
            )
            transcript = transcript_resp.text
        except Exception:
            transcript = ""

    stutter = analyze_stutter(transcript)
    confidence = await analyze_facial_frames(facial_frames)

    answer = db.query(InterviewAnswer).filter(InterviewAnswer.question_id == question_id, InterviewAnswer.interview_id == interview_id).first()
    if answer:
        answer.transcript = transcript
        answer.stutter_score = stutter["stutter_score"]
        answer.stutter_notes = stutter["stutter_notes"]
        answer.confidence_score = confidence["confidence_score"]
        answer.confidence_notes = confidence["confidence_notes"]
    else:
        answer = InterviewAnswer(
            interview_id=interview_id,
            question_id=question_id,
            transcript=transcript,
            stutter_score=stutter["stutter_score"],
            stutter_notes=stutter["stutter_notes"],
            confidence_score=confidence["confidence_score"],
            confidence_notes=confidence["confidence_notes"],
        )
        db.add(answer)
    db.commit()
    db.refresh(answer)
    return _answer_to_dict(answer)


@router.post("/interviews/{interview_id}/complete")
async def complete_interview(interview_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    iv = db.query(Interview).filter(Interview.id == interview_id, Interview.user_id == user["id"]).first()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")

    questions = db.query(InterviewQuestion).filter(InterviewQuestion.interview_id == interview_id).all()
    answers = db.query(InterviewAnswer).filter(InterviewAnswer.interview_id == interview_id).all()

    job_skills = []
    job_role = None
    if iv.job_id:
        j = db.query(Job).filter(Job.id == iv.job_id).first()
        if j:
            job_skills = j.skills or []
            job_role = j.role

    qa_lines = []
    for q in questions:
        a = next((ans for ans in answers if ans.question_id == q.id), None)
        stutter_info = f" [Stutter score: {a.stutter_score}/100{f' — {a.stutter_notes}' if a and a.stutter_notes else ''}]" if a else ""
        qa_lines.append(f"Q ({q.category}{f' - {q.skill}' if q.skill else ''}): {q.question_text}\nA: {a.transcript if a else '(no answer provided)'}{stutter_info}")
    qa_text = "\n\n".join(qa_lines)

    confidence_scores = [a.confidence_score for a in answers if a.confidence_score is not None]
    avg_confidence = round(sum(confidence_scores) / len(confidence_scores)) if confidence_scores else 70
    confidence_notes = ". ".join(a.confidence_notes for a in answers if a.confidence_notes)
    comm_analysis = analyze_communication([a.transcript for a in answers])

    coding_answers = iv.coding_answers or []
    coding_section = ""
    if coding_answers:
        lang = coding_answers[0].get("language", "Unknown") if coding_answers else ""
        coding_section = f"\n\nCandidate Coding Answers ({lang}):\n" + "\n\n".join(
            f"Problem {i+1}: {ca['questionText']}\nCode:\n{ca.get('code', '(no code submitted)')}"
            for i, ca in enumerate(coding_answers)
        )

    role = job_role or iv.role or "Software Engineer"

    skills_line = ""
    if job_skills:
        skills_str = ", ".join(s["name"] + " (level " + str(s.get("requiredLevel", 5)) + "/10)" for s in job_skills)
        skills_line = "Required skills: " + skills_str

    grading_prompt = f"""You are an expert interview evaluator. Analyze this complete interview and grade the candidate.

Interview transcript with fluency metrics:
{qa_text}{coding_section}

Interview: {role} role, {iv.difficulty or 'Medium'} difficulty, {iv.interview_style or 'Friendly'} style.
{skills_line}

Candidate confidence score: {avg_confidence}/100
{f"Confidence notes: {confidence_notes}" if confidence_notes else ""}

Measured communication: {json.dumps(comm_analysis)}

Return ONLY JSON:
{{
  "englishScore": <0-100>,
  "englishFeedback": "<specific feedback>",
  "behavioralScore": <0-100>,
  "behavioralAnalysis": {{"starCompleteness":"<assessment>","missingElements":[],"problemSolving":"<assessment>","emotionalIntelligence":"<assessment>","suggestions":[]}},
  "communicationAnalysis": {{"clarityScore":<0-100>,"fillerWords":{{}},"sentenceStructureScore":<0-100>,"summary":"<explanation>"}},
  "skillScores": [{{"skill":"<skill>","score":<0-100>,"feedback":"<feedback>","meetRequirement":null}}],
  "answerQualityBreakdown": [{{"question":"<q>","yourAnswer":"<a>","rating":<0-100>,"suggestedBetterAnswer":"<better>"}}],
  "overallScore": <0-100>,
  "recommendation": "hire|no_hire|maybe",
  "feedback": "<3-4 sentence executive summary>"
}}"""

    client = get_openai_client()
    grading_resp = client.chat.completions.create(
        model="gpt-4o", max_tokens=3000,
        messages=[{"role": "user", "content": grading_prompt}],
    )
    grading = parse_json_response(grading_resp.choices[0].message.content or "{}", {
        "englishScore": 70, "englishFeedback": "Unable to evaluate.",
        "behavioralScore": 70, "behavioralAnalysis": {"missingElements": [], "suggestions": []},
        "communicationAnalysis": comm_analysis,
        "answerQualityBreakdown": [], "skillScores": [],
        "overallScore": 70, "recommendation": "maybe",
        "feedback": "Evaluation could not be completed.",
    })

    skill_groups: dict[str, list[int]] = {}
    for q in questions:
        skill = q.skill or q.category
        a = next((ans for ans in answers if ans.question_id == q.id), None)
        if a and a.stutter_score is not None:
            skill_groups.setdefault(skill, []).append(a.stutter_score)

    stutter_analysis = [
        {
            "skill": skill,
            "avgStutterScore": round(sum(scores) / len(scores)),
            "questionsAsked": len(scores),
            "notes": f"High disfluency on {skill}" if sum(scores) / len(scores) > 50 else f"Adequate fluency on {skill}",
        }
        for skill, scores in skill_groups.items()
    ]

    existing = db.query(InterviewReport).filter(InterviewReport.interview_id == interview_id).first()
    if existing:
        db.delete(existing)
        db.commit()

    report = InterviewReport(
        interview_id=interview_id,
        english_score=grading.get("englishScore", 70),
        english_feedback=grading.get("englishFeedback", ""),
        overall_score=grading.get("overallScore", 70),
        confidence_score=avg_confidence,
        confidence_notes=confidence_notes or grading.get("feedback", ""),
        behavioral_score=grading.get("behavioralScore", 70),
        behavioral_analysis=grading.get("behavioralAnalysis", {}),
        communication_analysis={**comm_analysis, **grading.get("communicationAnalysis", {})},
        answer_quality_breakdown=grading.get("answerQualityBreakdown", []),
        stutter_analysis=stutter_analysis,
        skill_scores=grading.get("skillScores", []),
        recommendation=grading.get("recommendation", "maybe"),
        feedback=grading.get("feedback", ""),
    )
    db.add(report)
    iv.status = "completed"
    db.commit()
    db.refresh(report)
    return _report_to_dict(report)


@router.get("/interviews/{interview_id}/report")
async def get_report(interview_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    iv = db.query(Interview).filter(Interview.id == interview_id, Interview.user_id == user["id"]).first()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")
    report = db.query(InterviewReport).filter(InterviewReport.interview_id == interview_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not available yet")
    return _report_to_dict(report)


@router.get("/interviews/{interview_id}/coding-questions")
async def get_coding_questions(interview_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    iv = db.query(Interview).filter(Interview.id == interview_id, Interview.user_id == user["id"]).first()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")

    count = 1
    if iv.scheduled_interview_id:
        si = db.query(ScheduledInterview).filter(ScheduledInterview.id == iv.scheduled_interview_id).first()
        count = si.coding_questions_count if si else 1

    if count == 0:
        return {"questions": []}

    language = iv.coding_language or "Python"
    client = get_openai_client()
    prompt = f"""Generate {count} coding interview question(s) for a {iv.role or 'Software Engineer'} at {iv.difficulty or 'Medium'} difficulty, in {language}.
Return ONLY JSON array: [{{"title":"...","description":"...","examples":"..."}}]"""

    resp = client.chat.completions.create(model="gpt-4o", max_tokens=800, messages=[{"role": "user", "content": prompt}])
    questions = parse_json_response(resp.choices[0].message.content or "[]", [])
    return {"questions": questions, "language": language}


@router.post("/interviews/{interview_id}/coding-submit")
async def submit_coding(interview_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    iv = db.query(Interview).filter(Interview.id == interview_id, Interview.user_id == user["id"]).first()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")
    body = await request.json()
    answers = body.get("answers", [])
    if not isinstance(answers, list):
        raise HTTPException(status_code=400, detail="answers array required")
    language = iv.coding_language or "Python"
    iv.coding_answers = [{"questionText": a["questionText"], "language": language, "code": a.get("code", "")} for a in answers]
    db.commit()
    return {"success": True}
