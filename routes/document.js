import jwt from 'jsonwebtoken';
import { YjsServer, fastifyPassport } from '../app.js';
import DocumentModel from '../models/Document.js';
import {
    HTTP_RES_CODE,
    MESSAGE_TYPES,
    NOTIFICATION_STATUS,
    NOTIFICATION_TYPES,
    USER_STATUS,
} from '../shared/constants.js';
import { v4 as uuidv4 } from 'uuid';
import { JWT_SECRET_KEY } from '../conf.js';
import NotificationModel from '../models/Notification.js';
import InviteModel from '../models/invite.js';
import {
    generateSecretString,
    nameSentence,
    sendEmail,
} from '../shared/helpers.js';
import MessageModel from '../models/Message.js';

const documentRouter = (fastify, opts, done) => {
    /**
     * @description get rooms initiazed
     */

    const GlobalRooms = fastify.appData.rooms;
    fastify.get('/rooms', (req, res) => {
        let rooms = [];
        for (let room of GlobalRooms.values()) {
            let users = [];
            for (let conn of room.conns.keys()) {
                users.push(conn.user);
            }
            rooms.push({
                name: room.name,
                activeUsers: room.numConnections,
                users,
            });
        }
        res.send({
            data: rooms,
        });
    });

    /**
     * @description connect to the room
     */
    fastify.get(
        '/',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const documents = await DocumentModel.find({})
                    .populate(['creator', 'contributors'])
                    // .sort({ updatedAt: -1 })
                    .exec();

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        documents: documents,
                    },
                    message: '',
                });
            } catch (e) {
                console.log('document@get-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );
    fastify.get(
        '/mine',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const documents = await DocumentModel.find({})
                    .populate(['creator', 'contributors'])
                    // .sort({ updatedAt: -1 })
                    .exec();

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        documents: documents.filter(
                            (item) =>
                                item.creator._id.toString() ===
                                    request.user._id.toString() ||
                                item.contributors.find(
                                    (contributor) =>
                                        contributor._id.toString() ===
                                        request.user._id.toString(),
                                ),
                        ),
                    },
                    message: '',
                });
            } catch (e) {
                console.log('document@get-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    /**
     * @description connect to the room
     */
    fastify.get(
        '/users/:uniqueId',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            const { uniqueId } = request.params;
            try {
                const document = await DocumentModel.findById(uniqueId);

                if (!document) {
                    return reply.code(403).send({
                        code: HTTP_RES_CODE.ERROR,
                        data: {},
                        message: 'Document Not Found.',
                    });
                }

                let room = {};
                for (let _room of GlobalRooms.values()) {
                    if (_room.name === uniqueId) {
                        let users = [];
                        for (let conn of _room.conns.keys()) {
                            users.push(conn.user);
                        }
                        room = {
                            name: _room.name,
                            activeUsers: _room.numConnections,
                            users,
                        };
                    }
                }
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        room,
                    },
                    message: '',
                });
            } catch (e) {
                console.log('document@get-users-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    /**
     * @description connect to the room
     */
    fastify.delete(
        '/:uniqueId',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { uniqueId } = request.params;
                const document = await DocumentModel.findByIdAndRemove(
                    uniqueId,
                );

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: { data: document },
                    message: '',
                });
            } catch (e) {
                console.log('document@delete-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    /**
     * @description connect to the room
     */
    fastify.post(
        '/update/:uniqueId',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            const { uniqueId } = request.params;
            const { name, description, initialText } = request.body;
            try {
                const document = await DocumentModel.findById(uniqueId);
                if (!document) {
                    return reply.code(403).send({
                        code: HTTP_RES_CODE.ERROR,
                        data: {},
                        message: 'No document found.',
                    });
                }

                document.name = name;
                document.description = description;
                document.initialText = initialText;
                await document.save();

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        document: document,
                    },
                    message: '',
                });
            } catch (e) {
                console.log('document@create-room-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    fastify.post(
        '/',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            const { name, description, initialText, contributors } =
                request.body;
            try {
                const newDoc = await DocumentModel({
                    name,
                    description,
                    initialText,
                    invites: contributors,
                    contributors: [],
                    creator: request.user._id,
                }).save();

                if (contributors.length) {
                    const protocol = request.protocol;
                    const ip = request.ip;
                    const port = request.raw.connection.remotePort;
                    let nonActiveUsers = [];
                    for (let contributor of contributors) {
                        if (contributor.status === USER_STATUS.INVITED) {
                            const token = generateSecretString(
                                request.user.email,
                                contributor.email,
                                newDoc._id,
                            );
                            InviteModel({
                                creator: request.user,
                                contributor,
                                document: newDoc,
                                token,
                            }).save();
                            setTimeout(() => {
                                sendEmail({
                                    from: process.env.SERVER_MAIL_ADDRESS,
                                    to: contributor.email,
                                    subject: `${request.user.name} invited you to his document.`,
                                    html: `Title: ${
                                        newDoc.name
                                    } <br/> Description: ${
                                        newDoc.description
                                    } <br/><br/> 
                                    <div style="display: flex; justify-content: center;">
                                      <div><a
                                      href="${
                                          process.env.FRONTEND_ADDRESS || ''
                                      }/invites/${token}"
                                      style="
                                        padding: 5px;
                                        border: 1px solid blue;
                                        border-radius: 5px;
                                        background-color: blue;
                                        color: white;
                                      "
                                      >Click Here</a>to contribute!</div>
                                    </div>`,
                                });
                            }, 100);
                        } else {
                            if (contributor.status !== USER_STATUS.ACTIVE) {
                                nonActiveUsers.push(contributor);
                            }
                            NotificationModel({
                                to: contributor._id,
                                type: NOTIFICATION_TYPES.DOCUMENT_INVITE_RECEIVE,
                                redirect: '/document/' + newDoc._id,
                                data: [
                                    {
                                        text: request.user.name,
                                        variant: 'subtitle1',
                                    },
                                    {
                                        text: ' invited you to join document - ',
                                        variant: '',
                                    },
                                    { text: newDoc.name, variant: 'subtitle1' },
                                ],
                            }).save();
                        }
                    }
                    NotificationModel({
                        to: request.user._id,
                        type: NOTIFICATION_TYPES.DOCUMENT_INVITE_SEND,
                        status: NOTIFICATION_STATUS.UNREAD,
                        data: [
                            { text: 'You', variant: 'subtitle1' },
                            { text: ' invited ' },
                            {
                                text: nameSentence(
                                    contributors.map((item) => item.name),
                                ),
                                variant: 'subtitle1',
                            },
                            { text: '. Wait for the response' },
                        ],
                    }).save();

                    if (nonActiveUsers.length) {
                        MessageModel({
                            from: request.user,
                            to: 'admin',
                            data: [
                                { text: 'I', variant: 'subtitle1' },
                                {
                                    text: ' invited some contributors who are not active now. Please resolve this.',
                                },
                            ],
                            type: MESSAGE_TYPES.DOCUMENT_INVITE_RESOLVE,
                            attachment: JSON.stringify(nonActiveUsers),
                        }).save();
                    }
                }

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        document: newDoc,
                    },
                    message: '',
                });
            } catch (e) {
                console.log('document@create-room-error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    fastify.post(
        '/:uniqueId/invite',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            const { contributors } = request.body;
            try {
                const newDoc = await DocumentModel.findById(
                    request.params.uniqueId,
                );
                newDoc.invites = [
                    ...newDoc.invites,
                    ...contributors.map((item) => ({
                        ...item,
                        invitor: request.user,
                    })),
                ];
                newDoc.save();
                const protocol = request.protocol;
                const ip = request.ip;
                const port = request.raw.connection.remotePort;
                let nonActiveUsers = [];
                console.log(contributors);
                for (let contributor of contributors) {
                    console.log(contributor);
                    if (contributor.status === USER_STATUS.INVITED) {
                        const token = generateSecretString(
                            request.user.email,
                            contributor.email,
                            newDoc._id,
                        );
                        InviteModel({
                            creator: request.user,
                            contributor,
                            document: newDoc,
                            token,
                        }).save();
                        setTimeout(() => {
                            sendEmail({
                                from: process.env.SERVER_MAIL_ADDRESS,
                                to: contributor.email,
                                subject: `${request.user.name} invited you to his document.`,
                                html: `Title: ${
                                    newDoc.name
                                } <br/> Description: ${
                                    newDoc.description
                                } <br/><br/> 
                                <div style="display: flex; justify-content: center;">
                                  <div><a
                                  href="${
                                      process.env.FRONTEND_ADDRESS || ''
                                  }/invites/${token}"
                                  style="
                                    padding: 5px;
                                    border: 1px solid blue;
                                    border-radius: 5px;
                                    background-color: blue;
                                    color: white;
                                  "
                                  >Click Here</a>to contribute!</div>
                                </div>`,
                            });
                        }, 100);
                    } else {
                        if (contributor.status !== USER_STATUS.ACTIVE) {
                            nonActiveUsers.push(contributor);
                        }
                        NotificationModel({
                            to: contributor._id,
                            type: NOTIFICATION_TYPES.DOCUMENT_INVITE_RECEIVE,
                            redirect: '/document/' + newDoc._id,
                            data: [
                                {
                                    text: request.user.name,
                                    variant: 'subtitle1',
                                },
                                {
                                    text: ' invited you to join document - ',
                                    variant: '',
                                },
                                { text: newDoc.name, variant: 'subtitle1' },
                            ],
                        }).save();
                    }
                }
                NotificationModel({
                    to: request.user._id,
                    type: NOTIFICATION_TYPES.DOCUMENT_INVITE_SEND,
                    status: NOTIFICATION_STATUS.UNREAD,
                    data: [
                        { text: 'You', variant: 'subtitle1' },
                        { text: ' invited ' },
                        {
                            text: nameSentence(
                                contributors.map((item) => item.name),
                            ),
                            variant: 'subtitle1',
                        },
                        { text: '. Wait for the response' },
                    ],
                }).save();

                if (nonActiveUsers.length) {
                    MessageModel({
                        from: request.user,
                        to: 'admin',
                        data: [
                            { text: 'I', variant: 'subtitle1' },
                            {
                                text: ' invited some contributors who are not active now. Please resolve this.',
                            },
                        ],
                        type: MESSAGE_TYPES.DOCUMENT_INVITE_RESOLVE,
                        attachment: JSON.stringify(nonActiveUsers),
                    }).save();
                }

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        document: doc,
                    },
                    message: '',
                });
            } catch (e) {
                console.log('document@error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    fastify.put(
        '/invitation',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            const { id, status } = request.body;
            try {
                let doc = await DocumentModel.findById(id);
                let flag1 = false;
                let flag2 = false;
                for (let invite of doc.invites) {
                    if (invite._id.toString() === request.user._id.toString()) {
                        flag1 = true;
                        break;
                    }
                }
                for (let contributor of doc.contributors) {
                    if (
                        contributor._id.toString() ===
                        request.user._id.toString()
                    ) {
                        flag2 = true;
                        break;
                    }
                }
                if (flag1 && !flag2) {
                    if (status === 'accept') {
                        doc.contributors = [
                            ...doc.contributors,
                            {
                                ...request.user,
                                date: new Date(),
                            },
                        ];
                    }
                    doc.invites = doc.invites.map((invite) => ({
                        ...invite,
                        status:
                            invite._id.toString() ===
                            request.user._id.toString()
                                ? status
                                : invite.status,
                        date:
                            invite._id.toString() ===
                            request.user._id.toString()
                                ? new Date()
                                : invite.date,
                    }));
                    await doc.save();

                    NotificationModel({
                        to: doc.creator._id,
                        type:
                            status === 'accept'
                                ? NOTIFICATION_TYPES.DOCUMENT_INVITE_ACCEPT
                                : NOTIFICATION_TYPES.DOCUMENT_INVITE_REJECT,
                        redirect: '/document/' + doc._id,
                        data: [
                            { text: 'Your', variant: 'subtitle1' },
                            { text: ' invitation to ' },
                            { text: request.user.name, variant: 'subtitle1' },
                            { text: ' was ', variant: '' },
                            { text: status, variant: 'subtitle1' },
                        ],
                    }).save();

                    return reply.send({
                        code: HTTP_RES_CODE.SUCCESS,
                        data: {
                            document: doc,
                        },
                        message: '',
                    });
                } else
                    return reply.send({
                        code: HTTP_RES_CODE.ERROR,
                        data: {
                            msg: 'none',
                        },
                        message: 'You cannot accept or reject twice.',
                    });
            } catch (e) {
                console.log('document@create-room-error:', e);
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
            const { uniqueId } = request.params;
            try {
                const document = await DocumentModel.findById(uniqueId)
                    .populate('creator')
                    .exec();
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        document,
                    },
                    message: '',
                });
            } catch {
                console.log('document@error:', e);
                return reply.code(500).send({
                    code: HTTP_RES_CODE.ERROR,
                    data: {},
                    message: 'Unexpected Server Error Occured.',
                });
            }
        },
    );

    /**
     * @description connect to the room
     */
    fastify.get(
        '/connect/:uniqueId',
        { websocket: true },
        async (connection, request) => {
            try {
                const { socket } = connection;
                //TODO- check if verified, remove all remaining sockets from room

                // check if room exists. If yes, then connect or create room
                YjsServer.handleConnection(
                    socket,
                    request,
                    authorize(socket, request),
                );
            } catch (e) {
                console.log('document@create-room-error:', e);
            }
        },
    );

    // fastify.get('/save/:name', (request, response) => {
    //     try {
    //         const { name } = request.params;
    //         const room = GlobalRooms.get(name);

    //         response.send({
    //             data: 'ok',
    //         });
    //     } catch (e) {
    //         console.log('document@save-error:', e);
    //     }
    // });

    const authorize = async (socket, request) => {
        // option 1) use a param in the request.url
        const { uniqueId } = request.params;
        if (!uniqueId) throw new Error('invalid doc name');

        // check if document exists or not
        const document = await DocumentModel.findById(uniqueId);
        if (!document) {
            throw new Error('No Document Found.');
        }

        // validate auth has access to docName...
        const { token } = request.query;
        if (token) {
            const verifyResult = jwt.verify(
                token,
                JWT_SECRET_KEY,
                function (err, decoded) {
                    if (err) throw new Error('Authentication error');
                    const { user } = decoded;
                    socket.user = user;
                    socket.type = 'ydoc';
                    return true;
                },
            );
            return verifyResult;
        }

        // option2) use request.headers.cookie (only works if the server is on the same origin)

        // signal that the connection should be considered authorized
        return false;
    };

    done();
};

export default documentRouter;
