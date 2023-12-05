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
                mobilePhone: {
                    type: String,
                    default: '',
                },
                workPhone: {
                    type: String,
                    default: '',
                },
                status: { type: String, default: USER_STATUS.PENDING },
                reply: { type: String, default: 'pending' },
                invitor: {
                    type: String,
                    default: '',
                },
                team: {
                    type: String,
                    default: 'authoring',
                },
                leader: {
                    type: Boolean,
                    default: false,
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
        team: {
            type: String,
            default: 'authoring',
        },
    },
    { timestamps: true },
);

const DocumentModel = mongoose.model('Document', DocumentSchema);

export default DocumentModel;
