import {API_URL, fetchWithMiddleware, getStatusFromActivity, getTimeMachineDate, logout} from "./utilities.js";

class ConditionalRender extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
    }

    static get observedAttributes() {
        return ['condition'];
    }

    attributeChangedCallback(name) {
        if (name === 'condition') {
            this.render();
        }
    }

    render() {
        const condition = this.getAttribute('condition');
        this.shadowRoot.innerHTML = condition === 'true' ? `<slot name="true"></slot>` : `<slot name="false"></slot>`;
    }
}

customElements.define('conditional-render', ConditionalRender);

document.addEventListener('DOMContentLoaded', () => {
    // check auth status
    const auth = JSON.parse(localStorage.getItem('auth') || null);
    if (!auth || !auth.isAuthenticated) {
        window.location.href = '/#/login';
    }

    if (auth.isAdmin) {
        document.getElementById("adminLink").classList.remove("hidden");
    }

    const ganttView = document.getElementById('ganttView');

    document.getElementById('visualType').value = auth.user.preferences?.projectsView || 'list';
    document.getElementById('visualType').addEventListener('change', (event) => {
        auth.user.preferences.projectsView = event.target.value;
        localStorage.setItem('auth', JSON.stringify(auth));
        fetchWithMiddleware(`${API_URL}/profile/preferences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({projectsView: event.target.value})
        });
        if (event.target.value === 'gantt') {
            ganttView.classList.remove('hidden');
            listView.classList.add('hidden');
            showGantt(projects.find(project => project._id === projectSelector.value));
        } else {
            ganttView.classList.add('hidden');
            listView.classList.remove('hidden');
            showList(projects.find(project => project._id === projectSelector.value));
        }
    });
    auth.user.preferences?.projectsView === 'gantt' && ganttView.classList.remove('hidden');

    let showTooltip = false;
    const conditionalRenderElement = document.getElementById('dateConditionalRender');

    const dateInput = document.getElementById('selectedDate');
    const timeInput = document.getElementById('selectedTime');
    const timeMachineMessage = document.getElementById('timeMachineMessage');


    const toggleTooltip = () => {
        showTooltip = !showTooltip;

        const date = getTimeMachineDate();
        dateInput.value = date.toISOString().split('T')[0];
        timeInput.value = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        timeMachineMessage.innerText = '';
        conditionalRenderElement.setAttribute('condition', showTooltip);
    };

    const resetDate = () => {
        fetchWithMiddleware(`${API_URL}/timeMachine/restoreGlobalClock/`, {
            method: 'POST'
        }).then(() => {
                const date = new Date();
                dateInput.value = date.toISOString().split('T')[0];
                timeInput.value = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                timeMachineMessage.innerText = 'Time machine restored!'
                localStorage.setItem('date', JSON.stringify({
                    "currentDate": new Date().toISOString(),
                    "timeDiff": 0,
                    "realTimeDiff": 0
                }));

                // re-render gantt
                document.querySelector("gantt-component").date = new Date();
            }
        ).catch(
            () => timeMachineMessage.innerText = 'Error restoring time machine!'
        );
    };

    const setCurrentDate = () => {
        const newDate = new Date(dateInput.value);
        newDate.setHours(timeInput.value.split(':')[0]);
        newDate.setMinutes(timeInput.value.split(':')[1]);
        fetchWithMiddleware(`${API_URL}/timeMachine/setGlobalClock/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({date: newDate})
        }).then(() => {
            const timeDifference = newDate.getTime() - (new Date().getTime());
            timeMachineMessage.innerText = 'Time machine set!'
            localStorage.setItem('date', JSON.stringify({
                "currentDate": newDate.toISOString(),
                "timeDiff": 0,
                "realTimeDiff": timeDifference
            }));

            // re-render gantt
            document.querySelector("gantt-component").date = getTimeMachineDate();
        }).catch(
            () => timeMachineMessage.innerText = 'Error setting time machine!'
        );
    }

    const clickOutsideElement = document.getElementById('clickOutsideElement');
    clickOutsideElement.addEventListener('clickoutside', () => {
        showTooltip = false;
        conditionalRenderElement.setAttribute('condition', showTooltip);
    });

    document.getElementById('toggleDateTooltip').addEventListener('click', toggleTooltip);
    document.getElementById('setCurrentDate').addEventListener('click', setCurrentDate);
    document.getElementById('resetDate').addEventListener('click', resetDate);

    const projectModal = document.getElementById('projectModal');
    const modalTitle = document.getElementById('modalTitle');
    const projectForm = document.getElementById('projectForm');
    const projectTitle = document.getElementById('projectTitle');
    const actorsContainer = document.getElementById('actorsContainer');
    const addActorButton = document.getElementById('addActor');
    const phasesContainer = document.getElementById('phasesContainer');
    const addPhaseButton = document.getElementById('addPhase');
    const cancelButton = document.getElementById('cancelButton');
    const addProjectButton = document.getElementById('addProjectButton');

    let isEditing = false;
    let currentProjectId = null;

    const openModal = (project = null) => {
        if (project) {
            isEditing = true;
            currentProjectId = project._id;
            modalTitle.innerText = 'Edit Project';
            projectTitle.value = project.title;
            populateActors(project.actors);
            populatePhases(project.phases);
        } else {
            isEditing = false;
            currentProjectId = null;
            modalTitle.innerText = 'Add Project';
            projectForm.reset();
            actorsContainer.innerHTML = '';
            phasesContainer.innerHTML = '';
        }
        projectModal.show();
        //editActivityModal.show();
    };

    const closeModal = () => {
        projectModal.hide();
    };

    const addActor = () => {
        const actorDiv = document.createElement('div');
        actorDiv.classList.add('actor', 'flex', 'gap-x-1', 'items-center', 'mb-1');
        actorDiv.innerHTML = `
            <div class="flex gap-1">
            <input type="text" placeholder="Actor Username" class="actorUsername p-2 border border-gray-300 rounded-md" required>
            <button type="button" class="removeActorButton bg-red-500 text-white p-2 rounded-md"><i class="bi bi-x-lg"></i></button>
            </div>
        `;
        actorsContainer.appendChild(actorDiv);
        actorDiv.querySelector('.removeActorButton').addEventListener('click', () => removeActor(actorDiv));
    };

    const removeActor = (actorDiv) => {
        actorDiv.remove();
    };

    const populateActors = (actors) => {
        actorsContainer.innerHTML = '';
        actors.forEach(actor => {
            const actorDiv = document.createElement('div');
            actorDiv.classList.add('actor', 'flex', 'gap-1');
            actorDiv.innerHTML = `
                <input type="text" value="${actor}" class="actorUsername p-2 border border-gray-300 rounded-md" required>
                <button type="button" class="removeActorButton bg-red-500 text-white p-2 rounded-md"><i class="bi bi-x-lg"></i></button>
            `;
            actorsContainer.appendChild(actorDiv);
            actorDiv.querySelector('.removeActorButton').addEventListener('click', () => removeActor(actorDiv));
        });
    };

    const addPhase = () => {
        const phaseDiv = document.createElement('fieldset');
        phaseDiv.classList.add('phase', 'rounded', 'bg-gray-100', 'p-2', 'mt-2');
        phaseDiv.innerHTML = `
            <div class="flex w-full gap-2">
                <button type="button" class="toggleActivitiesVisButton text-black"><i class="bi bi-chevron-down"></i></button>
                <input type="text" placeholder="Phase Title" class="flex-1 p-2 border border-gray-300 rounded-md" required>
                <button type="button" class="removePhaseButton bg-red-500 px-2 py-1 text-white p-2 rounded-md"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="activitiesContainer my-2"></div>
            <button type="button" class="addActivityButton bg-emerald-400 text-white p-2  rounded-md">Add Activity</button>
        `;
        phasesContainer.appendChild(phaseDiv);
        phaseDiv.querySelector('.toggleActivitiesVisButton').addEventListener('click', () => toggleActivitiesVisualizations(phaseDiv));
        phaseDiv.querySelector('.addActivityButton').addEventListener('click', () => addActivity(phaseDiv));
        phaseDiv.querySelector('.removePhaseButton').addEventListener('click', () => removePhase(phaseDiv));
    };

    const removePhase = (phaseDiv) => {
        phaseDiv.remove();
    };

    const toggleActivitiesVisualizations = (phaseDiv) => {
        const activitiesContainer = phaseDiv.querySelector('.activitiesContainer');
        activitiesContainer.classList.toggle('hidden');
        phaseDiv.querySelector('.addActivityButton').classList.toggle('hidden');

        if (activitiesContainer.classList.contains('hidden'))
            phaseDiv.querySelector('.toggleActivitiesVisButton').style.transform = 'rotate(270deg)';
        else
            phaseDiv.querySelector('.toggleActivitiesVisButton').style.transform = 'rotate(0deg)';
    };

    const generateUniqueId = (phaseDiv) => {
        if (!phaseDiv.activityCounter) {
            phaseDiv.activityCounter = 0;
        }
        phaseDiv.activityCounter += 1;
        return phaseDiv.activityCounter;
    };

    const addLinkedActivityEventListener = (activityDiv) => {
        const linkedActivityIdSelect = activityDiv.querySelector('.linkedActivityId');
        const inputElement = activityDiv.querySelector('.input');
        linkedActivityIdSelect.addEventListener('change', () => {
            inputElement.disabled = linkedActivityIdSelect.value !== '';
            inputElement.value = linkedActivityIdSelect.value !== '' ? 'Output of #' + linkedActivityIdSelect.value : '';
        });
    }

    const updateLinkedActivities = (activitiesContainer, phaseDiv) => {
        activitiesContainer.querySelectorAll('.linkedActivityId').forEach(select => {
            const value = select.value;
            select.innerHTML = `
                <option value="">None</option>
                ${phaseDiv.activityIds.map(id => `<option value="${id}">${id}</option>`).join('')}
            `;
            select.value = value;
        });
    }

    const addActivity = (phaseDiv) => {
        //editActivityModal.show();

        const activitiesContainer = phaseDiv.querySelector('.activitiesContainer');
        const activityDiv = document.createElement('fieldset');
        const uniqueId = generateUniqueId(phaseDiv);

        // Store the unique ID in the phase-specific list
        if (!phaseDiv.activityIds) {
            phaseDiv.activityIds = [];
        }
        phaseDiv.activityIds.push(uniqueId);


        activityDiv.classList.add('activity', 'border-l-4', 'border-emerald-400', 'p-2', 'mt-4', 'flex', 'flex-col', 'gap-2', 'bg-emerald-50');
        activityDiv.innerHTML = `
        <div class="flex justify-between items-center w-full font-bold">
            <div class="flex gap-2"> 
                #${uniqueId} 
                <p class="activityTitle">Activity</p>
            </div>
            <div class="flex gap-1">
                <button type="button" class="editActivityButton bg-yellow-500 text-white px-2 py-1 rounded-md"><i class="bi bi-pencil-fill"></i></button>
                <button type="button" class="removeActivityButton bg-red-500 text-white px-2 py-1 rounded-md"><i class="bi bi-trash-fill"></i></button>
            </div>
        </div>
        <div class="flex gap-2 items-center justify-between">
            <label><input type="checkbox" class="isMilestone"> Milestone</label>
            <label>Status:
                <select class="status p-2 border border-gray-300 rounded-md" required>
                    <option value="NotStarted">Not Started</option>
                    <option value="Started">Started</option>
                    <option value="Concluded">Concluded</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Abandoned">Abandoned</option>
                </select>
            </label>
            <label>Linked Activity:
                <select class="linkedActivityId p-2 border border-gray-300 rounded-md">
                    <option value="">None</option>
                    ${phaseDiv.activityIds.map(id => `<option value="${id}">${id}</option>`).join('')}
                </select>
            </label>
        </div>
        <div class="flex gap-1">
            <input type="text" placeholder="Input" class="flex-1 input p-2 border border-gray-300 rounded-md">
            <input type="text" placeholder="Output" class="flex-1 output p-2 border border-gray-300 rounded-md">
        </div>
        <input type="hidden" class="hidden" value="${uniqueId}"/>
    `;
        activitiesContainer.appendChild(activityDiv);
        activityDiv.querySelector('.editActivityButton').addEventListener('click', () => editActivity(activityDiv, phaseDiv));
        activityDiv.querySelector('.removeActivityButton').addEventListener('click', () => removeActivity(activityDiv, phaseDiv));

        openActivityModalForAdd(activityDiv, phaseDiv);

        addLinkedActivityEventListener(activityDiv);
        updateLinkedActivities(activitiesContainer, phaseDiv);
    };

    const removeActivity = (activityDiv, phaseDiv) => {
        const uniqueId = Number(activityDiv.querySelector('input.hidden').value);
        phaseDiv.activityIds = phaseDiv.activityIds.filter(id => id !== uniqueId);
        activityDiv.remove();

        const activitiesContainer = phaseDiv.querySelector('.activitiesContainer');
        updateLinkedActivities(activitiesContainer, phaseDiv);
    };

    const populatePhases = (phases) => {
        phasesContainer.innerHTML = '';
        phases.forEach(phase => {
            const phaseDiv = document.createElement('fieldset');
            phaseDiv.activityIds = [];
            phaseDiv.activityCounter = 0;

            phaseDiv.classList.add('phase', 'rounded', 'bg-gray-100', 'p-2', 'mt-2');
            phaseDiv.innerHTML = `
            <div class="flex w-full gap-2">
                <button type="button" class="toggleActivitiesVisButton text-black"><i class="bi bi-chevron-down"></i></button>
                <input type="text" value="${phase.title}" class="flex-1 p-2 border border-gray-300 rounded-md" required>
                <button type="button" class="removePhaseButton bg-red-500 text-white px-2 py-1 rounded-md"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="activitiesContainer my-2"></div>
            <button type="button" class="addActivityButton bg-emerald-400 text-white p-2 rounded-md">Add Activity</button>
        `;
            const activitiesContainer = phaseDiv.querySelector('.activitiesContainer');
            phase.activities.forEach(activity => {
                const activityDiv = document.createElement('fieldset');
                activityDiv.classList.add('activity', 'border-l-4', 'border-emerald-400', 'p-2', 'mt-4', 'flex', 'flex-col', 'gap-2', 'bg-emerald-50');
                activityDiv.innerHTML = `

                    <div class="flex justify-between items-center w-full font-bold">
                    <div class="flex gap-2"> 
                        #${activity.localId} 
                        <p class="activityTitle">${activity.activity.title}</p>
                    </div>
                    <div class="flex gap-1">
                        <button type="button" class="editActivityButton bg-yellow-500 text-white px-2 py-1 rounded-md"><i class="bi bi-pencil-fill"></i></button>
                        <button type="button" class="removeActivityButton bg-red-500 text-white px-2 py-1 rounded-md"><i class="bi bi-trash-fill"></i></button>
                    </div>
                </div>
                <div class="flex gap-2 items-center justify-between">
                    <label><input type="checkbox" class="isMilestone" ${activity.isMilestone ? 'checked' : ''}> Milestone</label>
                    <label>Status:
                        <select class="status p-2 border border-gray-300 rounded-md" required>
                            <option value="NotStarted">Not Started</option>
                            <option value="Started">Started</option>
                            <option value="Concluded">Concluded</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Abandoned">Abandoned</option>
                        </select>
                    </label>
                    <label>Linked Activity:
                        <select class="linkedActivityId p-2 border border-gray-300 rounded-md">
                            <option value="">None</option>
                            ${phase.activities.map(act => `<option value="${act.localId}" ${activity.linkedActivityId === act.localId ? 'selected' : ''}>${act.localId}</option>`).join('')}
                        </select>
                    </label>
                </div>
                <div class="flex gap-1">
                    <input type="text" placeholder="Input" value="${activity.input}" ${activity.linkedActivityId != null ? "disabled" : ''} class="flex-1 input p-2 border border-gray-300 rounded-md">
                    <input type="text" placeholder="Output" value="${activity.output}" class="flex-1 output p-2 border border-gray-300 rounded-md">
                </div>
                <input type="hidden" class="hidden" value="${activity.localId}"/>
                `;
                activityDiv.querySelector('.status').value = activity.status;

                addLinkedActivityEventListener(activityDiv);

                activityDiv.activity = activity.activity;
                phaseDiv.activityIds.push(activity.localId);

                activitiesContainer.appendChild(activityDiv);
                activityDiv.querySelector('.editActivityButton').addEventListener('click', () => editActivity(activityDiv, phaseDiv));
                activityDiv.querySelector('.removeActivityButton').addEventListener('click', () => removeActivity(activityDiv, phaseDiv));
            });

            phasesContainer.appendChild(phaseDiv);
            phaseDiv.activityCounter = phaseDiv.activityIds.length > 0 ? Math.max(...phaseDiv.activityIds) : 0;
            phaseDiv.querySelector('.toggleActivitiesVisButton').addEventListener('click', () => toggleActivitiesVisualizations(phaseDiv));
            phaseDiv.querySelector('.addActivityButton').addEventListener('click', () => addActivity(phaseDiv));
            phaseDiv.querySelector('.removePhaseButton').addEventListener('click', () => removePhase(phaseDiv));
        });
    };

    const errorMessage = document.getElementById('errorMessage');

    const showError = (message) => {
        errorMessage.innerText = message;
        errorMessage.classList.remove('hidden');
        errorMessage.scrollIntoView({block: 'center', behavior: 'smooth'});
    };

    const hideError = () => {
        errorMessage.innerText = '';
        errorMessage.classList.add('hidden');
    };

    projectForm.addEventListener('submit', (event) => {
        event.preventDefault();
        hideError();
        const projectData = {
            owner: auth.user.username,
            actors: Array.from(actorsContainer.querySelectorAll('.actorUsername')).map(actorInput => actorInput.value),
            title: projectTitle.value,
            phases: Array.from(phasesContainer.querySelectorAll('.phase')).map(phaseDiv => ({
                title: phaseDiv.querySelector('input').value,
                activities: Array.from(phaseDiv.querySelectorAll('.activity')).map(activityDiv => ({
                    status: activityDiv.querySelector('.status').value, // Add status field
                    localId: activityDiv.querySelector('input.hidden').value,
                    isMilestone: activityDiv.querySelector('.isMilestone').checked,
                    input: activityDiv.querySelector('.input').value,
                    output: activityDiv.querySelector('.output').value,
                    linkedActivityId: activityDiv.querySelector('.linkedActivityId').value,
                    activity: activityDiv.activity
                }))
            }))
        };

        if (isEditing) {
            fetchWithMiddleware(`${API_URL}/project/${currentProjectId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            }).then(response => response.json()).then(data => {
                if (data.hasOwnProperty("error"))
                    showError(data.error);
                else {
                    const project = formatProject(data);
                    projects[projects.findIndex(project => project._id === currentProjectId)] = project;
                    showProjects();
                    displayProject(project);
                    closeModal();
                }
            })
        } else {
            fetchWithMiddleware(`${API_URL}/project/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            }).then(response => response.json()).then(data => {
                if (data.hasOwnProperty("error"))
                    showError(data.error);
                else {
                    const project = formatProject(data);
                    projects.push(project);
                    showProjects();
                    projectSelector.value = data._id;
                    displayProject(project);
                    closeModal();
                }
            })
        }
    });

    addActorButton.addEventListener('click', addActor);
    addPhaseButton.addEventListener('click', addPhase);
    cancelButton.addEventListener('click', closeModal);
    addProjectButton.addEventListener('click', () => openModal());

    let projects = [];
    const projectSelector = document.querySelector('#selectedProject');

    const showProjects = () => {
        const value = projectSelector.value;
        projectSelector.innerHTML = `
            ${projects.map(project => `<option value="${project._id}">${project.title}</option>`).join('')}
        `;
        projectSelector.value = value;
    }

    const displayProject = (project) => {
        showHeader(project);
        auth.user.preferences.projectsView === 'gantt' ? showGantt(project) : showList(project);
        projectSelector.value = project._id;
    }

    const showHeader = (project) => {
        const header = document.getElementById('projectHeader');

        const actionOptions = project.owner === auth.user.username ? `
            <div class="flex gap-1 font-semibold">
                <button type="button" class="edit-project-button bg-emerald-500 text-white px-3 py-2 rounded-md">
                    <i class="bi bi-pencil-fill mr-2"></i> Edit
                </button>
                <button type="button" class="delete-project-button bg-red-500 text-white px-3 py-2 rounded-md">
                    <i class="bi bi-trash-fill mr-2"></i> Delete
                </button>
            </div class="font-semibold">`
            : `<button type="button" class="leave-project-button bg-red-500 text-white px-3 py-2 rounded-md">
                <i class="bi bi-x-circle-fill mr-2"></i>Leave
            </button>`;

        header.innerHTML = `
            <h3 class="text-3xl font-bold text-gray-800 p-2 mr-4">${project.title}</h3>
            ${actionOptions}`;

        if (project.owner === auth.user.username) {
            document.querySelector('.edit-project-button').addEventListener('click', () => openModal(project));
            document.querySelector('.delete-project-button').addEventListener('click', () => fetchWithMiddleware(
                `${API_URL}/project/${project._id}`,
                { method: 'DELETE' }
            ).then(() => {
                projects.splice(projects.findIndex(p => p._id === project._id), 1);
                showProjects();
                projectSelector.selectedIndex = 0;
                displayProject(projects[0]);
            }));
        } else {
            document.querySelector('.leave-project-button').addEventListener('click', () => fetchWithMiddleware(
                `${API_URL}/project/${project._id}/leave`,
                { method: 'POST' }
            ).then(() => {
                projects.splice(projects.findIndex(p => p._id === project._id), 1);
                showProjects();
                projectSelector.selectedIndex = 0;
                displayProject(projects[0]);
            }));
        }
    }

    projectSelector.addEventListener('change', () => {
        const project = projects.find(project => project._id === projectSelector.value);
        displayProject(project);
    });

    const listView = document.getElementById('listView');
    const gantt = document.querySelector("gantt-component");

    const showGantt = (project) => {
        if (project)
            gantt.project = [project, getTimeMachineDate()];
    };

    const showList = (project) => {
        listView.innerHTML = '';

        if (!project) // no project exists
            return;
      
        const activities = project.phases.flatMap(phase =>
            phase.activities.map(activity => ({
                ...activity,
                phaseTitle: phase.title
            }))
        );

        activities.sort((a, b) => {
            const dateA = new Date(a.activity.deadline);
            const dateB = new Date(b.activity.deadline);
            if (dateA < dateB) return -1;
            if (dateA > dateB) return 1;
            return a.activity.participants.map(participant => participant.username).includes(auth.user.username) ? -1 : 1;
        });

        const activityList = activities.map((activity, index) => {
            const status = getStatusFromActivity(activity, activities);
            const participants = activity.activity?.participants.map(participant => participant.username);
            const startingDate = activity.linkedActivityId !== null ?
                "End of #" + activities.find(act => act.localId === activity.linkedActivityId).localId
                :
                new Date(activity.activity?.start).toLocaleDateString();
            return `
        <li class="activity-item border p-4 bg-white rounded-lg shadow-lg">
            <div class="flex w-full items-center justify-between mb-3">
                <h4 class="text-xl font-semibold">${activity.activity?.title}</h4>
                <div class="size-10 flex items-center justify-center rounded-full bg-emerald-600 text-white font-bold">${index+1}</div>
            </div>
            <div class="text-gray-700">
                <hr class="my-1">
                <div class="flex items-center justify-between"><strong>Phase</strong> ${activity.phaseTitle}</div>
                <div class="flex items-center justify-between"><strong>Id</strong>#${activity.localId}</div> 
                <hr class="my-1">
                <div class="flex items-center justify-between"><strong>Actors</strong> ${participants?.join(', ')}</div>
                <hr class="my-1">
                <div class="flex items-center justify-between"><strong>Starting Date</strong> ${startingDate}</div>
                <div class="${status === "Abbandoned" || status === "Late" ? 'text-red-500' : ''} flex items-center justify-between"><strong>Ending Date</strong> ${new Date(activity.activity?.deadline).toLocaleDateString()}</div>
                <hr class="my-1">
                <div class="flex items-center justify-between"><strong>Status</strong> ${status}</div>
                <div class="flex items-center justify-between"><strong>Input</strong> ${activity.input}</div>
                <div class="flex items-center justify-between"><strong>Output</strong> ${activity.output}</div>
                <hr class="my-1">
                <button type="button" class="edit-activity-button bg-emerald-500 text-white font-bold p-2 rounded-md w-full mt-4" data-activity-id="${activity.activityId}" ${participants?.includes(auth.user.username) || project.owner === auth.user.username ? '' : 'disabled'}>Edit</button>
            </div>
        </li>
    `
        }).join('');

        listView.innerHTML = `<ul class="activity-list list-none p-0 sm:grid md:grid-cols-2 lg:grid-cols-3 flex flex-col gap-2">${activityList}</ul>`;

        document.querySelectorAll('.edit-activity-button').forEach(button => {
            button.addEventListener('click', (event) => {
                openEditActivityModal(activities.find(activity => activity.activityId === event.target.dataset.activityId));
            });
        });
    };

    const editActivityModal = document.getElementById('editActivityModal');
    const editActivityForm = document.getElementById('editActivityForm');
    const editProjectActivityModal = document.getElementById('editProjectActivityModal');
    const editProjectActivityForm = document.getElementById('editProjectActivityForm');
    const editErrorMessage = document.getElementById('editErrorMessage');
    const editProjectActivityId = document.getElementById('editProjectActivityId');
    const editStatus = document.getElementById('editStatus');
    const editInput = document.getElementById('editInput');
    const editOutput = document.getElementById('editOutput');
    const editActivityTitle = document.getElementById('editTitle');
    const editStartDate = document.getElementById('editStartDate');
    const editEndDate = document.getElementById('editEndDate');
    const editNotifyOS = document.getElementById('editNotifyOS');
    const editNotifyEmail = document.getElementById('editNotifyEmail');
    const editRepeatNotify = document.getElementById('editRepeatNotify');
    const addActivityParticipantButton = document.getElementById('addActivityParticipantButton');
    const cancelEditButton = document.getElementById('cancelEditButton');
    const cancelProjectEditButton = document.getElementById('cancelProjectEditButton');
    const participantsContainer = editActivityModal.querySelector('#actParticipantsContainer');
    const usernameInput = editActivityModal.querySelector('#actNewParticipantUsername');

    editStartDate.addEventListener('change', () => {
        editEndDate.min = editStartDate.value;
    });

    editEndDate.addEventListener('change', () => {
        editStartDate.max = editEndDate.value;
    });

    const openEditActivityModal = (activity) => {
        editProjectActivityId.value = activity.activityId;
        editInput.value = activity.input;
        if (activity.linkedActivityId) {
            editInput.disabled = true;
        }
        editOutput.value = activity.output;
        editStatus.value = activity.status;
        editProjectActivityModal.show();
    };

    let modifyingActivity = false; // whether the activity is being modified or created
    let selectedActivityDiv = null;
    let selectedPhaseDiv = null;

    const editActivity = (activityDiv, phaseDiv) => {
        selectedActivityDiv = activityDiv;
        selectedPhaseDiv = phaseDiv;

        modifyingActivity = true;

        // populate the edit form with the activity data
        editActivityTitle.value = activityDiv.activity.title;
        if (activityDiv.querySelector('.linkedActivityId').value === "") {
            const date = isNaN(activityDiv.activity.start.getTime()) ? new Date() : activityDiv.activity.start;
            editStartDate.value = new Date(date).toISOString().split('T')[0];
            editStartDate.disabled = false;
        } else {
            editStartDate.value = null;
            editStartDate.disabled = true;
        }
        editEndDate.value = new Date(activityDiv.activity.deadline).toISOString().split('T')[0];
        editNotifyOS.checked = activityDiv.activity.notification.method?.includes('push');
        editNotifyEmail.checked = activityDiv.activity.notification.method?.includes('email');
        editRepeatNotify.value = activityDiv.activity.notification.repeat;

        // add limits
        editStartDate.max = editEndDate.value;
        editEndDate.min = editStartDate.value;

        // populate the participants list
        participantsContainer.innerHTML = '';
        activityDiv.activity.participants.forEach(participant => {
            usernameInput.value = participant.username;
            addActivityParticipantButton.click();
        });
        editActivityModal.show();
    };

    const openActivityModalForAdd = (activityDiv, phaseDiv) => {
        selectedActivityDiv = activityDiv;
        selectedPhaseDiv = phaseDiv;
        modifyingActivity = false;

        // add default dates
        const now = new Date(localStorage.getItem('date') ? JSON.parse(localStorage.getItem('date')).currentDate : new Date());
        editStartDate.value = now.toISOString().split('T')[0];
        const oneWeekLater = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
        editEndDate.value = oneWeekLater.toISOString().split('T')[0];

        // add limits
        editStartDate.max = editEndDate.value;
        editEndDate.min = editStartDate.value;

        editActivityModal.show();
    };

    const closeProjectEditActivityModal = () => {
        editProjectActivityModal.hide();
    };

    const cancelEditActivity = () => {
        if (!modifyingActivity) {
            // an adding operation was interrupted
            selectedActivityDiv.remove();
            selectedPhaseDiv.activityIds.pop();
            selectedPhaseDiv.activityCounter -= 1;
        }

        selectedActivityDiv = null;
        selectedPhaseDiv = null;

        closeEditActivityModal();
    };

    editActivityForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const newActivity = {};
        newActivity.owners = [auth.user.username];
        newActivity.title = editActivityTitle.value;
        newActivity.start = new Date(editStartDate.value);
        newActivity.deadline = new Date(editEndDate.value);
        newActivity.notification = {
            method: [],
            repeat: editRepeatNotify.value
        };
        if (editNotifyOS.checked) {
            newActivity.notification.method.push('push');
        }
        if (editNotifyEmail.checked) {
            newActivity.notification.method.push('email');
        }
        newActivity.participants = Array.from(participantsContainer.querySelectorAll('.participant')).map(participantDiv => ({
            username: participantDiv.querySelector('.username').innerText,
            'status': 'accepted'
        }));

        selectedActivityDiv.querySelector('.activityTitle').innerText = editActivityTitle.value;
        selectedActivityDiv.activity = newActivity;

        selectedActivityDiv = null;
        selectedPhaseDiv = null;

        closeEditActivityModal();
    });

    const closeEditActivityModal = () => {
        editActivityForm.reset();
        participantsContainer.innerHTML = '';
        modifyingActivity = false;
        editActivityModal.hide();
    };

    addActivityParticipantButton.addEventListener('click', () => {
        if (usernameInput.value !== '') {
            const newParticipant = document.createElement('div');
            newParticipant.classList.add('participant', 'flex', 'gap-x-1', 'items-center', 'p-1', 'rounded-md', 'text-white', 'bg-blue-400');
            newParticipant.innerHTML = `
            <p class="username">${usernameInput.value}</p>
            <button type="button" class="removeParticipantButton"><i class="bi bi-x-lg"></i></button>
            `;
            participantsContainer.appendChild(newParticipant);
            newParticipant.querySelector('.removeParticipantButton').addEventListener('click', () => newParticipant.remove());
            usernameInput.value = '';
        }
    });

    editProjectActivityForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const projectId = projectSelector.value;
        const updatedActivity = {
            activityId: editProjectActivityId.value,
            input: editInput.value,
            output: editOutput.value,
            status: editStatus.value
        };
        let project_index = projects.findIndex(project => project._id === projectId);
        let project = projects[project_index];
        fetchWithMiddleware(`${API_URL}/project/${project._id}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedActivity)
        }).then(response => response.json()).then(data => {
            if (data.hasOwnProperty("error"))
                editErrorMessage.innerText = data.error;
            else {
                project = formatProject(data);
                projects[project_index] = project;
                displayProject(project);
            }
        });
        closeProjectEditActivityModal();
    });

    cancelEditButton.addEventListener('click', cancelEditActivity);
    cancelProjectEditButton.addEventListener('click', closeProjectEditActivityModal);

    fetchWithMiddleware(`${API_URL}/project/all`, {}).then(response => response.json()).then(data => {
        projects = data.map(project => formatProject(project));
        showProjects();
        projectSelector.selectedIndex = 0;
        displayProject(projects[0]);
    });

    const formatProject = (project) => {
        return {
            ...project,
            phases: project.phases.map(phase => ({
                ...phase,
                activities: phase.activities.map(activity => ({
                    ...activity,
                    activity: activity.activity ? {
                        ...activity.activity,
                        start: new Date(activity.activity.start),
                        deadline: new Date(activity.activity.deadline)
                    } : null
                }))
            }))
        };
    };

    document.querySelector("#logout").addEventListener("click", logout);
});

