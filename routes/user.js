import { fastifyPassport } from '../app.js';
import {
    HTTP_RES_CODE,
    NOTIFICATION_TYPES,
    USER_ROLES,
    USER_STATUS,
} from '../shared/constants.js';
import UserModel from '../models/User.js';
import mongoose from 'mongoose';
import { getUsers } from '../socket/index.js';
import NotificationModel from '../models/Notification.js';

const userRouter = (fastify, opts, done) => {
    /**
     * @description get users
     */
    fastify.get(
        '/get',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const users = await UserModel.find({
                    role: { $ne: USER_ROLES.SUPERADMIN },
                });
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        users,
                    },
                    message: '',
                });
            } catch (e) {
                console.log('user@get-users-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    fastify.get(
        '/getPrivacy',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            const userId = request.user._id;
            const user = await UserModel.findById(userId);
            const clientIP = request.headers['x-real-ip'] || request.ip;

            reply.send({
                pwdResetAt: user.pwdResetAt,
                lastLogonTime: user.lastLogonTime,
                IpAddress: clientIP,
            });
        },
    );

    fastify.get(
        //  "/" get all users without super admin
        '/',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const users = await UserModel.find({
                    role: { $ne: USER_ROLES.SUPERADMIN },
                });

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        users: users,
                    },
                    message: 'Success',
                });
            } catch (e) {
                console.log('user@get-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    fastify.post(
        //  deprecated
        '/deleteUser',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { uniqueId } = request.body;

                const user = await UserModel.findById(uniqueId);

                await user.deleteOne();

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {},
                    message: 'User deleted successfully.',
                });
            } catch (e) {
                console.log('user@delete-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    fastify.put(
        /*  "/" set status*/
        '/',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { userId, status, comment } = request.body;
                let data = {};
                switch (status) {
                    case USER_STATUS.ACTIVE:
                        data.approvedAt = new Date();
                        break;
                    case USER_STATUS.LOCKED:
                        data.lockedAt = new Date();
                        break;
                    case USER_STATUS.DELETED:
                        data.deletedAt = new Date();
                        break;
                    default:
                        break;
                }
                const user = await UserModel.findById(userId);
                user.status = status;
                user.comment = comment;
                user.event = [
                    {
                        status,
                        comment,
                        at: new Date(),
                        by: {
                            ...request.user,
                        },
                    },
                    ...(user.event || []),
                ];

                await user.save();

                NotificationModel({
                    to: user._id,
                    type: NOTIFICATION_TYPES.USER_SETTING_ROLE,
                    data: [
                        { text: 'Your', variant: 'subtitle1' },
                        { text: ' have ' },
                        { text: status, variant: 'subtitle1' },
                    ],
                }).save();

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: user,
                    message: 'User updated successfully.',
                });
            } catch (e) {
                console.log('user@delete-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    fastify.put(
        /*  "/" set role*/
        '/role',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { userId, role, comment } = request.body;

                const user = await UserModel.findByIdAndUpdate(userId, {
                    role,
                    comment,
                });

                NotificationModel({
                    to: user._id,
                    type: NOTIFICATION_TYPES.USER_SETTING_ROLE,
                    data: [
                        { text: 'Your', variant: 'subtitle1' },
                        { text: ' role was set as ' },
                        { text: role, variant: 'subtitle1' },
                    ],
                }).save();

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: user,
                    message: 'User updated successfully.',
                });
            } catch (e) {
                console.log('user@delete-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    fastify.post(
        //  "/password" reset password
        '/password',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { userId } = request.body;

                const user = await UserModel.findById(userId);
                user.pwdResetAt = new Date();
                user.password = 'Welcome123.!@#';
                user.event = [
                    {
                        status: 'pwdreset',
                        at: new Date(),
                        by: {
                            ...request.user,
                        },
                    },
                    ...(user.event || []),
                ];
                await user.save();

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: user,
                    message: 'User updated successfully.',
                });
            } catch (e) {
                console.log('user@delete-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    fastify.post(
        //  udpate ?*
        '/update/:uniqueId',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            const { uniqueId } = request.params;
            const {
                name,
                user_id,
                email,
                dob,
                countryCode,
                contact,
                mobilePhone,
                workPhone,
                designation,
                address,
                address1,
                country,
                state,
                city,
                zip,
                flag,
                skill,
            } = request.body;
            try {
                const _id = new mongoose.Types.ObjectId(uniqueId);
                const user = await UserModel.findOne({ _id });
                if (!user) {
                    return reply.code(403).send({
                        code: HTTP_RES_CODE.ERROR,
                        data: {},
                        message: 'No User found.',
                    });
                }

                user.dob = dob;
                user.name = name;
                user.user_id = user_id;
                user.email = email;
                user.countryCode = countryCode;
                user.contact = contact;
                user.mobilePhone = mobilePhone;
                user.workPhone = workPhone;
                user.designation = designation;
                user.address = address;
                user.address1 = address1;
                user.country = country;
                user.state = state;
                user.city = city;
                user.zip = zip;
                user.flag = flag;
                user.skill = skill;

                await user.save();

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        user: user,
                    },
                    message: '',
                });
            } catch (e) {
                console.log('user@update-user-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    done();
};

export default userRouter;
