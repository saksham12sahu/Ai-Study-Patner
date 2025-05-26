document.addEventListener('DOMContentLoaded', function() {
    const studyPlanForm = document.getElementById('study-plan-form');
    const taskContainer = document.getElementById('tasks-container');
    const addTaskBtn = document.getElementById('add-task-btn');
    const plansList = document.getElementById('plans-list');
    const noPlans = document.getElementById('no-plans');
    const planDetailModal = new bootstrap.Modal(document.getElementById('planDetailModal'));
    
    let currentPlans = [];
    
    // Load existing study plans
    loadStudyPlans();
    
    // Setup initial task
    if (taskContainer && taskContainer.children.length === 0) {
        addTaskInput();
    }
    
    // Handle add task button
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', function() {
            addTaskInput();
        });
    }
    
    // Handle form submission to create plan
    if (studyPlanForm) {
        studyPlanForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const title = document.getElementById('plan-title').value;
            const date = document.getElementById('plan-date').value;
            
            if (!title || !date) {
                showToast('Please enter both a title and date for your study plan.', 'danger');
                return;
            }
            
            // Collect tasks
            const tasks = [];
            const taskTitles = document.querySelectorAll('.task-title');
            const taskDurations = document.querySelectorAll('.task-duration');
            
            // Validate at least one task
            if (taskTitles.length === 0) {
                showToast('Please add at least one task to your study plan.', 'danger');
                return;
            }
            
            for (let i = 0; i < taskTitles.length; i++) {
                const taskTitle = taskTitles[i].value;
                const taskDuration = parseInt(taskDurations[i].value);
                
                if (taskTitle && taskDuration) {
                    tasks.push({
                        title: taskTitle,
                        duration_minutes: taskDuration
                    });
                }
            }
            
            if (tasks.length === 0) {
                showToast('Please add at least one valid task with a title and duration.', 'danger');
                return;
            }
            
            createStudyPlan(title, date, tasks);
        });
    }
    
    // Delegate event handler for remove task buttons
    if (taskContainer) {
        taskContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('remove-task') || e.target.closest('.remove-task')) {
                const taskGroup = e.target.closest('.task-input-group');
                
                // Don't remove if it's the last one
                if (taskContainer.children.length > 1) {
                    taskGroup.remove();
                } else {
                    showToast('You need at least one task in your study plan.', 'warning');
                }
            }
        });
    }
    
    // Function to load existing study plans
    function loadStudyPlans() {
        fetch('/api/planner/plans')
            .then(response => response.json())
            .then(data => {
                currentPlans = data;
                
                if (data.length > 0) {
                    if (noPlans) noPlans.classList.add('d-none');
                    if (plansList) renderPlansList(data);
                } else {
                    if (noPlans) noPlans.classList.remove('d-none');
                }
            })
            .catch(error => {
                console.error('Error loading study plans:', error);
                showToast('Failed to load study plans. Please try again.', 'danger');
            });
    }
    
    // Function to add a new task input
    function addTaskInput() {
        if (!taskContainer) return;
        
        const taskInputGroup = document.createElement('div');
        taskInputGroup.className = 'task-input-group mb-2';
        taskInputGroup.innerHTML = `
            <div class="input-group">
                <input type="text" class="form-control task-title" 
                    placeholder="Task title" required>
                <input type="number" class="form-control task-duration" 
                    placeholder="Minutes" min="5" max="180" value="30" required>
                <button type="button" class="btn btn-outline-danger remove-task">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        taskContainer.appendChild(taskInputGroup);
    }
    
    // Function to create a study plan
    function createStudyPlan(title, date, tasks) {
        const createBtn = document.getElementById('create-plan-btn');
        if (createBtn) createBtn.disabled = true;
        
        fetch('/api/planner/plans', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                date: date,
                tasks: tasks
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Server error');
            }
            return response.json();
        })
        .then(data => {
            if (createBtn) createBtn.disabled = false;
            
            if (data.error) {
                showToast(data.error, 'danger');
                return;
            }
            
            // Add to current plans
            currentPlans.push(data);
            
            // Show success message
            showToast(`Successfully created study plan: ${title}!`, 'success');
            
            // Clear form
            document.getElementById('plan-title').value = '';
            document.getElementById('plan-date').value = '';
            
            // Reset tasks to just one
            if (taskContainer) {
                taskContainer.innerHTML = '';
                addTaskInput();
            }
            
            // Hide no plans message
            if (noPlans) noPlans.classList.add('d-none');
            
            // Update the plans list
            if (plansList) renderPlansList(currentPlans);
        })
        .catch(error => {
            if (createBtn) createBtn.disabled = false;
            console.error('Error creating study plan:', error);
            showToast('Failed to create study plan. Please try again.', 'danger');
        });
    }
    
    // Function to render plans list
    function renderPlansList(plans) {
        if (!plansList) return;
        
        plansList.innerHTML = '';
        
        // Sort plans by date (newest first)
        plans.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        plans.forEach(plan => {
            const completedTasks = plan.tasks.filter(task => task.completed).length;
            const totalTasks = plan.tasks.length;
            const progressPercent = Math.round((completedTasks / totalTasks) * 100) || 0;
            
            // Calculate total duration
            const totalDuration = plan.tasks.reduce((total, task) => total + task.duration_minutes, 0);
            
            // Format date to be more readable
            const planDate = new Date(plan.date);
            const formattedDate = planDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            // Determine if the plan is today, upcoming, or past
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const planDay = new Date(plan.date);
            planDay.setHours(0, 0, 0, 0);
            
            let statusBadge = '';
            if (planDay.getTime() === today.getTime()) {
                statusBadge = '<span class="badge bg-primary ms-2">Today</span>';
            } else if (planDay > today) {
                statusBadge = '<span class="badge bg-info ms-2">Upcoming</span>';
            } else {
                statusBadge = '<span class="badge bg-secondary ms-2">Past</span>';
            }
            
            // Create plan element
            const planElement = document.createElement('a');
            planElement.href = '#';
            planElement.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center plan-card';
            planElement.setAttribute('data-plan-id', plan.id);
            planElement.innerHTML = `
                <div>
                    <h5 class="mb-1">${plan.title} ${statusBadge}</h5>
                    <p class="mb-1 text-muted">${formattedDate}</p>
                    <div class="text-muted small">
                        <i class="fas fa-tasks me-1"></i> ${completedTasks}/${totalTasks} tasks completed
                    </div>
                    <div class="progress mt-2" style="height: 5px; width: 200px;">
                        <div class="progress-bar ${progressPercent === 100 ? 'bg-success' : 'bg-primary'}" 
                            role="progressbar" style="width: ${progressPercent}%;" 
                            aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                </div>
                <div class="text-end">
                    <div class="text-muted mb-2">
                        <i class="far fa-clock me-1"></i> ${totalDuration} min
                    </div>
                    <button class="btn btn-sm btn-outline-primary view-plan" data-plan-id="${plan.id}">
                        <i class="fas fa-eye me-1"></i> View
                    </button>
                </div>
            `;
            
            plansList.appendChild(planElement);
            
            // Add click event for the plan
            planElement.addEventListener('click', function(e) {
                e.preventDefault();
                const planId = this.getAttribute('data-plan-id');
                openPlanDetail(planId);
            });
        });
    }
    
    // Function to open plan detail modal
    function openPlanDetail(planId) {
        const plan = currentPlans.find(p => p.id === planId);
        if (!plan) {
            showToast('Plan not found.', 'danger');
            return;
        }
        
        // Set plan details in modal
        const planDetailTitle = document.getElementById('plan-detail-title');
        const planDetailDate = document.getElementById('plan-detail-date');
        const planProgress = document.getElementById('plan-progress');
        const planTasksList = document.getElementById('plan-tasks-list');
        const totalDuration = document.getElementById('total-duration');
        const completionStatus = document.getElementById('completion-status');
        
        if (planDetailTitle) planDetailTitle.textContent = plan.title;
        
        if (planDetailDate) {
            const planDate = new Date(plan.date);
            planDetailDate.textContent = planDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
        
        // Calculate progress
        const completedTasks = plan.tasks.filter(task => task.completed).length;
        const totalTasks = plan.tasks.length;
        const progressPercent = Math.round((completedTasks / totalTasks) * 100) || 0;
        
        if (planProgress) {
            planProgress.style.width = `${progressPercent}%`;
            planProgress.textContent = `${progressPercent}%`;
            planProgress.setAttribute('aria-valuenow', progressPercent);
            
            // Set color based on progress
            planProgress.className = 'progress-bar';
            if (progressPercent === 100) {
                planProgress.classList.add('bg-success');
            } else if (progressPercent >= 50) {
                planProgress.classList.add('bg-primary');
            } else if (progressPercent >= 25) {
                planProgress.classList.add('bg-info');
            } else if (progressPercent > 0) {
                planProgress.classList.add('bg-warning');
            } else {
                planProgress.classList.add('bg-secondary');
            }
        }
        
        // Render tasks
        if (planTasksList) {
            planTasksList.innerHTML = '';
            
            plan.tasks.forEach(task => {
                const taskElement = document.createElement('div');
                taskElement.className = `list-group-item d-flex justify-content-between align-items-center ${task.completed ? 'completed-task' : ''}`;
                
                const durationBadge = `<span class="badge bg-secondary ms-2">${task.duration_minutes} min</span>`;
                
                taskElement.innerHTML = `
                    <div class="d-flex align-items-center">
                        <div class="form-check me-2">
                            <input class="form-check-input task-toggle" type="checkbox" 
                                value="" id="task-${task.id}" ${task.completed ? 'checked' : ''} 
                                data-task-id="${task.id}">
                            <label class="form-check-label" for="task-${task.id}">
                                ${task.title} ${durationBadge}
                            </label>
                        </div>
                    </div>
                `;
                
                planTasksList.appendChild(taskElement);
                
                // Add event listener for task toggling
                const checkbox = taskElement.querySelector('.task-toggle');
                if (checkbox) {
                    checkbox.addEventListener('change', function() {
                        const taskId = this.getAttribute('data-task-id');
                        toggleTask(taskId, planId);
                    });
                }
            });
        }
        
        // Set total duration
        if (totalDuration) {
            const totalMinutes = plan.tasks.reduce((total, task) => total + task.duration_minutes, 0);
            totalDuration.innerHTML = `<i class="far fa-clock me-1"></i> Total: <strong>${totalMinutes} minutes</strong>`;
        }
        
        // Set completion status
        if (completionStatus) {
            if (plan.completed) {
                completionStatus.innerHTML = '<span class="badge bg-success"><i class="fas fa-check me-1"></i> Completed</span>';
            } else {
                completionStatus.innerHTML = '<span class="badge bg-warning"><i class="fas fa-hourglass-half me-1"></i> In Progress</span>';
            }
        }
        
        // Show modal
        planDetailModal.show();
    }
    
    // Function to toggle task completion
    function toggleTask(taskId, planId) {
        fetch(`/api/planner/tasks/${taskId}/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
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
            
            // Update task in current plans
            const planIndex = currentPlans.findIndex(p => p.id === planId);
            if (planIndex !== -1) {
                const taskIndex = currentPlans[planIndex].tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    currentPlans[planIndex].tasks[taskIndex].completed = data.task.completed;
                }
                
                // Update plan completion status
                currentPlans[planIndex].completed = data.plan_completed;
                
                // Update UI
                renderPlansList(currentPlans);
                
                // If modal is open, update task display
                const openTaskElement = document.querySelector(`.task-toggle[data-task-id="${taskId}"]`);
                if (openTaskElement) {
                    const listItem = openTaskElement.closest('.list-group-item');
                    if (data.task.completed) {
                        listItem.classList.add('completed-task');
                    } else {
                        listItem.classList.remove('completed-task');
                    }
                    
                    // Update progress bar
                    const planElement = currentPlans[planIndex];
                    const completedTasks = planElement.tasks.filter(t => t.completed).length;
                    const totalTasks = planElement.tasks.length;
                    const progressPercent = Math.round((completedTasks / totalTasks) * 100) || 0;
                    
                    const progressBar = document.getElementById('plan-progress');
                    if (progressBar) {
                        progressBar.style.width = `${progressPercent}%`;
                        progressBar.textContent = `${progressPercent}%`;
                        progressBar.setAttribute('aria-valuenow', progressPercent);
                        
                        // Update color
                        progressBar.className = 'progress-bar';
                        if (progressPercent === 100) {
                            progressBar.classList.add('bg-success');
                        } else if (progressPercent >= 50) {
                            progressBar.classList.add('bg-primary');
                        } else if (progressPercent >= 25) {
                            progressBar.classList.add('bg-info');
                        } else if (progressPercent > 0) {
                            progressBar.classList.add('bg-warning');
                        } else {
                            progressBar.classList.add('bg-secondary');
                        }
                    }
                    
                    // Update completion status
                    const completionStatus = document.getElementById('completion-status');
                    if (completionStatus) {
                        if (data.plan_completed) {
                            completionStatus.innerHTML = '<span class="badge bg-success"><i class="fas fa-check me-1"></i> Completed</span>';
                            showToast('Congratulations! You\'ve completed this study plan.', 'success');
                        } else {
                            completionStatus.innerHTML = '<span class="badge bg-warning"><i class="fas fa-hourglass-half me-1"></i> In Progress</span>';
                        }
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error toggling task:', error);
            showToast('Failed to update task status. Please try again.', 'danger');
        });
    }
});
