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
    compareArrays,
    generateSecretString,
    nameSentence,
    sendInvitationEmailToExist,
    sendInvitationEmailToNew,
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

    //  get all documents-/
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

    //  get all document that I can access-/mine
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
                    .populate(['creator'])
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

    //  '/users/:uniqueId'
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
                const document = await DocumentModel.findById(uniqueId)
                    .populate(['creator'])
                    .exec();

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

    //  remove a document-'/:uniqueId'
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

    //  update a document-'/:uniqueId'
    fastify.put(
        '/:uniqueId',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            const { uniqueId } = request.params;
            const { name, description, contributors, invites } = request.body;
            try {
                const document = await DocumentModel.findById(uniqueId)
                    .populate(['creator'])
                    .exec();
                if (!document) {
                    return reply.code(403).send({
                        code: HTTP_RES_CODE.ERROR,
                        data: {},
                        message: 'No document found.',
                    });
                }

                document.name = name;
                document.description = description;
                document.contributors = contributors;
                document.invites = invites;
                await document.save();

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        document,
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

    //  create a new document-/
    fastify.post(
        '/',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            const {
                name,
                description,
                initialText,
                contributors: incontributors,
            } = request.body;
            const contributors = incontributors.filter(
                (item) => item.email !== request.user.email,
            );
            try {
                const newDoc = await DocumentModel({
                    name,
                    description,
                    initialText,
                    invites: contributors,
                    contributors: [],
                    creator: request.user._id,
                }).save();
                //  if want to invite users
                if (contributors.length) {
                    let nonActiveUsers = []; //  used for get non active users from the contributors
                    let k = 0;
                    for (let contributor of contributors) {
                        k++;
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
                                sendInvitationEmailToNew(
                                    request.user,
                                    contributor,
                                    newDoc,
                                    token,
                                );
                            }, k * 1000);
                        } else {
                            setTimeout(() => {
                                sendInvitationEmailToExist(
                                    request.user,
                                    contributor,
                                    newDoc,
                                );
                            }, k * 1000);
                            if (contributor.status !== USER_STATUS.ACTIVE) {
                                nonActiveUsers.push(contributor);
                            }
                        }
                        NotificationModel({
                            to: contributor._id,
                            type: NOTIFICATION_TYPES.DOCUMENT_INVITE_RECEIVE,
                            redirect: newDoc._id,
                            data: [
                                {
                                    text: request.user.name,
                                    variant: 'subtitle1',
                                },
                                {
                                    text: ' invited you to join document. Document: ',
                                    variant: '',
                                },
                                { text: newDoc.name, variant: 'subtitle1' },
                            ],
                        }).save();
                    }
                    NotificationModel({
                        to: request.user._id,
                        type: NOTIFICATION_TYPES.DOCUMENT_INVITE_SEND,
                        data: [
                            { text: 'You', variant: 'subtitle1' },
                            { text: ' invited ' },
                            {
                                text: nameSentence(
                                    contributors.map((item) => item.name),
                                ),
                                variant: 'subtitle1',
                            },
                            { text: ' to your document. Document: ' },
                            { text: newDoc.name, variant: 'subtitle1' },
                            { text: '. Wait for the response' },
                        ],
                        redirect: newDoc._id,
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

    /**
     * send invitation from contributor-'/:uniqueId/invite'
     */
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
                let nonActiveUsers = [];
                let k = 0;
                for (let contributor of contributors) {
                    k++;
                    if (contributor.status === USER_STATUS.INVITED) {
                        //  send invitation email to manually created user
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
                        //  send email to invited user who are not registered yet.
                        //  sending email part must be in setTimeout because that cause error.
                        setTimeout(() => {
                            sendInvitationEmailToNew(
                                request.user,
                                contributor,
                                newDoc,
                                token,
                            );
                        }, k * 1000);
                    } else {
                        if (contributor.status !== USER_STATUS.ACTIVE) {
                            nonActiveUsers.push(contributor);
                        }
                        //  send email to exist user to join the document.
                        setTimeout(() => {
                            sendInvitationEmailToExist(
                                request.user,
                                contributor,
                                newDoc,
                            );
                        }, k * 1000);
                    }
                    //  send notification to users who are invited whether those status are not active
                    NotificationModel({
                        to: contributor._id,
                        type: NOTIFICATION_TYPES.DOCUMENT_INVITE_RECEIVE,
                        redirect: newDoc._id,
                        data: [
                            {
                                text: request.user.name,
                                variant: 'subtitle1',
                            },
                            {
                                text: ' invited you to join document. Document: ',
                                variant: '',
                            },
                            { text: newDoc.name, variant: 'subtitle1' },
                        ],
                    }).save();
                }
                if (contributors.length !== 0) {
                    //  send a notification to creator to wait his contributors to join
                    NotificationModel({
                        to: request.user._id,
                        type: NOTIFICATION_TYPES.DOCUMENT_INVITE_SEND,
                        data: [
                            { text: 'You', variant: 'subtitle1' },
                            { text: ' invited ' },
                            {
                                text: nameSentence(
                                    contributors.map((item) => item.name),
                                ),
                                variant: 'subtitle1',
                            },
                            { text: '. Document:' },
                            { text: newDoc.name, variant: 'subtitle1' },
                            { text: ' Wait for the response' },
                        ],
                        redirect: newDoc._id,
                    }).save();
                }
                //  if there is any user that status is not active now, send message to admin to handle this
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
                        document: newDoc,
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

    /**
     * delete invitors from creator-'/:uniqueId/clearinvite'
     */
    fastify.post(
        '/:uniqueId/clearinvite',
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
                newDoc.invites = compareArrays(
                    newDoc.invites,
                    contributors,
                    'email',
                );
                newDoc.contributors = compareArrays(
                    newDoc.contributors,
                    contributors,
                    'email',
                );
                newDoc.save();
                for (let contributor of contributors) {
                    NotificationModel({
                        to: contributor._id,
                        type: NOTIFICATION_TYPES.DOCUMENT_INVITE_DELETE,
                        data: [
                            {
                                text: request.user.name,
                                variant: 'subtitle1',
                            },
                            {
                                text: ' deleted you from document. Document: ',
                                variant: '',
                            },
                            { text: newDoc.name, variant: 'subtitle1' },
                        ],
                    }).save();
                }
                NotificationModel({
                    to: request.user._id,
                    type: NOTIFICATION_TYPES.DOCUMENT_INVITE_DELETE,
                    status: NOTIFICATION_STATUS.UNREAD,
                    data: [
                        { text: 'You', variant: 'subtitle1' },
                        { text: ' removed ' },
                        {
                            text: nameSentence(
                                contributors.map((item) => item.name),
                            ),
                            variant: 'subtitle1',
                        },
                        { text: ' from your document. Document: ' },
                        { text: newDoc.name, variant: 'subtitle1' },
                    ],
                    redirect: newDoc._id,
                }).save();

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        document: newDoc,
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

    //  handle invitation-'/invitation'
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
                        reply:
                            invite._id.toString() ===
                            request.user._id.toString()
                                ? status
                                : invite.reply,
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
                        data: [
                            { text: 'Your', variant: 'subtitle1' },
                            { text: ' invitation to ' },
                            { text: request.user.name, variant: 'subtitle1' },
                            { text: ' was ', variant: '' },
                            { text: status, variant: 'subtitle1' },
                            { text: '. Document: ', variant: '' },
                            { text: doc.name, variant: 'subtitle1' },
                        ],
                        redirect: doc._id,
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

    // get one document-'/:uniqueId'
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

    //  MAIN - lexical editor-socket-'/connect/:uniqueId'
    fastify.get(
        '/connect/:uniqueId',
        { websocket: true },
        async (connection, request) => {
            try {
                const { socket } = connection;
                const whenAuthorized = await authorize(socket, request).catch(
                    (e) => {
                        console.log(e);
                        connection.close(4001);
                        return false;
                    },
                );
                //TODO- check if verified, remove all remaining sockets from room

                // check if room exists. If yes, then connect or create room
                YjsServer.handleConnection(socket, request, whenAuthorized);
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
