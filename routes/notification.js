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
    //  all notifications
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
                        { to: { $eq: '' } },
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
    //  read notifications
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
    //  read notification with document and user
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
                    redirect: '/document/' + request.query.document,
                    status: NOTIFICATION_STATUS.UNREAD,
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
    //  mark as read all
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
                        to: request.user._id,
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
    //  mark as read one
    fastify.put(
        '/:_id',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                await NotificationModel.findByIdAndUpdate(request.params._id, {
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
    //  socket
    fastify.get('/socket', { websocket: true }, (connection, req) => {
        let user = null;
        let date = new Date('2023-10-01T00:00:00Z');
        connection.socket.on('message', (message) => {
            // Handle incoming messages from the client
            user = JSON.parse(message.toString());
        });

        connection.socket.on('close', () => {
            user = null;
        });

        const notificationTimer = async () => {
            try {
                if (connection.socket.readyState === connection.socket.OPEN) {
                    setTimeout(notificationTimer, 3000);
                    if (!user) return;
                    const notifications = await NotificationModel.find({
                        $or: [{ to: { $eq: '' } }, { to: { $eq: user._id } }],
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
                    if (notifications.length || messages.length)
                        connection.socket.send(
                            JSON.stringify({ notifications, messages }),
                        );
                }
            } catch (error) {
                console.log(error);
            }
        };

        setTimeout(notificationTimer, 1000);
    });
    done();
};

export default notificationRouter;
