from extensions import db
from datetime import datetime
import json
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    flashcards = db.relationship('Flashcard', backref='user', lazy=True)
    quizzes = db.relationship('Quiz', backref='user', lazy=True)
    study_plans = db.relationship('StudyPlan', backref='user', lazy=True)
    progress = db.relationship('Progress', backref='user', uselist=False, lazy=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def __repr__(self):
        return f'<User {self.username}>'

class Flashcard(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text, nullable=False)
    topic = db.Column(db.String(100), nullable=False)
    difficulty = db.Column(db.Integer, default=1)  # 1-5 scale
    mastery_level = db.Column(db.Integer, default=0)  # 0-100%
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_reviewed = db.Column(db.DateTime, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    
    def __repr__(self):
        return f'<Flashcard {self.id}: {self.question[:20]}...>'

class Quiz(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    topic = db.Column(db.String(100), nullable=False)
    difficulty = db.Column(db.Integer, default=1)  # 1-5 scale
    questions_json = db.Column(db.Text, nullable=False, default='[]')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed = db.Column(db.Boolean, default=False)
    score = db.Column(db.Integer, default=0)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    
    @property
    def questions(self):
        """Get the questions list from JSON."""
        return json.loads(self.questions_json)
        
    @questions.setter
    def questions(self, questions_list):
        """Store the questions list as JSON."""
        self.questions_json = json.dumps(questions_list)
    
    def __repr__(self):
        return f'<Quiz {self.id}: {self.title}>'

class StudyPlan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    date = db.Column(db.Date, nullable=False)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    
    # Relationships
    tasks = db.relationship('StudyTask', backref='study_plan', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<StudyPlan {self.id}: {self.title}>'

class StudyTask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    duration_minutes = db.Column(db.Integer, nullable=False)
    completed = db.Column(db.Boolean, default=False)
    plan_id = db.Column(db.Integer, db.ForeignKey('study_plan.id'), nullable=False)
    
    def __repr__(self):
        return f'<StudyTask {self.id}: {self.title}>'

class Progress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    flashcards_created = db.Column(db.Integer, default=0)
    flashcards_mastered = db.Column(db.Integer, default=0)
    quizzes_completed = db.Column(db.Integer, default=0)
    quiz_scores_json = db.Column(db.Text, default='[]')
    study_time = db.Column(db.Integer, default=0)  # in minutes
    topics_studied_json = db.Column(db.Text, default='{}')  # topic: time spent
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    @property
    def quiz_scores(self):
        """Get the quiz scores list from JSON."""
        return json.loads(self.quiz_scores_json)
        
    @quiz_scores.setter
    def quiz_scores(self, scores_list):
        """Store the quiz scores list as JSON."""
        self.quiz_scores_json = json.dumps(scores_list)
    
    @property
    def topics_studied(self):
        """Get the topics studied dictionary from JSON."""
        return json.loads(self.topics_studied_json)
        
    @topics_studied.setter
    def topics_studied(self, topics_dict):
        """Store the topics studied dictionary as JSON."""
        self.topics_studied_json = json.dumps(topics_dict)
    
    def __repr__(self):
        return f'<Progress {self.id} for User {self.user_id}>'
