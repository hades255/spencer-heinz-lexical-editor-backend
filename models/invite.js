import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const InviteSchema = new Schema(
    {
        contributor: {
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
            status: { type: String, default: 'pending' },
        },
        creator: {
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
            status: { type: String, default: 'pending' },
        },
        document: {
            _id: {
                type: String,
                default: '',
            },
            name: {
                type: String,
                default: '',
            },
            description: {
                type: String,
                default: '',
            },
        },
        status: {
            type: String,
            default: '',
        },
        token: {
            type: String,
            required: true,
        },
    },
    { timestamps: true },
);

const InviteModel = mongoose.model('Invite', InviteSchema);

export default InviteModel;
