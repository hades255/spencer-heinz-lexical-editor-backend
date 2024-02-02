import mongoose from 'mongoose';

const Schema = mongoose.Schema;

export const ReplySchema = new Schema(
    {
        replier: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        content: {
            type: String,
            default: '',
        },
    },
    { timestamps: true, _id: false },
);

const TaskSchema = new Schema(
    {
        uniqueId: {
            type: String,
            required: true,
        },
        commentor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        assignee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        cname: {
            type: String,
            default: '',
        },
        aname: {
            type: String,
            default: '',
        },
        comment: {
            type: String,
            default: '',
        },
        task: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            required: true,
        },
        doc: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Document',
        },
        replies: [ReplySchema],
        status: { type: String, default: 'assign' }, //  review, completed
        lastActivity: {
            who: {
                type: String,
                default: '',
            },
            what: {
                type: String,
                default: '',
            },
        },
    },
    { timestamps: true },
);

const TaskModel = mongoose.model('Task', TaskSchema);

export default TaskModel;
