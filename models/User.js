import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { SECRET_SALT } from '../conf.js';
import { USER_ROLES, USER_STATUS } from '../shared/constants.js';

const Schema = mongoose.Schema;

const UserSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        avatar: {
            type: String,
            default: '',
        },
        company: {
            type: String,
            default: '',
        },
        countryCode: {
            type: String,
            default: '',
        },
        mobilePhone: {
            type: String,
            required: true,
        },
        workPhone: {
            type: String,
            default: 0,
        },
        setting: {
            hide: {
                type: Boolean,
                default: true,
            },
            loginNotification: {
                type: Boolean,
                default: true,
            },
        },
        comment: { type: String, default: '' },
        password: {
            type: String,
            required: true,
            minLength: 8,
            select: false,
        },
        lastLogonTime: {
            type: String,
        },
        status: {
            type: String,
            enum: Object.values(USER_STATUS),
            default: USER_STATUS.PENDING,
        },
        event: [
            new mongoose.Schema(
                {
                    status: {
                        type: String,
                    },
                    comment: {
                        type: String,
                        default: '',
                    },
                    at: {
                        type: Date,
                    },
                    by: {
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
                { _id: false },
            ),
        ],
        favourite: [{ type: String, unique: true, required: true }],
        collaborates: [{ type: String, unique: true, required: true }],
        role: {
            type: String,
            enum: Object.values(USER_ROLES),
            default: USER_ROLES.CONTRIBUTOR,
        },
    },
    { timestamps: true },
);

UserSchema.pre('save', async function (next) {
    // check the password if it is modified
    if (!this.isModified('password')) {
        return next();
    }

    const hash = await bcrypt.hash(this.password, SECRET_SALT);

    this.password = hash;
    next();
});

UserSchema.methods.isValidPassword = async function (password, encrypted) {
    const compare = await bcrypt.compare(password, encrypted);

    return compare;
};

const UserModel = mongoose.model('User', UserSchema);

export default UserModel;
