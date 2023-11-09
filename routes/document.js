import jwt from 'jsonwebtoken';
import { YjsServer, fastifyPassport } from '../app.js';
import DocumentModel from '../models/Document.js';
import { HTTP_RES_CODE } from '../shared/constants.js';
import { JWT_SECRET_KEY } from '../conf.js';
import {
    clearInvite,
    create,
    handleInvite,
    setInvite,
    update,
} from '../controllers/document.js';

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
        update,
    );

    //  create a new document-/
    fastify.post(
        '/',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        create,
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
        setInvite,
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
        clearInvite,
    );

    //  handle invitation-'/invitation'
    fastify.put(
        '/invitation',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        handleInvite,
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
