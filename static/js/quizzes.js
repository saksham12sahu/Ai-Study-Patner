document.addEventListener('DOMContentLoaded', function() {
    const generateQuizForm = document.getElementById('generate-quiz-form');
    const quizzesList = document.getElementById('quizzes-list');
    const noQuizzes = document.getElementById('no-quizzes');
    const quizModal = new bootstrap.Modal(document.getElementById('quizModal'));
    const quizModalElement = document.getElementById('quizModal');
    const quizContent = document.getElementById('quiz-content');
    const quizResults = document.getElementById('quiz-results');
    const quizTitle = document.getElementById('quiz-title');
    const quizDifficultyBadge = document.getElementById('quiz-difficulty-badge');
    const quizQuestionsContainer = document.getElementById('quiz-questions-container');
    const quizForm = document.getElementById('quiz-form');
    const quizReview = document.getElementById('quiz-review');
    const difficultySlider = document.getElementById('quiz-difficulty');
    const difficultyValue = document.getElementById('difficulty-value');
    
    let currentQuizzes = [];
    let currentQuiz = null;
    
    // Load existing quizzes
    loadQuizzes();
    
    // Update difficulty slider value display
    if (difficultySlider) {
        difficultySlider.addEventListener('input', function() {
            difficultyValue.textContent = this.value;
        });
    }
    
    // Handle form submission to generate quiz
    if (generateQuizForm) {
        generateQuizForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const topic = document.getElementById('quiz-topic').value;
            const difficulty = parseInt(document.getElementById('quiz-difficulty').value);
            const numQuestions = parseInt(document.getElementById('quiz-questions').value);
            
            if (!topic) {
                showToast('Please enter a quiz topic.', 'danger');
                return;
            }
            
            generateQuiz(topic, difficulty, numQuestions);
        });
    }
    
    // Handle quiz form submission
    if (quizForm) {
        quizForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!currentQuiz) {
                showToast('No quiz loaded.', 'danger');
                return;
            }
            
            // Collect answers
            const answers = {};
            currentQuiz.questions.forEach((question, index) => {
                const selectedOption = document.querySelector(`input[name="q${index}"]:checked`);
                if (selectedOption) {
                    answers[index] = selectedOption.value;
                }
            });
            
            submitQuiz(currentQuiz.id, answers);
        });
    }
    
    // Reset modal content when modal is hidden
    if (quizModalElement) {
        quizModalElement.addEventListener('hidden.bs.modal', function() {
            quizContent.classList.remove('d-none');
            quizResults.classList.add('d-none');
            currentQuiz = null;
        });
    }
    
    // Function to load existing quizzes
    function loadQuizzes() {
        fetch('/api/quizzes')
            .then(response => response.json())
            .then(data => {
                currentQuizzes = data;
                
                if (data.length > 0) {
                    if (noQuizzes) noQuizzes.classList.add('d-none');
                    if (quizzesList) renderQuizzesList(data);
                } else {
                    if (noQuizzes) noQuizzes.classList.remove('d-none');
                }
            })
            .catch(error => {
                console.error('Error loading quizzes:', error);
                showToast('Failed to load quizzes. Please try again.', 'danger');
            });
    }
    
    // Function to generate a quiz
    function generateQuiz(topic, difficulty, numQuestions) {
        showSpinner('generate-quiz-btn', 'quiz-spinner');
        
        fetch('/api/quizzes/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                topic: topic,
                difficulty: difficulty,
                num_questions: numQuestions
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Server error');
            }
            return response.json();
        })
        .then(data => {
            hideSpinner('generate-quiz-btn', 'quiz-spinner');
            
            if (data.error) {
                showToast(data.error, 'danger');
                return;
            }
            
            // Add to current quizzes
            currentQuizzes.push(data);
            
            // Show success message
            showToast(`Successfully generated quiz on ${topic}!`, 'success');
            
            // Clear form
            document.getElementById('quiz-topic').value = '';
            
            // Hide no quizzes message
            if (noQuizzes) noQuizzes.classList.add('d-none');
            
            // Render the updated quizzes list
            if (quizzesList) renderQuizzesList(currentQuizzes);
            
            // Open the quiz
            openQuiz(data.id);
        })
        .catch(error => {
            hideSpinner('generate-quiz-btn', 'quiz-spinner');
            console.error('Error generating quiz:', error);
            showToast('Failed to generate quiz. Please try again.', 'danger');
        });
    }
    
    // Function to render quizzes list
    function renderQuizzesList(quizzes) {
        if (!quizzesList) return;
        
        quizzesList.innerHTML = '';
        
        quizzes.forEach(quiz => {
            const quizElement = document.createElement('div');
            quizElement.className = 'col';
            
            let statusBadge = '';
            if (quiz.completed) {
                statusBadge = `<span class="badge bg-success">Completed: ${quiz.score}%</span>`;
            } else {
                statusBadge = '<span class="badge bg-primary">New</span>';
            }
            
            // Difficulty stars
            const difficultyStars = '★'.repeat(quiz.difficulty) + '☆'.repeat(5 - quiz.difficulty);
            
            quizElement.innerHTML = `
                <div class="card h-100 shadow-sm quiz-card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <h5 class="card-title">${quiz.title}</h5>
                            ${statusBadge}
                        </div>
                        <p class="card-text text-muted mb-0">${quiz.questions.length} questions</p>
                        <p class="card-text text-warning mb-3">${difficultyStars}</p>
                        <div class="d-grid">
                            <button class="btn ${quiz.completed ? 'btn-outline-primary' : 'btn-primary'} open-quiz"
                                    data-quiz-id="${quiz.id}">
                                <i class="fas fa-${quiz.completed ? 'redo' : 'play-circle'} me-2"></i>
                                ${quiz.completed ? 'Review Quiz' : 'Take Quiz'}
                            </button>
                        </div>
                    </div>
                    <div class="card-footer text-muted">
                        <small>Created: ${formatDate(quiz.created_at)}</small>
                    </div>
                </div>
            `;
            
            quizzesList.appendChild(quizElement);
            
            // Add click event for quiz button
            const openBtn = quizElement.querySelector('.open-quiz');
            openBtn.addEventListener('click', function() {
                const quizId = this.getAttribute('data-quiz-id');
                openQuiz(quizId);
            });
        });
    }
    
    // Function to open a quiz in the modal
   /* function openQuiz(quizId) {
        const quiz = currentQuizzes.find(q => q.id === quizId);
        if (!quiz) {
            showToast('Quiz not found.', 'danger');
            return;
        }
        
        currentQuiz = quiz;
        
        // Reset modal content
        quizContent.classList.remove('d-none');
        quizResults.classList.add('d-none');
        
        // Set quiz title and difficulty
        quizTitle.textContent = quiz.title;
        
        // Difficulty badge
        const difficultyColor = getDifficultyColor(quiz.difficulty);
        const difficultyText = getDifficultyText(quiz.difficulty);
        quizDifficultyBadge.innerHTML = `
            <span class="badge bg-${difficultyColor}">
                ${difficultyText} (${quiz.difficulty}/5)
            </span>
        `;
        
        // Render questions if not completed
        if (!quiz.completed) {
            renderQuizQuestions(quiz);
        } else {
            // If quiz is already completed, show results
            showQuizResults(quiz);
        }
        
        // Open modal
        quizModal.show();
    }*/

    function openQuiz(quizId) {
    console.log('Opening quiz ID:', quizId, 'Type:', typeof quizId);
    console.log('Current quizzes:', currentQuizzes.map(q => ({ id: q.id, title: q.title })));
    const quiz = currentQuizzes.find(q => q.id === parseInt(quizId));
    if (!quiz) {
        console.error('Quiz not found in currentQuizzes for ID:', quizId);
        showToast('Quiz not found.', 'danger');
        return;
    }
    console.log('Found quiz:', quiz);
    currentQuiz = quiz;
    quizContent.classList.remove('d-none');
    quizResults.classList.add('d-none');
    quizTitle.textContent = quiz.title;
    const difficultyColor = getDifficultyColor(quiz.difficulty);
    const difficultyText = getDifficultyText(quiz.difficulty);
    quizDifficultyBadge.innerHTML = `
        <span class="badge bg-${difficultyColor}">
            ${difficultyText} (${quiz.difficulty}/5)
        </span>
    `;
    if (!quiz.completed) {
        renderQuizQuestions(quiz);
    } else {
        showQuizResults(quiz);
    }
    quizModal.show();
}
    
    // Function to render quiz questions
    function renderQuizQuestions(quiz) {
        if (!quizQuestionsContainer) return;
        
        quizQuestionsContainer.innerHTML = '';
        
        quiz.questions.forEach((question, index) => {
            const questionElement = document.createElement('div');
            questionElement.className = 'question-card mb-4';
            
            let optionsHTML = '';
            const options = ['A', 'B', 'C', 'D'];
            
            question.options.forEach((option, optIndex) => {
                const optionLetter = options[optIndex];
                optionsHTML += `
                    <div class="form-check">
                        <input class="form-check-input option-input" type="radio" name="q${index}" 
                               id="q${index}_${optionLetter}" value="${optionLetter}" required>
                        <label class="form-check-label option-label" for="q${index}_${optionLetter}">
                            <strong>${optionLetter}.</strong> ${option}
                        </label>
                    </div>
                `;
            });
            
            questionElement.innerHTML = `
                <h5 class="mb-3">Question ${index + 1}</h5>
                <p class="mb-3">${question.question}</p>
                <div class="options-container">
                    ${optionsHTML}
                </div>
            `;
            
            quizQuestionsContainer.appendChild(questionElement);
        });
    }
    
    // Function to submit quiz answers
    function submitQuiz(quizId, answers) {
        // Check if all questions are answered
        if (Object.keys(answers).length < currentQuiz.questions.length) {
            showToast('Please answer all questions before submitting.', 'warning');
            return;
        }
        
        fetch(`/api/quizzes/${quizId}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                answers: answers
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Server error');
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                showToast(data.error, 'danger');
                return;
            }
            
            // Update quiz in current quizzes
            const quizIndex = currentQuizzes.findIndex(q => q.id === quizId);
            if (quizIndex !== -1) {
                currentQuizzes[quizIndex] = data.quiz;
            }
            
            // Show results
            showQuizResults(data.quiz, data.score, data.correct_answers, data.total_questions);
            
            // Update quizzes list
            renderQuizzesList(currentQuizzes);
        })
        .catch(error => {
            console.error('Error submitting quiz:', error);
            showToast('Failed to submit quiz. Please try again.', 'danger');
        });
    }
    
    // Function to show quiz results
    function showQuizResults(quiz, score, correctAnswers, totalQuestions) {
        if (!quizResults || !quizReview) return;
        
        // Hide quiz form and show results
        quizContent.classList.add('d-none');
        quizResults.classList.remove('d-none');
        
        // Extract quiz data
        const quizScore = score || quiz.score;
        correctAnswers = correctAnswers || quiz.questions.filter(q => q.user_correct).length;
        totalQuestions = totalQuestions || quiz.questions.length;
        
        // Update score display
        const scoreElement = document.getElementById('quiz-score');
        if (scoreElement) {
            scoreElement.textContent = `${quizScore}%`;
        }
        
        // Update score message
        const scoreMessageElement = document.getElementById('score-message');
        if (scoreMessageElement) {
            scoreMessageElement.textContent = getScoreMessage(quizScore);
        }
        
        // Update progress bar
        const progressBar = document.getElementById('score-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${quizScore}%`;
            progressBar.ariaValueNow = quizScore;
            
            // Set color based on score
            progressBar.className = 'progress-bar';
            if (quizScore >= 80) {
                progressBar.classList.add('bg-success');
            } else if (quizScore >= 60) {
                progressBar.classList.add('bg-primary');
            } else if (quizScore >= 40) {
                progressBar.classList.add('bg-warning');
            } else {
                progressBar.classList.add('bg-danger');
            }
        }
        
        // Render question review
        quizReview.innerHTML = '';
        
        quiz.questions.forEach((question, index) => {
            const isCorrect = question.user_correct || (question.user_answer === question.correct_answer);
            const statusClass = isCorrect ? 'review-correct' : 'review-incorrect';
            const statusIcon = isCorrect ? 
                '<i class="fas fa-check-circle text-success me-2"></i>' : 
                '<i class="fas fa-times-circle text-danger me-2"></i>';
            
            const userAnswer = question.user_answer || '-';
            
            const reviewElement = document.createElement('div');
            reviewElement.className = `question-card ${statusClass} mb-4`;
            
            let optionsHTML = '';
            const options = ['A', 'B', 'C', 'D'];
            
            question.options.forEach((option, optIndex) => {
                const optionLetter = options[optIndex];
                const isUserAnswer = userAnswer === optionLetter;
                const isCorrectAnswer = question.correct_answer === optionLetter;
                
                let optionClass = '';
                if (isUserAnswer && isCorrectAnswer) {
                    optionClass = 'text-success fw-bold';
                } else if (isUserAnswer && !isCorrectAnswer) {
                    optionClass = 'text-danger fw-bold';
                } else if (isCorrectAnswer) {
                    optionClass = 'text-success';
                }
                
                optionsHTML += `
                    <div class="mb-2 ${optionClass}">
                        <strong>${optionLetter}.</strong> ${option}
                        ${isUserAnswer ? ' (Your answer)' : ''}
                        ${isCorrectAnswer ? ' (Correct answer)' : ''}
                    </div>
                `;
            });
            
            reviewElement.innerHTML = `
                <h5 class="mb-2">
                    ${statusIcon} Question ${index + 1}
                </h5>
                <p class="mb-3">${question.question}</p>
                <div class="options-container mb-3">
                    ${optionsHTML}
                </div>
                <div class="explanation p-3 bg-dark">
                    <strong>Explanation:</strong> ${question.explanation}
                </div>
            `;
            
            quizReview.appendChild(reviewElement);
        });
    }
    
    // Helper functions
    function getDifficultyColor(difficulty) {
        switch (difficulty) {
            case 1: return 'success';
            case 2: return 'info';
            case 3: return 'primary';
            case 4: return 'warning';
            case 5: return 'danger';
            default: return 'primary';
        }
    }
    
    function getDifficultyText(difficulty) {
        switch (difficulty) {
            case 1: return 'Easy';
            case 2: return 'Beginner';
            case 3: return 'Intermediate';
            case 4: return 'Advanced';
            case 5: return 'Expert';
            default: return 'Intermediate';
        }
    }
    
    function getScoreMessage(score) {
        if (score >= 90) return 'Excellent! You have mastered this topic!';
        if (score >= 80) return 'Great job! You know this topic well!';
        if (score >= 70) return 'Good work! You are on the right track.';
        if (score >= 60) return 'Not bad! Keep practicing.';
        if (score >= 50) return 'You are getting there. More review needed.';
        return 'You might need more study time on this topic.';
    }
});
