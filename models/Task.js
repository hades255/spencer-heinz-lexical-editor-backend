import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const ReplySchema = new Schema(
    {
        replier: {
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
    },
    { timestamps: true },
);

const TaskModel = mongoose.model('Task', TaskSchema);

export default TaskModel;
