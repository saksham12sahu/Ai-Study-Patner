import os
import json
import datetime
from flask import render_template, request, jsonify, session, redirect, url_for, flash
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from app import app, db
from models import User, Flashcard, Quiz, StudyPlan, StudyTask, Progress
from forms import LoginForm, RegistrationForm, ProfileUpdateForm, ChangePasswordForm
from ai_utils import generate_flashcards, generate_quiz, ask_ai_tutor, analyze_study_habits


# Authentication Routes
@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
        
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and user.check_password(form.password.data):
            login_user(user, remember=form.remember.data)
            # Initialize user's progress if it doesn't exist
            if not user.progress:
                new_progress = Progress(user_id=user.id)
                db.session.add(new_progress)
                db.session.commit()
            next_page = request.args.get('next')
            return redirect(next_page or url_for('index'))
        else:
            flash('Invalid username or password', 'danger')
    
    return render_template('login.html', form=form)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
        
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(username=form.username.data, email=form.email.data)
        user.set_password(form.password.data)
        
        db.session.add(user)
        db.session.commit()
        
        # Create initial progress record for the user
        progress = Progress(user_id=user.id)
        db.session.add(progress)
        db.session.commit()
        
        flash('Registration successful! You can now log in.', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html', form=form)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))

@app.route('/profile', methods=['GET'])
@login_required
def profile():
    # Init forms
    form = ProfileUpdateForm()
    form.username.data = current_user.username
    form.email.data = current_user.email
    
    password_form = ChangePasswordForm()
    
    # Get user statistics
    progress = current_user.progress
    if not progress:
        progress = Progress(user_id=current_user.id)
        db.session.add(progress)
        db.session.commit()
    
    # Get top 5 topics
    topics_studied = progress.topics_studied
    top_topics = sorted(topics_studied.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Get recent quiz scores (up to 5)
    recent_scores = progress.quiz_scores[-5:] if progress.quiz_scores else []
    
    stats = {
        'flashcards_created': progress.flashcards_created,
        'flashcards_mastered': progress.flashcards_mastered,
        'quizzes_completed': progress.quizzes_completed,
        'study_time': progress.study_time,
        'top_topics': top_topics,
        'recent_scores': recent_scores
    }
    
    return render_template('profile.html', form=form, password_form=password_form, stats=stats)

@app.route('/update_profile', methods=['POST'])
@login_required
def update_profile():
    form = ProfileUpdateForm()
    if form.validate_on_submit():
        current_user.username = form.username.data
        current_user.email = form.email.data
        db.session.commit()
        flash('Your profile has been updated!', 'success')
    else:
        for field, errors in form.errors.items():
            for error in errors:
                flash(f'{getattr(form, field).label.text}: {error}', 'danger')
    
    return redirect(url_for('profile'))

@app.route('/change_password', methods=['POST'])
@login_required
def change_password():
    form = ChangePasswordForm()
    if form.validate_on_submit():
        # Check if current password is correct
        if current_user.check_password(form.current_password.data):
            current_user.set_password(form.new_password.data)
            db.session.commit()
            flash('Your password has been updated!', 'success')
        else:
            flash('Current password is incorrect.', 'danger')
    else:
        for field, errors in form.errors.items():
            for error in errors:
                flash(f'{getattr(form, field).label.text}: {error}', 'danger')
    
    return redirect(url_for('profile'))

# Home page
@app.route('/')
@login_required
def index():
    # Check if OpenAI API key is set
    openai_api_key = os.environ.get('OPENAI_API_KEY')
    api_key_set = bool(openai_api_key)
    
    return render_template('index.html', api_key_set=api_key_set)

# Flashcards Routes
@app.route('/flashcards')
@login_required
def flashcards():
    user_flashcards = Flashcard.query.filter_by(user_id=current_user.id).all()
    return render_template('flashcards.html', flashcards=user_flashcards)




@app.route('/api/flashcards', methods=['GET'])
@login_required
def get_flashcards():
    try:
        topic = request.args.get('topic', 'General')
        since = request.args.get('since', None)
        query = Flashcard.query.filter_by(
            user_id=current_user.id,
            topic=topic
        ).filter(
            Flashcard.answer.notlike('Important concept related to%')
        )
        
        if since:
            try:
                cutoff_time = datetime.datetime.fromisoformat(since.replace('Z', '+00:00'))
                query = query.filter(Flashcard.created_at >= cutoff_time)
            except ValueError:
                app.logger.warning(f"Invalid 'since' parameter: {since}")
        
        flashcards = query.order_by(Flashcard.created_at.desc()).limit(5).all()
        
        flashcard_list = [{
            'id': card.id,
            'question': card.question,
            'answer': card.answer,
            'topic': card.topic,
            'difficulty': card.difficulty,
            'mastery_level': card.mastery_level,
            'created_at': card.created_at.isoformat() if card.created_at else None,
            'last_reviewed': card.last_reviewed.isoformat() if card.last_reviewed else None
        } for card in flashcards]
        
        app.logger.debug(f"Returning {len(flashcard_list)} flashcards for user ID: {current_user.id}, topic: {topic}, since: {since}")
        return jsonify(flashcard_list)
    except Exception as e:
        app.logger.error(f"Error fetching flashcards: {str(e)}")
        return jsonify({'error': 'Failed to fetch flashcards'}), 500







@app.route('/api/flashcards/generate', methods=['POST'])
@login_required
def create_flashcards():
    data = request.json
    text = data.get('text', '')
    topic = data.get('topic', 'General')
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    
    try:
        app.logger.debug(f"Generating flashcards for topic: {topic}, text: {text[:100]}...")
        generated_flashcards = generate_flashcards(text, topic)
        
        # Check for fallback flashcards
        is_fallback = any(
            card['answer'].startswith(f"Important concept related to {topic}") 
            for card in generated_flashcards
        )
        if is_fallback:
            app.logger.warning("Generated flashcards are fallbacks, indicating API failure")
            return jsonify({'error': 'Failed to generate specific flashcards due to API issues'}), 500
        
        # Validate flashcards
        for card_data in generated_flashcards:
            if not (isinstance(card_data, dict) and 
                    card_data.get('question') and 
                    card_data.get('answer') and 
                    isinstance(card_data['question'], str) and 
                    isinstance(card_data['answer'], str)):
                raise ValueError(f"Invalid flashcard data: {card_data}")
        
        now = datetime.datetime.utcnow()
        saved_cards = []
        
        for card_data in generated_flashcards:
            new_card = Flashcard(
                question=card_data['question'],
                answer=card_data['answer'],
                topic=topic,
                difficulty=1,
                mastery_level=0,
                created_at=now,
                user_id=current_user.id
            )
            db.session.add(new_card)
            saved_cards.append({
                'id': 'temp_' + str(len(saved_cards)),
                'question': new_card.question,
                'answer': new_card.answer,
                'topic': new_card.topic,
                'difficulty': new_card.difficulty,
                'mastery_level': new_card.mastery_level,
                'created_at': new_card.created_at.isoformat() if new_card.created_at else None,
                'last_reviewed': None
            })
        
        progress = current_user.progress
        if progress:
            progress.flashcards_created += len(generated_flashcards)
            topics_dict = progress.topics_studied
            if topic in topics_dict:
                topics_dict[topic] += 10
            else:
                topics_dict[topic] = 10
            progress.topics_studied = topics_dict
        else:
            app.logger.warning(f"No progress record for user ID: {current_user.id}")
        
        # Flush and commit with retry
        max_retries = 3
        for attempt in range(max_retries):
            try:
                db.session.flush()
                db.session.commit()
                break
            except Exception as e:
                app.logger.warning(f"Commit attempt {attempt + 1} failed: {str(e)}")
                db.session.rollback()
                if attempt == max_retries - 1:
                    raise Exception("Failed to commit flashcards after retries")
                datetime.time.sleep(0.5)
        
        # Verify commit
        committed_flashcards = Flashcard.query.filter_by(user_id=current_user.id).filter(
            Flashcard.created_at >= now,
            Flashcard.topic == topic
        ).all()
        if not committed_flashcards:
            app.logger.warning("No flashcards found immediately after commit, possible database issue")
            app.logger.debug(f"Expected {len(saved_cards)} flashcards for user ID: {current_user.id}, topic: {topic}")
        
        # Query with a 30-second buffer
        time_buffer = datetime.datetime.utcnow() - datetime.timedelta(seconds=30)
        user_flashcards = Flashcard.query.filter_by(user_id=current_user.id).filter(
            Flashcard.created_at >= time_buffer,
            Flashcard.topic == topic,
            Flashcard.answer.notlike('Important concept related to%')
        ).order_by(Flashcard.created_at.desc()).limit(len(saved_cards)).all()
        
        if len(user_flashcards) != len(saved_cards):
            app.logger.warning(f"Mismatch in saved flashcards: expected {len(saved_cards)}, got {len(user_flashcards)}")
            app.logger.debug(f"Queried flashcards: {[f.id for f in user_flashcards]}")
            # Use saved_cards if query fails
            for i, card in enumerate(saved_cards):
                card['id'] = f"temp_{i+1}"
        else:
            for i, card in enumerate(user_flashcards):
                saved_cards[i]['id'] = card.id
        
        app.logger.debug(f"Saved {len(saved_cards)} flashcards for user ID: {current_user.id}")
        return jsonify(saved_cards)
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error generating flashcards: {str(e)}")
        return jsonify({'error': 'Failed to generate flashcards'}), 500





@app.route('/api/flashcards/<int:card_id>/update', methods=['POST'])
@login_required
def update_flashcard(card_id):
    data = request.json
    mastery_level = data.get('mastery_level')
    
    # Find the flashcard in the database
    card = Flashcard.query.filter_by(id=card_id, user_id=current_user.id).first()
    
    if not card:
        return jsonify({'error': 'Flashcard not found'}), 404
    
    # Update the flashcard's mastery level
    if mastery_level is not None:
        card.mastery_level = mastery_level
        card.last_reviewed = datetime.datetime.utcnow()
        
        # Update progress data if mastery level has increased to 80 or higher
        if mastery_level >= 80 and card.mastery_level < 80:
            progress = current_user.progress
            if progress:
                progress.flashcards_mastered += 1
        
        db.session.commit()
    
    # Return updated flashcard data
    return jsonify({
        'id': card.id,
        'question': card.question,
        'answer': card.answer,
        'topic': card.topic,
        'difficulty': card.difficulty,
        'mastery_level': card.mastery_level,
        'created_at': card.created_at.isoformat() if card.created_at else None,
        'last_reviewed': card.last_reviewed.isoformat() if card.last_reviewed else None
    })

# Quiz Routes
@app.route('/quizzes')
@login_required
def quizzes():
    user_quizzes = Quiz.query.filter_by(user_id=current_user.id).all()
    return render_template('quizzes.html', quizzes=user_quizzes)

@app.route('/api/quizzes', methods=['GET'])
@login_required
def get_quizzes():
    user_quizzes = Quiz.query.filter_by(user_id=current_user.id).all()
    
    # Convert SQLAlchemy objects to dictionaries for JSON response
    quizzes_data = []
    for quiz in user_quizzes:
        quizzes_data.append({
            'id': quiz.id,
            'title': quiz.title,
            'topic': quiz.topic,
            'difficulty': quiz.difficulty,
            'questions': quiz.questions,
            'created_at': quiz.created_at.isoformat() if quiz.created_at else None,
            'completed': quiz.completed,
            'score': quiz.score
        })
    
    return jsonify(quizzes_data)

@app.route('/api/quizzes/generate', methods=['POST'])
@login_required
def create_quiz():
    data = request.json
    topic = data.get('topic', '')
    difficulty = data.get('difficulty', 3)
    num_questions = data.get('num_questions', 5)
    
    if not topic:
        return jsonify({'error': 'No topic provided'}), 400
    
    try:
        # Generate quiz questions using AI
        quiz_questions = generate_quiz(topic, difficulty, num_questions)
        
        now = datetime.datetime.utcnow()
        
        # Create a new Quiz model instance
        new_quiz = Quiz(
            title=f"Quiz on {topic}",
            topic=topic,
            difficulty=difficulty,
            created_at=now,
            completed=False,
            score=0,
            user_id=current_user.id
        )
        
        # Set the questions JSON
        new_quiz.questions = quiz_questions
        
        # Add to database session
        db.session.add(new_quiz)
        
        # Update progress data
        progress = current_user.progress
        if progress:
            # Update topics studied
            topics_dict = progress.topics_studied
            if topic in topics_dict:
                topics_dict[topic] += 5  # Estimate 5 minutes for creating a quiz
            else:
                topics_dict[topic] = 5
            progress.topics_studied = topics_dict
        
        # Commit all changes to the database
        db.session.commit()
        print(f"Saved quiz ID: {new_quiz.id}")
        saved = Quiz.query.get(new_quiz.id)
        print(f"Retrieved saved quiz: {saved}")


        
        # Return the created quiz data
        return jsonify({
            'id': new_quiz.id,
            'title': new_quiz.title,
            'topic': new_quiz.topic,
            'difficulty': new_quiz.difficulty,
            'questions': new_quiz.questions,
            'created_at': new_quiz.created_at.isoformat() if new_quiz.created_at else None,
            'completed': new_quiz.completed,
            'score': new_quiz.score
        })
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error generating quiz: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/quizzes/<int:quiz_id>/submit', methods=['POST'])
@login_required
def submit_quiz(quiz_id):
    data = request.json
    answers = data.get('answers', {})
    
    # Find the quiz in the database
    quiz = Quiz.query.filter_by(id=quiz_id, user_id=current_user.id).first()
    
    if not quiz:
        return jsonify({'error': 'Quiz not found'}), 404
    
    # Get the questions from the quiz
    questions = quiz.questions
    
    # Calculate score
    total_questions = len(questions)
    correct_answers = 0
    
    for q_idx, question in enumerate(questions):
        user_answer = answers.get(str(q_idx))
        if user_answer and user_answer == question['correct_answer']:
            correct_answers += 1
            question['user_correct'] = True
        else:
            question['user_correct'] = False
        
        question['user_answer'] = user_answer
    
    score = int((correct_answers / total_questions) * 100) if total_questions > 0 else 0
    
    # Update quiz model
    quiz.completed = True
    quiz.score = score
    quiz.questions = questions  # Save updated questions with user answers
    
    # Update progress data
    progress = current_user.progress
    if progress:
        progress.quizzes_completed += 1
        
        # Update quiz scores
        scores = progress.quiz_scores
        scores.append(score)
        progress.quiz_scores = scores
        
        # Update study time for the topic
        topics_dict = progress.topics_studied
        if quiz.topic in topics_dict:
            topics_dict[quiz.topic] += len(questions) * 2  # Estimate 2 minutes per question
        else:
            topics_dict[quiz.topic] = len(questions) * 2
        progress.topics_studied = topics_dict
    
    # Commit changes to the database
    db.session.commit()
    
    return jsonify({
        'quiz': {
            'id': quiz.id,
            'title': quiz.title,
            'topic': quiz.topic,
            'difficulty': quiz.difficulty,
            'questions': quiz.questions,
            'created_at': quiz.created_at.isoformat() if quiz.created_at else None,
            'completed': quiz.completed,
            'score': quiz.score
        },
        'score': score,
        'correct_answers': correct_answers,
        'total_questions': total_questions
    })

@app.route('/api/quizzes/<int:quiz_id>', methods=['GET'])
@login_required
def get_quiz_by_id(quiz_id):
    quiz = Quiz.query.filter_by(id=quiz_id, user_id=current_user.id).first()
    
    if not quiz:
        return jsonify({'error': 'Quiz not found'}), 404

    return jsonify({
        'id': quiz.id,
        'title': quiz.title,
        'topic': quiz.topic,
        'difficulty': quiz.difficulty,
        'questions': quiz.questions,
        'created_at': quiz.created_at.isoformat() if quiz.created_at else None,
        'completed': quiz.completed,
        'score': quiz.score
    })


# Chatbot Routes
@app.route('/chatbot')
@login_required
def chatbot():
    return render_template('chatbot.html')

@app.route('/api/chatbot/ask', methods=['POST'])
@login_required
def ask_chatbot():
    data = request.json
    question = data.get('question', '')
    context = data.get('context', '')
    
    if not question:
        return jsonify({'error': 'No question provided'}), 400
    
    try:
        # Get answer from AI tutor
        answer = ask_ai_tutor(question, context)
        
        # Update study data - assume 3 minutes spent on this interaction
        progress = current_user.progress
        if progress:
            progress.study_time += 3
            
            # Try to infer topic from question
            if 'topic' in data:
                topic = data['topic']
                topics_dict = progress.topics_studied
                if topic in topics_dict:
                    topics_dict[topic] += 3
                else:
                    topics_dict[topic] = 3
                progress.topics_studied = topics_dict
            
            db.session.commit()
        
        return jsonify({
            'answer': answer,
            'timestamp': datetime.datetime.utcnow().isoformat()
        })
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error getting chatbot response: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Study Planner Routes
@app.route('/planner')
@login_required
def planner():
    user_plans = StudyPlan.query.filter_by(user_id=current_user.id).all()
    return render_template('planner.html', plans=user_plans)

@app.route('/api/planner/plans', methods=['GET'])
@login_required
def get_plans():
    user_plans = StudyPlan.query.filter_by(user_id=current_user.id).all()
    
    # Convert SQLAlchemy objects to dictionaries for JSON response
    plans_data = []
    for plan in user_plans:
        tasks_data = []
        for task in plan.tasks:
            tasks_data.append({
                'id': task.id,
                'title': task.title,
                'duration_minutes': task.duration_minutes,
                'completed': task.completed
            })
        
        plans_data.append({
            'id': plan.id,
            'title': plan.title,
            'date': plan.date.isoformat() if plan.date else None,
            'tasks': tasks_data,
            'completed': plan.completed,
            'created_at': plan.created_at.isoformat() if plan.created_at else None
        })
    
    return jsonify(plans_data)

@app.route('/api/planner/plans', methods=['POST'])
@login_required
def create_plan():
    data = request.json
    title = data.get('title', '')
    date_str = data.get('date', '')
    tasks_data = data.get('tasks', [])
    
    if not title or not date_str:
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        # Parse the date string into a datetime.date object
        try:
            date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD.'}), 400
        
        # Create a new StudyPlan model instance
        new_plan = StudyPlan(
            title=title,
            date=date_obj,
            completed=False,
            user_id=current_user.id
        )
        
        # Add to database session
        db.session.add(new_plan)
        
        # Create task objects
        total_planned_minutes = 0
        for task_data in tasks_data:
            task_title = task_data.get('title', '')
            duration = task_data.get('duration_minutes', 30)
            
            # Create a new StudyTask model instance
            new_task = StudyTask(
                title=task_title,
                duration_minutes=duration,
                completed=False
            )
            
            # Add to the plan's tasks relationship
            new_plan.tasks.append(new_task)
            
            total_planned_minutes += duration
        
        # Update progress data
        progress = current_user.progress
        if progress:
            progress.study_time += total_planned_minutes
        
        # Commit all changes to the database
        db.session.commit()
        
        # Prepare response with the created plan
        tasks_data = []
        for task in new_plan.tasks:
            tasks_data.append({
                'id': task.id,
                'title': task.title,
                'duration_minutes': task.duration_minutes,
                'completed': task.completed
            })
        
        return jsonify({
            'id': new_plan.id,
            'title': new_plan.title,
            'date': new_plan.date.isoformat() if new_plan.date else None,
            'tasks': tasks_data,
            'completed': new_plan.completed,
            'created_at': new_plan.created_at.isoformat() if new_plan.created_at else None
        })
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error creating study plan: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/planner/tasks/<int:task_id>/toggle', methods=['POST'])
@login_required
def toggle_task(task_id):
    # Find the task in the database
    task = StudyTask.query.filter_by(id=task_id).first()
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    # Get the associated plan and check if it belongs to the current user
    plan = StudyPlan.query.filter_by(id=task.plan_id).first()
    
    if not plan or plan.user_id != current_user.id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Toggle task completion
    task.completed = not task.completed
    
    # Check if all tasks are completed
    all_completed = all(t.completed for t in plan.tasks)
    plan.completed = all_completed
    
    # Commit changes to the database
    db.session.commit()
    
    return jsonify({
        'task': {
            'id': task.id,
            'title': task.title,
            'duration_minutes': task.duration_minutes,
            'completed': task.completed
        },
        'plan_completed': plan.completed
    })

# Progress Tracking Routes
@app.route('/progress')
@login_required
def progress():
    return render_template('progress.html')

@app.route('/api/progress', methods=['GET'])
@login_required
def get_progress():
    # Get user's progress from database
    user_progress = current_user.progress
    
    if not user_progress:
        # Create a new progress record if it doesn't exist
        user_progress = Progress(user_id=current_user.id)
        db.session.add(user_progress)
        db.session.commit()
    
    # Prepare progress data
    progress_data = {
        'flashcards_created': user_progress.flashcards_created,
        'flashcards_mastered': user_progress.flashcards_mastered,
        'quizzes_completed': user_progress.quizzes_completed,
        'quiz_scores': user_progress.quiz_scores,
        'study_time': user_progress.study_time,
        'topics_studied': user_progress.topics_studied
    }
    
    # Calculate additional metrics
    mastery_rate = 0
    if progress_data['flashcards_created'] > 0:
        mastery_rate = (progress_data['flashcards_mastered'] / progress_data['flashcards_created']) * 100
    
    avg_quiz_score = 0
    if progress_data['quiz_scores']:
        avg_quiz_score = sum(progress_data['quiz_scores']) / len(progress_data['quiz_scores'])
    
    # Generate recommendations if we have enough data
    recommendations = []
    if progress_data['topics_studied'] and progress_data['quiz_scores']:
        flashcard_mastery = mastery_rate / 100 if mastery_rate > 0 else 0
        recommendations = analyze_study_habits(
            progress_data['topics_studied'],
            progress_data['quiz_scores'],
            flashcard_mastery
        )
    
    return jsonify({
        'raw_data': progress_data,
        'metrics': {
            'mastery_rate': mastery_rate,
            'avg_quiz_score': avg_quiz_score,
            'total_study_time': progress_data['study_time'],
            'topics_count': len(progress_data['topics_studied'])
        },
        'recommendations': recommendations
    })
