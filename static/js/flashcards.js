document.addEventListener('DOMContentLoaded', function() {
    const generateForm = document.getElementById('generate-form');
    const studyModeBtn = document.getElementById('study-mode-btn');
    const showAllBtn = document.getElementById('show-all-btn');
    const studyModeContainer = document.getElementById('study-mode-container');
    const gridViewContainer = document.getElementById('grid-view-container');
    const flashcardsContainer = document.getElementById('flashcards-container');
    const noFlashcardsContainer = document.getElementById('no-flashcards');
    const carouselInner = document.getElementById('carousel-cards');
    const masteryButtons = document.querySelectorAll('.mastery-btn');
    
    let currentFlashcards = [];
    let currentCardIndex = 0;
    
    // Load existing flashcards when page loads
    loadFlashcards('mathematics');
    
    // Handle form submission to generate flashcards
    if (generateForm) {
        generateForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const topic = document.getElementById('topic').value;
            const studyText = document.getElementById('studyText').value;
            
            if (!topic || !studyText) {
                showToast('Please enter both a topic and study text.', 'danger');
                return;
            }
            
            generateFlashcards(topic, studyText);
        });
    }
    
    // Switch between study mode and grid view
    if (studyModeBtn) {
        studyModeBtn.addEventListener('click', function() {
            if (currentFlashcards.length === 0) {
                showToast('No flashcards available for study mode.', 'warning');
                return;
            }
            
            setupStudyMode();
            studyModeContainer.classList.remove('d-none');
            gridViewContainer.classList.add('d-none');
        });
    }
    
    if (showAllBtn) {
        showAllBtn.addEventListener('click', function() {
            studyModeContainer.classList.add('d-none');
            gridViewContainer.classList.remove('d-none');
        });
    }
    
    // Handle mastery level buttons
    if (masteryButtons) {
        masteryButtons.forEach(button => {
            button.addEventListener('click', function() {
                const level = parseInt(this.getAttribute('data-level'));
                if (currentFlashcards.length === 0 || currentCardIndex >= currentFlashcards.length) {
                    return;
                }
                
                const cardId = currentFlashcards[currentCardIndex].id;
                updateFlashcardMastery(cardId, level);
                
                // Visual feedback
                masteryButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // Move to next card after a short delay
                setTimeout(() => {
                    const carousel = document.getElementById('flashcardCarousel');
                    const bsCarousel = bootstrap.Carousel.getInstance(carousel);
                    bsCarousel.next();
                }, 500);
            });
        });
    }
    
    // Function to load existing flashcards
    function loadFlashcards(topic = 'mathematics') {
        // Only load flashcards from the last 6 hours
        const cutoffTime = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        fetch(`/api/flashcards?topic=${encodeURIComponent(topic)}&since=${encodeURIComponent(cutoffTime)}`)
            .then(response => response.json())
            .then(data => {
                console.log('Raw fetched flashcards:', data);
                // Filter out fallbacks and limit to 5
                currentFlashcards = data
                    .filter(card => !card.answer.startsWith('Important concept related to'))
                    .slice(0, 5);
                console.log('Filtered flashcards:', currentFlashcards);
                
                if (currentFlashcards.length > 0) {
                    flashcardsContainer.classList.remove('d-none');
                    noFlashcardsContainer.classList.add('d-none');
                    renderFlashcardsGrid(currentFlashcards);
                } else {
                    flashcardsContainer.classList.add('d-none');
                    noFlashcardsContainer.classList.remove('d-none');
                }
                
                // Clean up old fallbacks
                cleanupOldFlashcards(topic);
            })
            .catch(error => {
                console.error('Error loading flashcards:', error);
                showToast('Failed to load flashcards. Please try again.', 'danger');
            });
    }
    
    // Function to clean up old fallbacks
    function cleanupOldFlashcards(topic) {
        fetch('/api/flashcards/cleanup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ topic })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(`Cleaned up ${data.deleted_count} old flashcards`);
            } else {
                console.warn('Cleanup failed:', data.error);
            }
        })
        .catch(error => {
            console.error('Error cleaning up flashcards:', error);
        });
    }
    
    // Function to generate flashcards
    function generateFlashcards(topic, studyText) {
        showSpinner('generate-btn', 'generate-spinner');
        
        fetch('/api/flashcards/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                topic: topic,
                text: studyText
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            hideSpinner('generate-btn', 'generate-spinner');
            
            if (data.error) {
                showToast(data.error, 'danger');
                return;
            }
            
            // Use only the new flashcards
            currentFlashcards = data.filter(
                card => !card.answer.startsWith('Important concept related to')
            ).slice(0, 5);
            console.log('Generated flashcards:', currentFlashcards);
            
            // Show success message
            showToast(`Successfully generated ${currentFlashcards.length} flashcards!`, 'success');
            
            // Clear form
            document.getElementById('topic').value = '';
            document.getElementById('studyText').value = '';
            
            // Show flashcards container and hide no-flashcards message
            flashcardsContainer.classList.remove('d-none');
            noFlashcardsContainer.classList.add('d-none');
            
            // Render the new flashcards
            renderFlashcardsGrid(currentFlashcards);
        })
        .catch(error => {
            hideSpinner('generate-btn', 'generate-spinner');
            console.error('Error generating flashcards:', error);
            showToast('Failed to generate flashcards. Please try again.', 'danger');
        });
    }
    
    // Function to render flashcards in grid view
    function renderFlashcardsGrid(flashcards) {
        if (!gridViewContainer) return;
        
        gridViewContainer.innerHTML = ''; // Clear existing content
        console.log('Rendering flashcards:', flashcards);
        
        flashcards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'col';
            
            // Determine mastery level class
            let masteryClass = 'bg-danger';
            if (card.mastery_level >= 80) {
                masteryClass = 'bg-success';
            } else if (card.mastery_level >= 40) {
                masteryClass = 'bg-warning';
            }
            
            cardElement.innerHTML = `
                <div class="card h-100 shadow-sm flashcard" data-id="${card.id}">
                    <div class="flashcard-inner">
                        <div class="flashcard-front">
                            <h5>${card.question}</h5>
                            <small class="text-muted">${card.topic}</small>
                            <div class="mastery-indicator">
                                <div class="progress" style="height: 8px;">
                                    <div class="progress-bar ${masteryClass}" role="progressbar" 
                                        style="width: ${card.mastery_level}%" 
                                        aria-valuenow="${card.mastery_level}" 
                                        aria-valuemin="0" 
                                        aria-valuemax="100"></div>
                                </div>
                            </div>
                        </div>
                        <div class="flashcard-back">
                            <p>${card.answer}</p>
                            <small class="text-muted">${card.topic}</small>
                            <div class="mastery-indicator">
                                <div class="progress" style="height: 8px;">
                                    <div class="progress-bar ${masteryClass}" role="progressbar" 
                                        style="width: ${card.mastery_level}%" 
                                        aria-valuenow="${card.mastery_level}" 
                                        aria-valuemin="0" 
                                        aria-valuemax="100"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            gridViewContainer.appendChild(cardElement);
            
            // Add click event to flip card
            const flashcard = cardElement.querySelector('.flashcard');
            flashcard.addEventListener('click', function() {
                this.classList.toggle('flipped');
            });
        });
    }
    
    // Function to setup study mode
    function setupStudyMode() {
        if (!carouselInner) return;
        
        carouselInner.innerHTML = ''; // Clear existing content
        currentCardIndex = 0;
        
        currentFlashcards.forEach((card, index) => {
            const isActive = index === 0 ? 'active' : '';
            
            // Determine mastery level class
            let masteryClass = 'bg-danger';
            if (card.mastery_level >= 80) {
                masteryClass = 'bg-success';
            } else if (card.mastery_level >= 40) {
                masteryClass = 'bg-warning';
            }
            
            const cardElement = document.createElement('div');
            cardElement.className = `carousel-item ${isActive}`;
            cardElement.innerHTML = `
                <div class="d-flex justify-content-center">
                    <div class="flashcard" data-id="${card.id}">
                        <div class="flashcard-inner">
                            <div class="flashcard-front">
                                <h4>${card.question}</h4>
                                <small class="text-muted">${card.topic}</small>
                                <div class="mastery-indicator">
                                    <div class="progress" style="height: 8px;">
                                        <div class="progress-bar ${masteryClass}" role="progressbar" 
                                            style="width: ${card.mastery_level}%" 
                                            aria-valuenow="${card.mastery_level}" 
                                            aria-valuemin="0" 
                                            aria-valuemax="100"></div>
                                </div>
                            </div>
                            <div class="flashcard-back">
                                <p>${card.answer}</p>
                                <small class="text-muted">${card.topic}</small>
                                <div class="mastery-indicator">
                                    <div class="progress" style="height: 8px;">
                                        <div class="progress-bar ${masteryClass}" role="progressbar" 
                                        style="width: ${card.mastery_level}%" 
                                        aria-valuenow="${card.mastery_level}" 
                                        aria-valuemin="0" 
                                        aria-valuemax="100"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            carouselInner.appendChild(cardElement);
            
            // Add click event to flip card
            const flashcard = cardElement.querySelector('.flashcard');
            flashcard.addEventListener('click', function() {
                this.classList.toggle('flipped');
            });
        });
        
        // Initialize carousel
        const carousel = document.getElementById('flashcardCarousel');
        const bsCarousel = new bootstrap.Carousel(carousel, {
            interval: false,
            wrap: false
        });
        
        // Listen for carousel changes to update current card index
        carousel.addEventListener('slid.bs.carousel', function(event) {
            currentCardIndex = event.to;
            
            // Reset active states on mastery buttons
            masteryButtons.forEach(btn => btn.classList.remove('active'));
            
            // Update active state based on current card's mastery level
            if (currentFlashcards[currentCardIndex]) {
                const level = currentFlashcards[currentCardIndex].mastery_level;
                masteryButtons.forEach(btn => {
                    const btnLevel = parseInt(btn.getAttribute('data-level'));
                    if (btnLevel === level) {
                        btn.classList.add('active');
                    }
                });
            }
        });
    }
    
    // Function to update flashcard mastery level
    function updateFlashcardMastery(cardId, level) {
        fetch(`/api/flashcards/${cardId}/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mastery_level: level
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showToast(data.error, 'danger');
                return;
            }
            
            // Update card in current flashcards
            const cardIndex = currentFlashcards.findIndex(card => card.id === cardId);
            if (cardIndex !== -1) {
                currentFlashcards[cardIndex].mastery_level = level;
                currentFlashcards[cardIndex].last_reviewed = data.last_reviewed;
            }
        })
        .catch(error => {
            console.error('Error updating flashcard mastery:', error);
            showToast('Failed to update mastery level. Please try again.', 'danger');
        });
    }
});
