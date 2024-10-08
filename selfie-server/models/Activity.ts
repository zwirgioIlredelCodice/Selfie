import { model, Schema, Document } from 'mongoose';

export interface IActivity extends Document {
    title: string;
    owners: string[];
    done: boolean;
    start?: Date;
    projectId?: string;
    deadline: Date;
    notification: {
        method: string[];
        when: string;
        repeat: string;
    };
    participants: {
        username: string;
        email: string;
        status: string;
    }[];
    subActivitiesIDs: string[];
    pomodoro?: {
        options: {
            workDuration: number;
            pauseDuration: number;
            numberOfCycles: number;
        };
        completedCycles: Map<string, number>
    };
}

const ActivitySchema = new Schema({
    title: {
        type: String,
        required: true
    },
    owners: {
        type: [String],
        required: false
    },
    done: {
        type: Boolean,
        required: false
    },
    start: {
        type: Date
    },
    projectId: {
        type: String,
    },
    deadline: {
        type: Date,
        required: true
    },
    notification: {
        method: {
            type: [String],
            required: true,
            default: [],
            enum: ['push', 'email']
        },
        when: {
            type: String,
            required: false,
        },
        repeat: {
            type: String,
            required: true
        }
    },
    participants: [{
        username: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: false
        },
        status: {
            type: String,
            required: true
        }
    }],
    subActivitiesIDs: {
        type: [String],
        required: false
    },
    pomodoro: {
        type: {
            options: {
                type: {
                    workDuration: {
                        type: Number,
                        required: true
                    },
                    pauseDuration: {
                        type: Number,
                        required: true
                    },
                    numberOfCycles: {
                        type: Number,
                        required: true
                    }
                },
                required: true
            },
            completedCycles: {
                type: Map,
                of: Number,
                default: 0,
                required: true
            },
        },
    },
});

const Activity = model<IActivity>('Activity', ActivitySchema);
export default Activity;