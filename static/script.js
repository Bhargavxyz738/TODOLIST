
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = '';
    const dom = {
        loginContainer: document.getElementById('login-container'),
        signupContainer: document.getElementById('signup-step2-container'),
        loginForm: document.getElementById('login-form'),
        signupForm: document.getElementById('signup-step2-form'),
        usernameInput: document.getElementById('username'),
        passwordInput: document.getElementById('password'),
        loginMessageArea: document.getElementById('login-message-area'),
        mainAppContainer: document.getElementById('main-app-container'),
        dashboardPage: document.getElementById('dashboard-page'),
        tasksPage: document.getElementById('tasks-page'),
        navDashboard: document.getElementById('nav-dashboard'),
        navTasks: document.getElementById('nav-tasks'),
        logoutButton: document.getElementById('logout-button'),
        userPoints: document.getElementById('user-points'),
        profileNameTopbar: document.getElementById('profile-name-topbar'),
        profilePicTopbar: document.getElementById('profile-pic-topbar'),
        editProfileBtn: document.getElementById('edit-profile-btn'),
        themeToggle: document.getElementById('theme-toggle-checkbox'),
        commentsContainer: document.getElementById('comments-container'),
        newCommentTextarea: document.getElementById('new-comment-textarea'),
        postCommentButton: document.getElementById('post-comment-button'),
        leaderboardListWrapper: document.getElementById('leaderboard-list-wrapper'),
        leaderboardList: document.getElementById('leaderboard-list'),
        addTaskForm: document.getElementById('add-task-form'),
        newTaskInput: document.getElementById('new-task-input'),
        taskListWrapper: document.getElementById('task-list-wrapper'),
        taskList: document.getElementById('task-list'),
        editProfileModal: document.getElementById('edit-profile-modal'),
        editProfileForm: document.getElementById('edit-profile-form'),
        editUsernameInput: document.getElementById('edit-username'),
        editPasswordInput: document.getElementById('edit-password'),
        editProfileMessageArea: document.getElementById('edit-profile-message-area'),
        closeModalBtn: document.querySelector('.close-modal-btn'),
        toastContainer: document.getElementById('toast-notification-container'),
        progressGraphCanvas: document.getElementById('progress-graph'),
        progressGraphPlaceholder: document.getElementById('progress-graph-placeholder'),
        profilePicPreview: document.getElementById('profile-pic-preview'),
        profilePicUploadZone: document.getElementById('profile-picture-upload-zone'),
        profilePicInput: document.getElementById('profile-picture-input'),
        editProfilePicPreview: document.getElementById('edit-profile-pic-preview'),
        editProfilePicInput: document.getElementById('edit-profile-pic-input'),
        hamburgerMenu: document.querySelector('.hamburger-menu'),
        sidebar: document.querySelector('.sidebar'),
    };
    const appState = { token: null, username: null, password_temp: null, currentPage: 'dashboard', theme: 'light', pollingIntervalId: null, chartInstance: null, userProfilePhoto: 'default_dp.png' };
    const apiService = {
        async request(endpoint, method, body = null, isProtected = false) {
            const headers = new Headers({ 'Content-Type': 'application/json' });
            if (isProtected && appState.token) headers.append('Authorization', `Bearer ${appState.token}`);
            const config = { method, headers, body: body ? JSON.stringify(body) : null };
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            const data = await response.json().catch(() => ({}));
            if (!response.ok) { const error = new Error(data.error || 'An unknown error occurred.'); error.status = response.status; throw error; }
            return data;
        },
        async fileUploadRequest(endpoint, file) {
            const formData = new FormData();
            formData.append('profile_pic', file);
            const headers = new Headers();
            if (appState.token) headers.append('Authorization', `Bearer ${appState.token}`);
            const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'POST', headers, body: formData });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'File upload failed');
            return data;
        },
        addUser: (username, password) => apiService.request('/add_user', 'POST', { username, password }),
        login: (username, password) => apiService.request('/login', 'POST', { username, password }),
        logout: () => apiService.request('/logout', 'POST', null, true),
        getMyPoints: () => apiService.request('/get_my_points', 'GET', null, true),
        getPoints: () => apiService.request('/get_points', 'GET'),
        getComments: () => apiService.request('/get_comments', 'GET'),
        getMyTasks: () => apiService.request('/get_my_tasks', 'GET', null, true),
        getTaskHistory: () => apiService.request('/get_task_history', 'GET', null, true),
        addTask: (task_text) => apiService.request('/add_task', 'POST', { task_text }, true),
        updateTask: (task_id, completed) => apiService.request('/update_task', 'POST', { task_id, completed }, true),
        deleteTask: (task_id) => apiService.request('/update_task', 'DELETE', { task_id }, true),
        addComment: (text) => apiService.request('/add_comment', 'POST', { text }, true),
        updateUsername: (new_username) => apiService.request('/update_username', 'POST', {new_username}, true),
        updatePassword: (new_password) => apiService.request('/update_password', 'POST', { new_password }, true),
        uploadProfilePicture: (file) => apiService.fileUploadRequest('/upload_profile_picture', file),
    };
    const uiModule = {
        showPage(pageName) {
            appState.currentPage = pageName;
            const pages = { dashboard: dom.dashboardPage, tasks: dom.tasksPage };
            const navs = { dashboard: dom.navDashboard, tasks: dom.navTasks };
            Object.values(pages).forEach(p => p.classList.add('hidden'));
            Object.values(navs).forEach(n => n.classList.remove('active'));
            pages[pageName].classList.remove('hidden');
            navs[pageName].classList.add('active');
            dom.sidebar.classList.remove('is-open');
        },
        renderUserProfile() {
            dom.profileNameTopbar.textContent = appState.username;
            const photoPath = appState.userProfilePhoto === 'default_dp.png' ? `/static/default_dp.png` : `/static/${appState.userProfilePhoto}`;
            dom.profilePicTopbar.src = photoPath;
            dom.editProfilePicPreview.src = photoPath;
        },
        renderLeaderboard(leaderboardData) {
            dom.leaderboardList.innerHTML = '';
            if (!leaderboardData || leaderboardData.length === 0) {
                dom.leaderboardList.innerHTML = `<li class="empty-state-message">No players yet!</li>`;
                return;
            }
            leaderboardData.forEach((user, index) => {
                const li = document.createElement('li');
                const photoPath = user.profile_photo === 'default_dp.png' ? `/static/default_dp.png` : `/static/${user.profile_photo}`;
                li.innerHTML = `
                    <span class="leaderboard-rank">${index + 1}</span>
                    <div class="leaderboard-user">
                        <img src="${photoPath}" alt="${user.username}" class="leaderboard-dp">
                        <span class="leaderboard-name">${user.username}</span>
                    </div>
                    <span class="leaderboard-points">${user.points} pts</span>`;
                dom.leaderboardList.appendChild(li);
            });
        },
        renderComments(comments) {
            dom.commentsContainer.innerHTML = '';
            if (!comments || comments.length === 0) {
                dom.commentsContainer.innerHTML = `<p class="empty-state-message">No comments yet. Be the first!</p>`;
                return;
            }
            comments.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            comments.forEach(comment => {
                const card = document.createElement('div');
                card.className = 'comment-card';
                const photoPath = comment.profile_photo === 'default_dp.png' ? `/static/default_dp.png` : `/static/${comment.profile_photo}`;
                card.innerHTML = `
                    <div class="comment-author">
                        <img src="${photoPath}" alt="${comment.username}" class="comment-dp">
                        <strong class="comment-author-name">${comment.username}</strong>
                    </div>
                    <div class="comment-body"><p>${comment.text}</p></div>`;
                dom.commentsContainer.appendChild(card);
            });
        },
        renderTasks(tasks) {
            uiModule.toggleLoading(dom.taskListWrapper, false);
            dom.taskList.innerHTML = '';
            if (!tasks || tasks.length === 0) {
                dom.taskList.innerHTML = `<li class="empty-state-message">No tasks for today. Add one!</li>`;
            } else {
                tasks.forEach(task => {
                    const li = document.createElement('li');
                    li.dataset.taskId = task.id;
                    li.className = task.completed ? 'completed' : '';
                    li.innerHTML = `
                        <div class="task-checkbox-wrapper">
                            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                            <div class="custom-checkbox"><i class="ri-check-line"></i></div>
                        </div>
                        <span>${task.text}</span>
                        <button class="delete-task-btn"><i class="ri-delete-bin-line"></i></button>`;
                    dom.taskList.appendChild(li);
                });
            }
            const canAddTask = tasks.length < 6;
            dom.newTaskInput.disabled = !canAddTask;
            dom.addTaskForm.querySelector('button').disabled = !canAddTask;
            dom.newTaskInput.placeholder = canAddTask ? 'What do you need to do?' : 'Maximum tasks for today reached.';
        },
        renderProgressGraph(historyData) {
            if (appState.chartInstance) appState.chartInstance.destroy();
            const labels = Object.keys(historyData).sort();
            const dataPoints = labels.map(label => historyData[label]);
            if (dataPoints.every(p => p === 0)) {
                dom.progressGraphPlaceholder.classList.remove('hidden');
                dom.progressGraphCanvas.classList.add('hidden');
                return;
            }
            dom.progressGraphPlaceholder.classList.add('hidden');
            dom.progressGraphCanvas.classList.remove('hidden');
            const ctx = dom.progressGraphCanvas.getContext('2d');
            appState.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels.map(l => new Date(l + 'T00:00:00').toLocaleDateString(undefined, {month: 'short', day: 'numeric'})),
                    datasets: [{
                        label: 'Tasks Completed', data: dataPoints, borderColor: 'var(--accent-color)',
                        backgroundColor: 'rgba(74, 109, 255, 0.1)', fill: true, tension: 0.3, borderWidth: 2,
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });
        },
        toggleLoading(wrapper, isLoading) {
            if(!wrapper) return;
            const spinner = wrapper.querySelector('.loading-spinner');
            if (spinner) spinner.style.display = isLoading ? 'block' : 'none';
        },
        showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            dom.toastContainer.appendChild(toast);
            setTimeout(() => { toast.remove(); }, 3000);
        },
        setTheme(theme) {
            document.body.dataset.theme = theme;
            appState.theme = theme;
            localStorage.setItem('prodcomp_theme', theme);
            dom.themeToggle.checked = (theme === 'dark');
        }
    };
    async function handleLoginOrSignup(event) {
        event.preventDefault();
        dom.loginMessageArea.textContent = '';
        const username = dom.usernameInput.value.trim();
        const password = dom.passwordInput.value.trim();
        if (!username || !password) return;
        try {
            const data = await apiService.login(username, password);
            appState.token = data.session_token;
            appState.username = username;
            appState.userProfilePhoto = data.profile_photo;
            localStorage.setItem('prodcomp_token', appState.token);
            localStorage.setItem('prodcomp_username', appState.username);
            localStorage.setItem('prodcomp_photo', appState.userProfilePhoto);
            loadMainApplication();
        } catch (error) {
            if (error.status === 404) {
                appState.username_temp = username;
                appState.password_temp = password;
                dom.loginContainer.classList.add('hidden');
                dom.signupContainer.classList.remove('hidden');
            } else {
                dom.loginMessageArea.textContent = error.message;
            }
        }
    }
    async function handleSignupCompletion(event) {
        event.preventDefault();
        const submitBtn = dom.signupForm.querySelector('button');
        submitBtn.disabled = true;
        try {
            const userData = await apiService.addUser(appState.username_temp, appState.password_temp);
            appState.token = userData.session_token;
            appState.username = appState.username_temp;
            const file = dom.profilePicInput.files[0];
            if (file) {
                const uploadData = await apiService.uploadProfilePicture(file);
                appState.userProfilePhoto = uploadData.filePath;
            } else {
                appState.userProfilePhoto = 'default_dp.png';
            }
            localStorage.setItem('prodcomp_token', appState.token);
            localStorage.setItem('prodcomp_username', appState.username);
            localStorage.setItem('prodcomp_photo', appState.userProfilePhoto);
            dom.signupContainer.classList.add('hidden');
            loadMainApplication();
        } catch (error) {
            uiModule.showToast(error.message, 'error');
            dom.signupContainer.classList.add('hidden');
            dom.loginContainer.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
        }
    }
    async function handleLogout() {
        if(appState.pollingIntervalId) clearInterval(appState.pollingIntervalId);
        try { await apiService.logout(); }
        catch (error) { console.error("Logout failed, but clearing session anyway.", error); }
        finally {
            localStorage.clear();
            location.reload();
        }
    }
    async function handleAddTask(event) {
        event.preventDefault();
        const taskText = dom.newTaskInput.value.trim();
        if (!taskText || dom.taskList.querySelectorAll('li:not(.empty-state-message)').length >= 6) return;
        const addButton = event.target.querySelector('button');
        addButton.disabled = true;
        try {
            await apiService.addTask(taskText);
            dom.newTaskInput.value = '';
            await fetchAndRenderTasks();
        } catch (error) { uiModule.showToast(error.message, 'error'); }
        finally { addButton.disabled = false; }
    }
    async function handleTaskListClick(event) {
        const target = event.target;
        const taskLi = target.closest('li[data-task-id]');
        if (!taskLi) return;
        const taskId = taskLi.dataset.taskId;

        if (target.matches('.task-checkbox')) {
            const isCompleted = target.checked;
            taskLi.classList.toggle('completed', isCompleted);
            try {
                await apiService.updateTask(taskId, isCompleted);
                await fetchAndRenderDashboardData();
            } catch (error) {
                taskLi.classList.toggle('completed', !isCompleted);
                target.checked = !isCompleted;
                uiModule.showToast('Task could not be updated. Please try again.', 'error');
            }
        }
        if (target.closest('.delete-task-btn')) {
            if (confirm('Are you sure you want to delete this task?')) {
                try {
                    await apiService.deleteTask(taskId);
                    await fetchAndRenderTasks();
                    await fetchAndRenderDashboardData();
                } catch (error) { uiModule.showToast(error.message, 'error'); }
            }
        }
    }
    async function handleEditProfileSubmit(event) {
        event.preventDefault();
        const saveButton = dom.editProfileForm.querySelector('button');
        saveButton.disabled = true;
        dom.editProfileMessageArea.textContent = '';
        let changesMade = false;
        try {
            const newUsername = dom.editUsernameInput.value.trim();
            if (newUsername && newUsername !== appState.username) {
                const data = await apiService.updateUsername(newUsername);
                appState.token = data.new_token;
                appState.username = data.new_username;
                localStorage.setItem('prodcomp_token', appState.token);
                localStorage.setItem('prodcomp_username', appState.username);
                changesMade = true;
            }
            const newPassword = dom.editPasswordInput.value;
            if (newPassword) {
                if(newPassword.length < 6) throw new Error("Password must be at least 6 characters.");
                const data = await apiService.updatePassword(newPassword);
                appState.token = data.new_token;
                localStorage.setItem('prodcomp_token', appState.token);
                changesMade = true;
            }
            const file = dom.editProfilePicInput.files[0];
            if (file) {
                const data = await apiService.uploadProfilePicture(file);
                appState.userProfilePhoto = data.filePath;
                localStorage.setItem('prodcomp_photo', appState.userProfilePhoto);
                changesMade = true;
            }
            if(changesMade) {
                uiModule.showToast('Profile updated successfully!');
                uiModule.renderUserProfile();
                await fetchAndRenderDashboardData();
            }
            dom.editProfileModal.classList.add('hidden');
            dom.editProfileForm.reset();
            dom.editProfilePicPreview.src = `static/${appState.userProfilePhoto}`;
        } catch (error) {
            dom.editProfileMessageArea.textContent = error.message;
        } finally {
            saveButton.disabled = false;
        }
    }
    async function handlePostComment() {
        const text = dom.newCommentTextarea.value.trim();
        if(!text) return;
        dom.postCommentButton.disabled = true;
        try {
            await apiService.addComment(text);
            dom.newCommentTextarea.value = '';
            await fetchAndRenderComments();
        } catch(error) { uiModule.showToast(error.message, 'error'); }
        finally { dom.postCommentButton.disabled = false; }
    }

    // --- FIX: This function is completely rewritten for correctness and reliability.
    async function fetchAndRenderDashboardData() {
        // 1. Fetch the CURRENT user's points using the dedicated, secure endpoint.
        apiService.getMyPoints()
        .then(data => {
            // The backend returns an array like: [ { points: 18, ... } ]
            // We need to access the first element of the array.
            if (data && data.length > 0) {
                dom.userPoints.textContent = data[0].points;
            } else {
                // Handle cases where the array might be empty
                console.error("Could not find user points in the response from /get_my_points");
                dom.userPoints.textContent = '0';
            }
        })
        .catch(error => {
            console.error("Could not fetch user points:", error);
            dom.userPoints.textContent = '0'; // Default to 0 on failure
        });

        // 2. Fetch the PUBLIC leaderboard data.
        uiModule.toggleLoading(dom.leaderboardListWrapper, true);
        apiService.getPoints()
            .then(leaderboardData => {
                uiModule.renderLeaderboard(leaderboardData);
            })
            .catch(error => uiModule.showToast('Could not refresh leaderboard.', 'error'))
            .finally(() => uiModule.toggleLoading(dom.leaderboardListWrapper, false));

        // 3. Fetch Comments.
        uiModule.toggleLoading(dom.commentsContainer.parentElement, true);
        apiService.getComments()
            .then(commentsData => uiModule.renderComments(commentsData))
            .catch(error => uiModule.showToast('Could not refresh comments.', 'error'))
            .finally(() => uiModule.toggleLoading(dom.commentsContainer.parentElement, false));

        // 4. Fetch Task History for Graph.
        apiService.getTaskHistory()
            .then(historyData => uiModule.renderProgressGraph(historyData))
            .catch(error => {
                console.error("Failed to load progress graph:", error);
                dom.progressGraphPlaceholder.classList.remove('hidden');
                dom.progressGraphCanvas.classList.add('hidden');
            });
    }

    async function fetchAndRenderComments() {
        uiModule.toggleLoading(dom.commentsContainer.parentElement, true);
        try {
            const commentsData = await apiService.getComments();
            uiModule.renderComments(commentsData);
        } catch(error) { uiModule.showToast('Could not refresh comments.', 'error'); }
        finally { uiModule.toggleLoading(dom.commentsContainer.parentElement, false); }
    }
    async function fetchAndRenderTasks() {
        uiModule.toggleLoading(dom.taskListWrapper, true);
        try {
            const tasks = await apiService.getMyTasks();
            uiModule.renderTasks(tasks);
        } catch (error) {
            uiModule.renderTasks([]);
        }
    }
    function loadMainApplication() {
        dom.loginContainer.classList.add('hidden');
        dom.mainAppContainer.classList.remove('hidden');
        uiModule.renderUserProfile();
        fetchAndRenderDashboardData();
        if(appState.pollingIntervalId) clearInterval(appState.pollingIntervalId);
        appState.pollingIntervalId = setInterval(fetchAndRenderDashboardData, 15000);
    }
    function handleFilePreview(fileInput, previewImg) {
        const file = fileInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => { previewImg.src = e.target.result; };
            reader.readAsDataURL(file);
        }
    }
    function init() {
        dom.loginForm.addEventListener('submit', handleLoginOrSignup);
        dom.signupForm.addEventListener('submit', handleSignupCompletion);
        dom.logoutButton.addEventListener('click', handleLogout);
        dom.themeToggle.addEventListener('change', () => uiModule.setTheme(dom.themeToggle.checked ? 'dark' : 'light'));
        dom.navDashboard.addEventListener('click', (e) => { e.preventDefault(); uiModule.showPage('dashboard'); });
        dom.navTasks.addEventListener('click', (e) => { e.preventDefault(); uiModule.showPage('tasks'); fetchAndRenderTasks(); });
        dom.postCommentButton.addEventListener('click', handlePostComment);
        dom.addTaskForm.addEventListener('submit', handleAddTask);
        dom.taskList.addEventListener('click', handleTaskListClick);
        dom.editProfileBtn.addEventListener('click', () => {
            dom.editUsernameInput.value = appState.username;
            dom.editProfileModal.classList.remove('hidden');
        });
        dom.closeModalBtn.addEventListener('click', () => dom.editProfileModal.classList.add('hidden'));
        dom.editProfileModal.addEventListener('click', (e) => { if (e.target === dom.editProfileModal) dom.editProfileModal.classList.add('hidden'); });
        dom.editProfileForm.addEventListener('submit', handleEditProfileSubmit);
        dom.profilePicUploadZone.addEventListener('click', () => dom.profilePicInput.click());
        dom.profilePicInput.addEventListener('change', () => handleFilePreview(dom.profilePicInput, dom.profilePicPreview));
        document.querySelector('.file-upload-label').addEventListener('click', () => dom.editProfilePicInput.click());
        dom.editProfilePicInput.addEventListener('change', () => handleFilePreview(dom.editProfilePicInput, dom.editProfilePicPreview));
        dom.hamburgerMenu.addEventListener('click', () => dom.sidebar.classList.toggle('is-open'));
        const savedToken = localStorage.getItem('prodcomp_token');
        const savedUsername = localStorage.getItem('prodcomp_username');
        const savedPhoto = localStorage.getItem('prodcomp_photo');
        if (savedToken && savedUsername) {
            appState.token = savedToken;
            appState.username = savedUsername;
            appState.userProfilePhoto = savedPhoto || 'default_dp.png';
            loadMainApplication();
        }
        const savedTheme = localStorage.getItem('prodcomp_theme') || 'light';
        uiModule.setTheme(savedTheme);
    }
    init();
});