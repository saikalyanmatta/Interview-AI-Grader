from sqlalchemy import Column, String, Integer, Text, DateTime, Boolean, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True)
    first_name = Column(String, name="first_name")
    last_name = Column(String, name="last_name")
    profile_image_url = Column(String, name="profile_image_url")
    custom_profile_image = Column(Text, name="custom_profile_image")
    phone = Column(String)
    is_phone_verified = Column(Text, name="is_phone_verified", default="false")
    bio = Column(Text)
    public_resume = Column(Text, name="public_resume")
    created_at = Column(DateTime(timezone=True), name="created_at", server_default=func.now())
    updated_at = Column(DateTime(timezone=True), name="updated_at", server_default=func.now(), onupdate=func.now())


class Session(Base):
    __tablename__ = "sessions"
    sid = Column(String, primary_key=True)
    sess = Column(JSON, nullable=False)
    expire = Column(DateTime, nullable=False)


class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, name="user_id")
    title = Column(Text, nullable=False)
    role = Column(Text, nullable=False, default="Software Engineer")
    description = Column(Text, nullable=False)
    skills = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, name="created_at", server_default=func.now())


class ScheduledInterview(Base):
    __tablename__ = "scheduled_interviews"
    id = Column(Integer, primary_key=True, autoincrement=True)
    employer_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, name="employer_id")
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="SET NULL"), name="job_id")
    title = Column(Text, nullable=False)
    start_time = Column(DateTime, nullable=False, name="start_time")
    deadline_time = Column(DateTime, nullable=False, name="deadline_time")
    coding_questions_count = Column(Integer, nullable=False, default=0, name="coding_questions_count")
    role = Column(Text, nullable=False, default="Software Engineer")
    difficulty = Column(Text, nullable=False, default="Medium")
    interview_style = Column(Text, nullable=False, default="Professional", name="interview_style")
    interview_type = Column(Text, nullable=False, default="Mixed", name="interview_type")
    coding_language = Column(Text, nullable=False, default="Candidate's Choice", name="coding_language")
    question_complexity = Column(Text, nullable=False, default="Moderate", name="question_complexity")
    created_at = Column(DateTime, name="created_at", server_default=func.now())


class InterviewCandidate(Base):
    __tablename__ = "interview_candidates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    scheduled_interview_id = Column(Integer, ForeignKey("scheduled_interviews.id", ondelete="CASCADE"), nullable=False, name="scheduled_interview_id")
    email = Column(Text, nullable=False)
    added_at = Column(DateTime, name="added_at", server_default=func.now())


class Interview(Base):
    __tablename__ = "interviews"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, name="user_id")
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="SET NULL"), name="job_id")
    scheduled_interview_id = Column(Integer, ForeignKey("scheduled_interviews.id", ondelete="SET NULL"), name="scheduled_interview_id")
    role = Column(Text, nullable=False, default="Software Engineer")
    difficulty = Column(Text, nullable=False, default="Medium")
    interview_style = Column(Text, nullable=False, default="Friendly", name="interview_style")
    status = Column(Text, nullable=False, default="pending")
    candidate_name = Column(Text, name="candidate_name")
    resume_text = Column(Text, name="resume_text")
    coding_language = Column(Text, name="coding_language")
    coding_answers = Column(JSON, name="coding_answers", default=list)
    created_at = Column(DateTime, name="created_at", server_default=func.now())
    updated_at = Column(DateTime, name="updated_at", server_default=func.now(), onupdate=func.now())


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    interview_id = Column(Integer, ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, name="interview_id")
    question_text = Column(Text, nullable=False, name="question_text")
    question_index = Column(Integer, nullable=False, name="question_index")
    category = Column(Text, nullable=False, default="general")
    skill = Column(Text)
    created_at = Column(DateTime, name="created_at", server_default=func.now())


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    interview_id = Column(Integer, ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, name="interview_id")
    question_id = Column(Integer, ForeignKey("interview_questions.id", ondelete="CASCADE"), nullable=False, name="question_id")
    transcript = Column(Text, nullable=False)
    stutter_score = Column(Integer, default=0, name="stutter_score")
    stutter_notes = Column(Text, default="", name="stutter_notes")
    confidence_score = Column(Integer, name="confidence_score")
    confidence_notes = Column(Text, default="", name="confidence_notes")
    created_at = Column(DateTime, name="created_at", server_default=func.now())


class InterviewReport(Base):
    __tablename__ = "interview_reports"
    id = Column(Integer, primary_key=True, autoincrement=True)
    interview_id = Column(Integer, ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, unique=True, name="interview_id")
    english_score = Column(Integer, nullable=False, name="english_score")
    english_feedback = Column(Text, nullable=False, default="", name="english_feedback")
    overall_score = Column(Integer, nullable=False, name="overall_score")
    confidence_score = Column(Integer, default=70, name="confidence_score")
    confidence_notes = Column(Text, default="", name="confidence_notes")
    behavioral_score = Column(Integer, default=70, name="behavioral_score")
    coding_score = Column(Integer, name="coding_score")
    technical_score = Column(Integer, name="technical_score")
    behavioral_analysis = Column(JSON, nullable=False, default=dict, name="behavioral_analysis")
    communication_analysis = Column(JSON, nullable=False, default=dict, name="communication_analysis")
    answer_quality_breakdown = Column(JSON, nullable=False, default=list, name="answer_quality_breakdown")
    stutter_analysis = Column(JSON, nullable=False, default=list, name="stutter_analysis")
    skill_scores = Column(JSON, nullable=False, default=list, name="skill_scores")
    recommendation = Column(Text, nullable=False)
    feedback = Column(Text, nullable=False)
    created_at = Column(DateTime, name="created_at", server_default=func.now())
