import { fastifyPassport } from '../app.js';
import MessageModel from '../models/Message.js';
import {
    HTTP_RES_CODE,
    NOTIFICATION_STATUS,
    USER_ROLES,
} from '../shared/constants.js';

const messageRouter = (fastify, opts, done) => {
    fastify.get(
        '/',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const messages = await MessageModel.find({
                    $or: [
                        { to: { $eq: '' } },
                        { to: { $eq: request.user._id } },
                        {
                            to: {
                                $eq:
                                    request.user.role === USER_ROLES.SUPERADMIN
                                        ? USER_ROLES.ADMIN
                                        : request.user.role,
                            },
                        },
                    ],
                }).sort({ createdAt: -1 });
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        messages,
                    },
                    message: '',
                });
            } catch (error) {
                console.log('document@get-error:', error);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );
    fastify.get(
        '/:uniqueId',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const message = await MessageModel.findById(
                    request.params.uniqueId,
                );
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        message,
                    },
                    message: '',
                });
            } catch (error) {
                console.log('document@get-error:', error);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );
    fastify.put(
        '/',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                await MessageModel.updateMany(
                    {
                        $or: [
                            { to: { $eq: request.user._id } },
                            {
                                to: {
                                    $eq:
                                        request.user.role ===
                                        USER_ROLES.SUPERADMIN
                                            ? USER_ROLES.ADMIN
                                            : request.user.role,
                                },
                            },
                        ],
                    },
                    { status: NOTIFICATION_STATUS.READ },
                );
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        msg: 'OK',
                    },
                    message: '',
                });
            } catch (error) {
                console.log('document@get-error:', error);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );
    fastify.put(
        '/:_id',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                await MessageModel.findByIdAndUpdate(request.params._id, {
                    status: NOTIFICATION_STATUS.READ,
                });
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        msg: 'OK',
                    },
                    message: '',
                });
            } catch (error) {
                console.log('document@get-error:', error);
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

export default messageRouter;
