<template>
    <div class="flex justify-center w-full py-8 px-4 sm:p-8">
        <div class="flex flex-col gap-4 w-full max-w-[600px]">
            <div class="rounded-lg shadow-md overflow-hidden w-full" v-if="includeOrdinaryActivities">
            <div class="text-center w-full p-2 bg-emerald-600">
                <h3 class="font-bold text-white">Activities</h3>
            </div>
            <div class="p-2 bg-slate-50">
                <ul class="my-4" v-if="sortedActivities.length > 0">
                    <li v-for="activity in sortedActivities" :key="activity.id" class="clickable-item">
                        <hr>
                        <div class="flex align-center justify-between py-1.5" :class="{ late: isLateActivity(activity) }"
                            @click.stop="activity.pomodoro ? goPomodoro(activity) : modifyActivity(activity)">
                            <h4 :class="{ done: activity.done }">{{ activity.title }}</h4>
                            <div class="flex gap-4">
                                {{ activity.pomodoro ? activity.pomodoro.completedCycles[username] + '/' +
                                    activity.pomodoro.options.numberOfCycles + ' cicli' : '' }}
                                <button v-if="activity.pomodoro" @click.stop="modifyActivity(activity)"><v-icon
                                        name="md-modeeditoutline"></v-icon></button>
                                {{ formatDayMonth(activity.deadline) }}
                                <button v-if="!activity.done" @click.stop="markAsDone(activity)"><v-icon
                                        name="md-done"></v-icon></button>
                                <button v-else @click.stop="undoActivity(activity)"><v-icon
                                        name="fa-undo"></v-icon></button>
                            </div>
                        </div>
                    </li>
                    <hr>
                </ul>
                <p class="my-2 text-gray-700 text-center" v-else>No activities scheduled to end in this period.</p>
            </div>
        </div>
        <div class="rounded-lg shadow-md overflow-hidden w-full max-w-[600px]" v-if="includeProjectActivities">
            <div class="text-center w-full p-2 bg-emerald-600">
                <h3 class="font-bold text-white">Projects</h3>
            </div>
            <div class="p-2 bg-slate-50 w-full">
                <ul class="my-4" v-if="sortedProjectActivities.length > 0">
                    <li v-for="activity in sortedProjectActivities" :key="activity.activity.id" class="clickable-item">
                        <hr>
                        <div class="flex align-center justify-between gap-2 py-1.5" :class="{ late: isLateActivity(activity.activity) }" @click.stop="modifyActivity(activity.activity)">
                            <div v-if="activity.type=='start'" class="bg-blue-500 px-1 rounded-md text-white">
                                Start
                            </div>
                            <div v-else class="bg-orange-400 px-1 rounded-md text-white">
                                Deadline
                            </div>
                            <h5 :class="{ done: activity.activity.done }">{{ activity.activity.title }}</h5>
                        </div>
                    </li>
                    <hr>
                </ul>
                <p class="my-2 text-gray-700 text-center" v-else>No project activities scheduled to start or end in this period.</p>
            </div>
        </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import timeService from '../../services/timeService';
import router from "@/router";
import { useAuthStore } from "@/stores/authStore";
import { Activity } from '@/models/Activity';
export default defineComponent({
    props: {
        activities: {
            type: Array as PropType<Activity[]>,
            required: true
        },
        currentDate: {
            type: Date,
            required: true
        },
        view: {
            type: String,
            required: true
        },
        includeOrdinaryActivities: {
            type: Boolean,
            required: true,
        },
        includeProjectActivities: {
            type: Boolean,
            required: true,
        }
    },
    data() {
        return {
            username: useAuthStore().user.username
        }
    },
    emits: ['modifyActivity', 'markAsDone', 'undoActivity'],
    methods: {
        goPomodoro(activity: Activity) {
            router.push({ name: "pomodoro", params: { activityId: activity.id } });
        },
        modifyActivity(activity: Activity) {
            this.$emit('modifyActivity', activity);
        },
        markAsDone(activity: Activity) {
            this.$emit('markAsDone', activity);
        },
        undoActivity(activity: Activity) {
            this.$emit('undoActivity', activity);
        },
        isLateActivity(activity: Activity): boolean {
            return !activity.done && activity.deadline < timeService.getStartOfDay(new Date());
        },
        getActivitiesInPeriod(currentDate: Date, view: string): Activity[] {
            const startOfPeriod = timeService.getStartOfCurrentPeriod(currentDate, view);
            const endOfPeriod = timeService.getEndOfCurrentPeriod(currentDate, view);
            return this.activities.filter((activity: Activity) => {
                return (activity.deadline >= startOfPeriod && activity.deadline <= endOfPeriod) || 
                    (!activity.done && activity.deadline < startOfPeriod && timeService.sameDate(timeService.getEndOfCurrentPeriod(new Date, view), endOfPeriod)) ||
                    (activity.projectId && activity.start && activity.start >= startOfPeriod && activity.start <= endOfPeriod);
            });
        },
        formatDayMonth(date: Date): string {
            return timeService.formatDayMonth(date);
        }
    },
    computed: {
        sortedActivities(): Activity[] {
            let inPeriod = this.getActivitiesInPeriod(this.currentDate, this.view);
            let nonProjectActivities = inPeriod.filter((activity: Activity) => !activity.projectId);

            nonProjectActivities.sort((a: Activity, b: Activity) => {
                if (a.done && !b.done) {
                    return 1;
                } else if (!a.done && b.done) {
                    return -1;
                } else {
                    return a.deadline.getTime() - b.deadline.getTime();
                }
            });

            return nonProjectActivities;
        },
        sortedProjectActivities(): {activity: Activity, type: string}[] {
            let projectActivities = this.activities.filter((activity: Activity) => activity.projectId);
            
            let startEnds = projectActivities.flatMap((activity) => {
                let start = { activity, type: 'start' };
                let deadline = { activity, type: 'deadline' };
                return [start, deadline];
            });

            let inPeriod = startEnds.filter((pair) => {
                if(pair.type === 'start' && pair.activity.start) {
                    return pair.activity.start >= timeService.getStartOfCurrentPeriod(this.currentDate, this.view) && pair.activity.start <= timeService.getEndOfCurrentPeriod(this.currentDate, this.view);
                } 
                else if(pair.type === 'deadline' && pair.activity.deadline) {
                    return pair.activity.deadline >= timeService.getStartOfCurrentPeriod(this.currentDate, this.view) && pair.activity.deadline <= timeService.getEndOfCurrentPeriod(this.currentDate, this.view);
                }
                else
                    return false;
            });

            let sorted = inPeriod.sort((a, b) => {
                if(a.activity.start && b.activity.start) {
                    return a.activity.start.getTime() - b.activity.start.getTime();
                } else if(a.activity.deadline && b.activity.deadline) {
                    return a.activity.deadline.getTime() - b.activity.deadline.getTime();
                } else {
                    return 0;
                }
            });

            return sorted;
        }
    }
});
</script>

<style scoped>
.done {
    text-decoration: line-through;
}

.clickable-item {
    cursor: pointer;
}

.clickable-item:hover {
    background-color: #f3f4f6;
}

.late {
    color: red;
}
</style>