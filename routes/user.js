import { fastifyPassport } from '../app.js';
import {
    HTTP_RES_CODE,
    NOTIFICATION_TYPES,
    USER_ROLES,
    USER_STATUS,
} from '../shared/constants.js';
import UserModel from '../models/User.js';
import mongoose from 'mongoose';
import NotificationModel from '../models/Notification.js';
import { sendChangedRoleEmail, sendEmail } from '../shared/helpers.js';

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

    //  "/" get all users
    fastify.get(
        '/',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const users = await UserModel.find({
                    // role: { $ne: USER_ROLES.SUPERADMIN },
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

    //  "/" get users with email
    fastify.get(
        '/email',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const users = await UserModel.find({
                    email: { $in: JSON.parse(request.query.users) },
                });

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    users,
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

    //  deprecated
    fastify.post(
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

    //  delete me delete"/:userId"
    fastify.delete(
        '/:userId',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { userId } = request.params;
                const user = await UserModel.findById(userId);
                user.status = USER_STATUS.DELETED;
                await user.save();

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

    /*  "/" set status*/
    fastify.put(
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
                        { text: 'Admin', variant: 'subtitle1' },
                        { text: ' updated your status. ' },
                        { text: 'You', variant: 'subtitle1' },
                        { text: ' are ' },
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

    /*  "/" set multi status*/
    fastify.put(
        '/s/status',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { userIds, status, comment } = request.body;
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
                userIds.forEach((userId) => {
                    (async () => {
                        try {
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
                            user.save();
                            NotificationModel({
                                to: user._id,
                                type: NOTIFICATION_TYPES.USER_SETTING_ROLE,
                                data: [
                                    { text: 'You', variant: 'subtitle1' },
                                    { text: ' have ' },
                                    { text: status, variant: 'subtitle1' },
                                ],
                            }).save();
                        } catch (error) {
                            console.log(error);
                        }
                    })();
                });

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: 'user',
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

    /*  "/" set role*/
    fastify.put(
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
                setTimeout(() => {
                    sendChangedRoleEmail(user, role);
                }, 100);

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

    /*  "/:id/setting" set setting */
    fastify.put(
        '/:userId/setting',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { userId } = request.params;
                const data = request.body;
                const user = await UserModel.findById(userId);
                user.setting = { ...user.setting, ...data };
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

    /*  "/:id/info" set account info */
    fastify.put(
        '/:userId/info',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { userId } = request.params;
                const {
                    name,
                    email,
                    countryCode,
                    mobilePhone,
                    workPhone,
                    company,
                } = request.body;
                const user = await UserModel.findById(userId);
                user.name = name;
                user.email = email;
                user.countryCode = countryCode;
                user.mobilePhone = mobilePhone;
                user.workPhone = workPhone;
                user.company = company;
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

    //  "/password" reset password by admin
    fastify.post(
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
                console.log('user@password-reset-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    //  udpate ?*
    fastify.post(
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
                email,
                countryCode,
                company,
                mobilePhone,
                workPhone,
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

                user.name = name;
                user.email = email;
                user.countryCode = countryCode;
                user.company = company;
                user.mobilePhone = mobilePhone;
                user.workPhone = workPhone;

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

    //  get favourite users
    fastify.get(
        '/favourite',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (req, res) => {
            try {
                const user = await UserModel.findById(req.user._id);
                return res.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: user.favourite,
                });
            } catch (e) {
                console.log('user@favourite-get-error:', e);
                return res.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    //  set favourite users
    fastify.put(
        '/favourite',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (req, res) => {
            try {
                const { email, flag } = req.body;
                let user = await UserModel.findById(req.user._id);
                const f = user.favourite.filter((item) => item !== email);
                if (flag) user.favourite = [...f, email];
                else user.favourite = f;
                await user.save();
                return res.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: { email, flag },
                    message: 'User updated successfully.',
                });
            } catch (e) {
                console.log('user@favourite-set-error:', e);
                return res.code(500).send({
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
