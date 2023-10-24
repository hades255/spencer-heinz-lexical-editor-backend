import mongoose from 'mongoose';
import { Message_STATUS } from '../shared/constants.js';

const Schema = mongoose.Schema;

const MessageSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: false,
            default: '',
        },
        creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            populate: {
                path: 'creator',
                select: '_id name email avatar role status',
            },
        },
        contributors: [
            {
                _id: {
                    type: String,
                    default: '',
                },
                name: {
                    type: String,
                    default: '',
                },
                email: {
                    type: String,
                    default: '',
                },
                avatar: {
                    type: String,
                    default: '',
                },
            },
        ],
        initialText: {
            type: String,
            required: false,
            default: '',
        },
        status: {
            type: String,
            enum: Object.values(Message_STATUS),
            default: Message_STATUS.EDITING,
        },
    },
    { timestamps: true },
);

const MessageModel = mongoose.model('Message', MessageSchema);

export default MessageModel;
