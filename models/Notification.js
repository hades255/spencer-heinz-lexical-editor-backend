import mongoose from 'mongoose';
import { NOTIFICATION_STATUS } from '../shared/constants.js';

const Schema = mongoose.Schema;

const NotificationSchema = new Schema(
    {
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
            {
                text: { type: String, required: '' },
                variant: { type: String, default: '' },
            },
        ],
    },
    { timestamps: true },
);

const NotificationModel = mongoose.model('Notification', NotificationSchema);

export default NotificationModel;
