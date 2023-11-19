import mongoose from 'mongoose';
import {
    NOTIFICATION_STATUS,
    USER_ROLES,
    USER_STATUS,
} from '../shared/constants.js';

const Schema = mongoose.Schema;

const MessageSchema = new Schema(
    {
        from: {
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
            status: { type: String, default: USER_STATUS.PENDING },
            role: { type: String, default: USER_ROLES.CONTRIBUTOR },
        },
        to: {
            type: String,
            default: '',
        },
        type: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: Object.values(NOTIFICATION_STATUS),
            default: NOTIFICATION_STATUS.UNREAD,
        },
        redirect: { type: String, default: '' },
        data: [
            new mongoose.Schema(
                {
                    text: { type: String, required: true },
                    variant: { type: String, default: '' },
                },
                { _id: false },
            ),
        ],
        attachment: {
            type: String,
            default: '',
        },
    },
    { timestamps: true },
);

const MessageModel = mongoose.model('Message', MessageSchema);

export default MessageModel;
