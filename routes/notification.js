import { fastifyPassport } from '../app.js';
import MessageModel from '../models/Message.js';
import NotificationModel from '../models/Notification.js';
import {
    HTTP_RES_CODE,
    NOTIFICATION_STATUS,
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
                        // $or: [
                        // { to: { $eq: '' } },
                        // { to: { $eq: request.user._id } },
                        // ],
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
    fastify.get('/socket', { websocket: true }, (connection, req) => {
        let user = null;
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
                        // status: NOTIFICATION_STATUS.UNREAD,  //  !
                    })
                        .sort({ createdAt: -1 })
                        .exec();
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
                        // status: NOTIFICATION_STATUS.UNREAD,  //  !
                    })
                        .sort({ createdAt: -1 })
                        .exec();
                    connection.socket.send(
                        JSON.stringify({ notifications, messages }),
                    );
                }
            } catch (error) {
                console.log(error);
            }
        };

        notificationTimer();
    });
    done();
};

export default notificationRouter;
