import { fastifyPassport } from '../app.js';
import MessageModel from '../models/Message.js';
import NotificationModel from '../models/Notification.js';
import {
    HTTP_RES_CODE,
    NOTIFICATION_STATUS,
    NOTIFICATION_TYPES,
    USER_ROLES,
} from '../shared/constants.js';

const notificationRouter = (fastify, opts, done) => {
    fastify.post('/', async (request, reply) => {
        //  not
        try {
            return reply.send({
                code: HTTP_RES_CODE.SUCCESS,
                data: {
                    documents: '',
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
    });
    //  all notifications-/
    fastify.get(
        '/',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const notifications = await NotificationModel.find({
                    $or: [
                        {
                            to: {
                                $eq:
                                    request.user.role === USER_ROLES.SUPERADMIN
                                        ? USER_ROLES.ADMIN
                                        : request.user.role,
                            },
                        },
                        { to: { $eq: request.user._id } },
                    ],
                }).sort({ createdAt: -1 });
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        notifications,
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
    //  read notifications-/read
    fastify.get(
        '/read',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const notifications = await NotificationModel.find({
                    $or: [
                        { to: { $eq: '' } },
                        { to: { $eq: request.user._id } },
                    ],
                    // $or: [
                    //     { status: { $eq: NOTIFICATION_STATUS.READ,} },
                    //     { status: { $eq: NOTIFICATION_STATUS.UNREAD,} },
                    // ],
                    status: NOTIFICATION_STATUS.READ,
                }).sort({ createdAt: -1 });
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        notifications,
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
    //  read notification with document and user-/document
    fastify.get(
        '/document',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const notification = await NotificationModel.findOne({
                    to: request.query.user,
                    redirect: request.query.document,
                    type: NOTIFICATION_TYPES.DOCUMENT_INVITE_RECEIVE,
                });
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        notification,
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
    //  mark as read all-/
    fastify.put(
        '/',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                await NotificationModel.updateMany(
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
    //  mark as read one-/:_id
    fastify.put(
        '/:_id',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { clearRedirect } = request.body;
                await NotificationModel.findByIdAndUpdate(request.params._id, {
                    status: NOTIFICATION_STATUS.READ,
                    ...(clearRedirect ? { redirect: '' } : {}),
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
    //  socket
    fastify.get('/socket', { websocket: true }, (connection, req) => {
        let user = null;
        let status = 1;
        let date = new Date('2023-10-01T00:00:00Z');
        connection.socket.on('message', (message) => {
            // Handle incoming messages from the client
            status = 1;
            user = JSON.parse(message.toString());
        });

        connection.socket.on('close', () => {
            user = null;
            status = 0;
        });

        const notificationTimer = async () => {
            try {
                if (!status || status > 5) return;
                setTimeout(notificationTimer, 3000);
                if (!user) {
                    status++;
                    return;
                }
                if (connection.socket.readyState === connection.socket.OPEN) {
                    const notifications = await NotificationModel.find({
                        $or: [
                            { to: { $eq: '' } },
                            { to: { $eq: user._id } },
                            {
                                to: {
                                    $eq:
                                        user.role === USER_ROLES.SUPERADMIN
                                            ? USER_ROLES.ADMIN
                                            : user.role,
                                },
                            },
                        ],
                        createdAt: { $gt: date },
                    }).sort({ createdAt: -1 });
                    const messages = await MessageModel.find({
                        $or: [
                            { to: { $eq: '' } },
                            { to: { $eq: user._id } },
                            {
                                to: {
                                    $eq:
                                        user.role === USER_ROLES.SUPERADMIN
                                            ? USER_ROLES.ADMIN
                                            : user.role,
                                },
                            },
                        ],
                        createdAt: { $gt: date },
                    })
                        .sort({ createdAt: -1 })
                        .exec();
                    date = new Date(Date.now());
                    // if (notifications.length || messages.length)
                    connection.socket.send(
                        JSON.stringify({ notifications, messages }),
                    );
                }
            } catch (error) {
                console.log(error);
            }
        };

        setTimeout(notificationTimer, 0);
    });
    //  get one notification-/:id
    fastify.get(
        '/:id',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const notification = await NotificationModel.findById(
                    request.params.id,
                );
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        notification,
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

export default notificationRouter;
