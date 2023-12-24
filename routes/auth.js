import { fastifyPassport } from '../app.js';
import {
    HTTP_RES_CODE,
    NOTIFICATION_TYPES,
    USER_STATUS,
} from '../shared/constants.js';
import {
    createAuthToken,
    generateRandomString,
    sendPasswordResetEmail,
} from '../shared/helpers.js';
import UserModel from '../models/User.js';
import NotificationModel from '../models/Notification.js';

const authRouter = (fastify, opts, done) => {
    fastify.post(
        '/signup',
        {
            preValidation: fastifyPassport.authenticate('signup', {
                authInfo: false,
            }),
        },
        async (request, reply) => {
            try {
                const {
                    name,
                    countryCode,
                    mobilePhone,
                    workPhone,
                    status,
                    company,
                } = request.body;
                const user = request.user;
                user.status = status;
                user.company = company;
                user.name = name;
                user.countryCode = countryCode;
                user.mobilePhone = mobilePhone;
                user.workPhone = workPhone;
                const currentDate = new Date();
                user.pwdResetAt = currentDate.toString();
                await user.save();
                new NotificationModel({
                    to: 'admin',
                    type: NOTIFICATION_TYPES.USER_CREATE_NEW,
                    data: [
                        { text: 'New User: ', variant: 'subtitle1' },
                        {
                            text: `New user registered.`,
                        },
                        { text: '<br/>' },
                        { text: 'Name: ' },
                        {
                            text: user.name,
                            variant: 'subtitle1',
                        },
                        { text: ' Email: ' },
                        {
                            text: user.email,
                            variant: 'subtitle1',
                        },
                    ],
                }).save();
                reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        user: user,
                    },
                    message: '',
                });
            } catch (error) {
                console.log(error);
                reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message:
                        'auth@login-error: Unexpected Server Error Occured.',
                });
            }
        },
    );

    fastify.post(
        '/signin',
        {
            preValidation: fastifyPassport.authenticate('login', {
                authInfo: false,
            }),
        },
        async (request, reply) => {
            try {
                const user = request.user;

                if (user.status !== 'active' && user.status !== 'invited') {
                    return reply.send({
                        code: HTTP_RES_CODE.ERROR,
                        data: { status: user.status },
                    });
                }
                if (user.setting.loginMethod !== 'password') {
                    return reply.send({
                        code: HTTP_RES_CODE.ERROR,
                        data: { status: 'password' },
                    });
                }
                const token = createAuthToken(user);
                const currentDate = new Date();
                user.lastLogonTime = currentDate.toString();
                await user.save();
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        serviceToken: token,
                        user: user,
                    },
                });
            } catch (e) {
                console.log(e);
                reply.code(400).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: e.message,
                });
            }
        },
    );

    fastify.get(
        '/me',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                // const user = request.user;
                await UserModel.findOne({ _id: request.user._id }).then(
                    (user) => {
                        if (user.status !== 'active') {
                            return reply.send({
                                code: HTTP_RES_CODE.ERROR,
                                data: { status: user.status },
                            });
                        }
                        return reply.send({
                            code: HTTP_RES_CODE.SUCCESS,
                            data: {
                                user: user,
                            },
                        });
                    },
                );
            } catch (e) {
                console.log(e);
                reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'auth@me-error: Unexpected Server Error Occured.',
                });
            }
        },
    );

    fastify.put('/resetPassword/:token', async (request, reply) => {
        try {
            const { token } = request.params;
            const newPassword = request.body.newPassword;
            const user = await UserModel.findOne({
                resetToken: token,
            }).select('+password');
            if (user.status !== 'active' && user.status !== 'invited') {
                return reply.send({
                    code: HTTP_RES_CODE.ERROR,
                    data: { status: user.status },
                    message: '',
                });
            }
            user.setting.loginMethod = 'password';
            user.resetToken = '';
            user.password = newPassword;
            const currentDate = new Date();
            user.pwdResetAt = currentDate.toString();

            await user.save();
            reply.send({
                code: HTTP_RES_CODE.SUCCESS,
                data: {},
                message: '',
            });
        } catch (error) {
            console.log(error);
            reply.code(400).send({
                code: HTTP_RES_CODE.ERROR,
                data: {},
                message: error.message,
            });
        }
    });

    fastify.post(
        '/resetPassword',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const currentPassword = request.body.currentPassword;
                const newPassword = request.body.newPassword;
                const user = await UserModel.findById(request.user._id).select(
                    '+password',
                );
                const validate = await user.isValidPassword(
                    currentPassword,
                    user.password,
                );
                if (!validate) {
                    return reply.code(409).send({
                        code: HTTP_RES_CODE.ERROR,
                        data: {},
                        message:
                            'auth@reset-password-error: Current Password mismatch.',
                    });
                }
                user.password = newPassword;
                const currentDate = new Date();
                user.pwdResetAt = currentDate.toString();
                user.setting.loginMethod = 'password';

                await user.save();
                reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        user: user,
                        currentPassword: currentPassword,
                        newPassword: newPassword,
                    },
                    message: '',
                });
            } catch (error) {
                console.log(error);
                reply.code(400).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: error.message,
                });
            }
        },
    );

    fastify.post('/forgetPassword', async (request, reply) => {
        try {
            const email = request.body.email;
            const user = await UserModel.findOne({
                email: email,
            });
            if (!user) {
                return reply.code(404).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'auth@forget-password-error: User not found.',
                });
            }
            const token = generateRandomString(32);
            user.resetToken = token;
            await user.save();
            // const newToken = await TokenModel({
            //     user
            // })
            setTimeout(() => {
                sendPasswordResetEmail(user, token);
            });
            return reply.send({
                code: HTTP_RES_CODE.SUCCESS,
                data: { token },
                message:
                    'Reset token has been generated and stored successfully.',
            });
        } catch (error) {
            console.error(error);

            return reply.code(500).send({
                code: HTTP_RES_CODE.ERROR,
                data: {},
                message: 'Error while saving the reset token.',
            });
        }
    });

    done();
};

export default authRouter;
