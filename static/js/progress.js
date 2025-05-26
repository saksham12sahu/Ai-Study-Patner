document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const flashcardsCreated = document.getElementById('flashcards-created');
    const masteryRate = document.getElementById('mastery-rate');
    const quizzesCompleted = document.getElementById('quizzes-completed');
    const studyTime = document.getElementById('study-time');
    const topicsChart = document.getElementById('topics-chart');
    const quizChart = document.getElementById('quiz-chart');
    const noTopicsData = document.getElementById('no-topics-data');
    const noQuizData = document.getElementById('no-quiz-data');
    const recommendationsList = document.getElementById('recommendations-list');
    const noRecommendations = document.getElementById('no-recommendations');
    
    // Chart instances
    let topicsChartInstance = null;
    let quizChartInstance = null;
    
    // Load progress data when page loads
    loadProgressData();
    
    // Function to load progress data from API
    function loadProgressData() {
        fetch('/api/progress')
            .then(response => response.json())
            .then(data => {
                renderProgressData(data);
            })
            .catch(error => {
                console.error('Error loading progress data:', error);
                showToast('Failed to load progress data. Please try again.', 'danger');
            });
    }
    
    // Function to render progress data
    function renderProgressData(data) {
        // Key metrics
        if (flashcardsCreated) flashcardsCreated.textContent = data.raw_data.flashcards_created || 0;
        if (masteryRate) masteryRate.textContent = `${Math.round(data.metrics.mastery_rate || 0)}%`;
        if (quizzesCompleted) quizzesCompleted.textContent = data.raw_data.quizzes_completed || 0;
        if (studyTime) studyTime.textContent = data.metrics.total_study_time || 0;
        
        // Render topics chart
        renderTopicsChart(data.raw_data.topics_studied);
        
        // Render quiz scores chart
        renderQuizChart(data.raw_data.quiz_scores);
        
        // Render recommendations
        renderRecommendations(data.recommendations);
    }
    
    // Function to render topics studied chart
    function renderTopicsChart(topicsData) {
        if (!topicsChart) return;
        
        // Check if we have topic data
        const hasTopicData = Object.keys(topicsData || {}).length > 0;
        
        if (!hasTopicData) {
            // Show no data message
            if (noTopicsData) noTopicsData.classList.remove('d-none');
            return;
        }
        
        // Hide no data message
        if (noTopicsData) noTopicsData.classList.add('d-none');
        
        // Prepare data for chart
        const topics = Object.keys(topicsData);
        const times = Object.values(topicsData);
        
        // Destroy previous chart if it exists
        if (topicsChartInstance) {
            topicsChartInstance.destroy();
        }
        
        // Create color array with different colors for each topic
        const colors = generateChartColors(topics.length);
        
        // Create chart
        topicsChartInstance = new Chart(topicsChart, {
            type: 'pie',
            data: {
                labels: topics,
                datasets: [{
                    data: times,
                    backgroundColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: 'white'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const minutes = context.raw;
                                const hours = Math.floor(minutes / 60);
                                const mins = minutes % 60;
                                
                                if (hours > 0) {
                                    return `${context.label}: ${hours}h ${mins}m`;
                                } else {
                                    return `${context.label}: ${mins}m`;
                                }
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Function to render quiz scores chart
    function renderQuizChart(quizScores) {
        if (!quizChart) return;
        
        // Check if we have quiz data
        const hasQuizData = (quizScores || []).length > 0;
        
        if (!hasQuizData) {
            // Show no data message
            if (noQuizData) noQuizData.classList.remove('d-none');
            return;
        }
        
        // Hide no data message
        if (noQuizData) noQuizData.classList.add('d-none');
        
        // Prepare data for chart
        const labels = quizScores.map((_, index) => `Quiz ${index + 1}`);
        const scores = quizScores;
        
        // Destroy previous chart if it exists
        if (quizChartInstance) {
            quizChartInstance.destroy();
        }
        
        // Create chart
        quizChartInstance = new Chart(quizChart, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Quiz Scores',
                    data: scores,
                    fill: false,
                    borderColor: '#0dcaf0',
                    tension: 0.1,
                    pointBackgroundColor: '#0dcaf0',
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: 'white',
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Score: ${context.raw}%`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Function to render recommendations
    function renderRecommendations(recommendations) {
        if (!recommendationsList) return;
        
        // Check if we have recommendations
        const hasRecommendations = (recommendations || []).length > 0;
        
        if (!hasRecommendations) {
            // Show no recommendations message
            if (noRecommendations) noRecommendations.classList.remove('d-none');
            return;
        }
        
        // Hide no recommendations message
        if (noRecommendations) noRecommendations.classList.add('d-none');
        
        // Clear previous recommendations
        recommendationsList.innerHTML = '';
        
        // Add each recommendation
        recommendations.forEach((recommendation, index) => {
            const recommendationElement = document.createElement('div');
            recommendationElement.className = 'list-group-item bg-transparent recommendation-item py-3';
            
            // Create different icon for each recommendation
            const icons = ['lightbulb', 'chart-line', 'tasks', 'brain', 'book'];
            const iconIndex = index % icons.length;
            
            recommendationElement.innerHTML = `
                <div class="d-flex">
                    <div class="me-3 text-info">
                        <i class="fas fa-${icons[iconIndex]} fa-2x"></i>
                    </div>
                    <div>
                        <p class="mb-0">${recommendation}</p>
                    </div>
                </div>
            `;
            
            recommendationsList.appendChild(recommendationElement);
        });
    }
    
    // Helper function to generate chart colors
    function generateChartColors(count) {
        const baseColors = [
            '#0d6efd', // primary
            '#20c997', // teal
            '#0dcaf0', // info
            '#ffc107', // warning
            '#dc3545', // danger
            '#6f42c1', // purple
            '#fd7e14', // orange
            '#6610f2', // indigo
            '#198754', // success
            '#d63384'  // pink
        ];
        
        // If we need more colors than we have in baseColors
        if (count > baseColors.length) {
            // Generate additional colors by adjusting lightness
            const additionalColors = [];
            for (let i = 0; i < count - baseColors.length; i++) {
                const baseIndex = i % baseColors.length;
                
                // Convert hex to HSL, adjust lightness, convert back to hex
                const hsl = hexToHSL(baseColors[baseIndex]);
                hsl.l = Math.min(85, hsl.l + 10); // Increase lightness but keep under 85%
                
                additionalColors.push(hslToHex(hsl));
            }
            
            return [...baseColors, ...additionalColors];
        }
        
        // If we have enough base colors, just return what we need
        return baseColors.slice(0, count);
    }
    
    // Helper function to convert hex to HSL
    function hexToHSL(hex) {
        // Remove the # if present
        hex = hex.replace(/^#/, '');
        
        // Parse the RGB values
        let r = parseInt(hex.substring(0, 2), 16) / 255;
        let g = parseInt(hex.substring(2, 4), 16) / 255;
        let b = parseInt(hex.substring(4, 6), 16) / 255;
        
        // Find the max and min values
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        
        // Calculate HSL values
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            
            h /= 6;
        }
        
        return { h: h * 360, s: s * 100, l: l * 100 };
    }
    
    // Helper function to convert HSL to hex
    function hslToHex({ h, s, l }) {
        h /= 360;
        s /= 100;
        l /= 100;
        
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        // Convert to hex
        const toHex = x => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
});
