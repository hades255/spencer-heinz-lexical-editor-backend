import { fastifyPassport } from '../app.js';
import {
    HTTP_RES_CODE,
    NOTIFICATION_TYPES,
    USER_STATUS,
} from '../shared/constants.js';
import { createAuthToken } from '../shared/helpers.js';
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

                if (user.status !== 'active') {
                    return reply.send({
                        code: HTTP_RES_CODE.ERROR,
                        data: { status: user.status },
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
                reply.send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message:
                        'auth@login-error: Unexpected Server Error Occured.',
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

    fastify.post(
        '/resetPassword',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
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
            const day = currentDate.getDate().toString().padStart(2, '0');
            const month = (currentDate.getMonth() + 1)
                .toString()
                .padStart(2, '0'); // Months are 0-indexed, so we add 1
            const year = currentDate.getFullYear();
            const hours = currentDate.getHours().toString().padStart(2, '0');
            const minutes = currentDate
                .getMinutes()
                .toString()
                .padStart(2, '0');
            const seconds = currentDate
                .getSeconds()
                .toString()
                .padStart(2, '0');

            const formattedDate = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;

            user.pwdResetAt = formattedDate;

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
        },
    );

    fastify.post(
        '/forgetPassword',
        // {
        //     preValidation: fastifyPassport.authenticate('protected', {
        //         session: false,
        //     }),
        // },
        async (request, reply) => {
            const email = request.body.email;

            // Check if the email exists in the database
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

            // Generate a reset token
            const token = createAuthToken(user);

            // Store the reset token in the database
            // user.resetToken = token;

            // try {
            //     const newToken = await TokenModel({
            //         user
            //     })

            //     return reply.send({
            //         code: HTTP_RES_CODE.SUCCESS,
            //         data: { token },
            //         message: 'Reset token has been generated andstored successfully.',
            //     });
            // } catch (error) {
            //     console.error(error);

            //     return reply.code(500).send({
            //         code: HTTP_RES_CODE.ERROR,
            //         data: {},
            //         message: 'Error while saving the reset token.'
            //     });
            // }
        },
    );

    done();
};

export default authRouter;
