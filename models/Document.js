import mongoose from 'mongoose';
import {
    DOCUMENT_STATUS,
    USER_ROLES,
    USER_STATUS,
} from '../shared/constants.js';

const Schema = mongoose.Schema;

const DocumentSchema = new Schema(
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
        invites: [
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
                status: { type: String, default: USER_STATUS.PENDING },
                reply: { type: String, default: 'pending' },
                invitor: {
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
            },
        ],
        initialText: {
            type: String,
            required: false,
            default: '',
        },
        status: {
            type: String,
            enum: Object.values(DOCUMENT_STATUS),
            default: DOCUMENT_STATUS.EDITING,
        },
    },
    { timestamps: true },
);

const DocumentModel = mongoose.model('Document', DocumentSchema);

export default DocumentModel;
