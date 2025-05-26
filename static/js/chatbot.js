document.addEventListener('DOMContentLoaded', function() {
    const chatForm = document.getElementById('chat-form');
    const userMessageInput = document.getElementById('user-message');
    const chatMessages = document.getElementById('chat-messages');
    const exampleQuestions = document.querySelectorAll('.example-question');
    const setTopicBtn = document.getElementById('set-topic-btn');
    const currentTopicInput = document.getElementById('current-topic');
    
    let currentTopic = '';
    
    // Handle form submission
    if (chatForm) {
        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const message = userMessageInput.value.trim();
            if (!message) return;
            
            // Add user message to chat
            addUserMessage(message);
            
            // Clear input
            userMessageInput.value = '';
            
            // Show typing indicator
            showTypingIndicator();
            
            // Get response from AI tutor
            askAITutor(message, currentTopic);
        });
    }
    
    // Handle example question clicks
    if (exampleQuestions) {
        exampleQuestions.forEach(question => {
            question.addEventListener('click', function() {
                const questionText = this.getAttribute('data-question');
                userMessageInput.value = questionText;
                userMessageInput.focus();
            });
        });
    }
    
    // Handle set topic button
    if (setTopicBtn) {
        setTopicBtn.addEventListener('click', function() {
            const topic = currentTopicInput.value.trim();
            if (topic) {
                currentTopic = topic;
                showToast(`Topic set to: ${topic}`, 'success');
                
                // Add system message about topic
                addSystemMessage(`Topic set to: ${topic}`);
            } else {
                currentTopic = '';
                showToast('Topic cleared', 'info');
            }
        });
    }
    
    // Function to add user message to chat
    function addUserMessage(message) {
        if (!chatMessages) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = 'd-flex justify-content-end mb-3';
        messageElement.innerHTML = `
            <div class="message message-user">
                <div class="message-markdown">
                    ${message}
                </div>
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to add AI response to chat
    function addAIMessage(message) {
        if (!chatMessages) return;
        
        // Remove typing indicator if exists
        const typingIndicator = document.querySelector('.typing-indicator-container');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = 'message-wrapper';
        
        // Format message with markdown parser
        const formattedMessage = parseMarkdown(message);
        
        messageElement.innerHTML = `
            <div class="bot-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="message message-bot">
                    <div class="message-markdown">
                        ${formattedMessage}
                    </div>
                </div>
                <div class="message-time">Just now</div>
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to add system message to chat
    function addSystemMessage(message) {
        if (!chatMessages) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = 'd-flex justify-content-center mb-3';
        messageElement.innerHTML = `
            <div class="bg-dark text-light px-3 py-1 rounded-pill small">
                <i class="fas fa-info-circle me-1"></i> ${message}
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to show typing indicator
    function showTypingIndicator() {
        if (!chatMessages) return;
        
        const indicatorElement = document.createElement('div');
        indicatorElement.className = 'message-wrapper typing-indicator-container';
        indicatorElement.innerHTML = `
            <div class="bot-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        chatMessages.appendChild(indicatorElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to ask AI tutor
    function askAITutor(question, topic) {
        fetch('/api/chatbot/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: question,
                context: '',
                topic: topic
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
                addAIMessage(`Error: ${data.error}`);
                return;
            }
            
            // Add AI response to chat
            addAIMessage(data.answer);
        })
        .catch(error => {
            console.error('Error getting AI tutor response:', error);
            
            // Remove typing indicator
            const typingIndicator = document.querySelector('.typing-indicator-container');
            if (typingIndicator) {
                typingIndicator.remove();
            }
            
            // Add error message
            addAIMessage('Sorry, I encountered an error while processing your request. Please try again.');
        });
    }
});
