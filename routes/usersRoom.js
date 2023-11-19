import DocumentModel from '../models/Document.js';
import { HTTP_RES_CODE } from '../shared/constants.js';

const usersRoom = (fastify, opts, done) => {
    const Rooms = fastify.appData.userrooms;
    //  get all rooms with users-/
    fastify.get('/', (req, res) => {
        let rooms = [];
        for (let room of Rooms.values()) {
            let users = [];
            for (let userData of room.userData.values()) {
                users.push(getUserData(userData));
            }
            rooms.push({
                name: room.name,
                users,
            });
        }
        res.send({
            data: rooms,
        });
    });
    //  get room with users-/:id
    fastify.get('/:id/users', (req, res) => {
        if (Rooms.has(req.params.id)) {
            const room = Rooms.get(req.params.id);
            let users = [];
            for (let userData of room.userData.values()) {
                users.push(getUserData(userData));
            }
            res.send({
                data: {
                    name: room.name,
                    users,
                },
            });
        } else {
            return res.code(404).send({
                code: HTTP_RES_CODE.ERROR,
                data: {},
                message: 'no rooms match to that id.',
            });
        }
    });

    fastify.get('/:roomId', { websocket: true }, (connection, req) => {
        const { roomId } = req.params;
        const { userId } = req.query;

        const client = connection.socket;

        let room = null;
        if (Rooms.has(roomId)) {
            room = Rooms.get(roomId);
            let users = [];
            room.userData.set(userId, {
                ...room.userData.get(userId),
                socket: client,
            });
            for (let userData of room.userData.values()) {
                users.push(getUserData(userData));
            }
            client.send(
                JSON.stringify({
                    type: 'userslist',
                    users,
                    active: room.activeTeam,
                }),
            );
        } else {
            console.log('close');
            client.close();
        }

        client.on('message', (message) => {
            const data = JSON.parse(message.toString());
            switch (data.type) {
                case 'set-active':
                    room.activeTeam = data.team;
                    broadcastToDoc(room);
                    break;
                case 'new-team':
                    for (let user of data.value) {
                        room.userData.set(user.toString(), {
                            ...room.userData.get(user.toString()),
                            team: data.name,
                            leader: user === userId,
                        });
                    }
                    broadcastToDoc(room);
                    break;
                case 'edit-team':
                    for (let user of data.a) {
                        room.userData.set(user.toString(), {
                            ...room.userData.get(user.toString()),
                            team: data.name,
                            leader: false,
                        });
                    }
                    for (let user of data.r) {
                        room.userData.set(user.toString(), {
                            ...room.userData.get(user.toString()),
                            team: '',
                            leader: false,
                        });
                    }
                    if (data.team) {
                        for (let user of data.value) {
                            room.userData.set(user.toString(), {
                                ...room.userData.get(user.toString()),
                                team: data.name,
                                leader: user === userId,
                            });
                        }
                    }
                    broadcastToDoc(room);
                    break;
                case 'remove-team':
                    for (let user of data.value) {
                        room.userData.set(user.toString(), {
                            ...room.userData.get(user.toString()),
                            team: '',
                            leader: false,
                        });
                    }
                    broadcastToDoc(room);
                    break;
                default:
                    break;
            }
        });

        client.on('close', () => {
            room.userData.set(userId, {
                ...room.userData.get(userId),
                socket: null,
            });
        });
    });
    done();
};

export default usersRoom;

export const createRoom = (_id, creator, invites = []) => {
    const room = {
        userData: new Map(), // Map to store user data
        name: _id,
        activeTeam: '',
    };
    room.userData.set(creator._id.toString(), userData(creator));
    for (let user of invites) {
        room.userData.set(user._id.toString(), userData(user));
    }
    return room;
};

export const userData = ({
    _id,
    name,
    email,
    avatar,
    status,
    mobilePhone,
    workPhone,
    reply = 'accept',
}) => ({
    _id,
    name,
    email,
    avatar,
    status,
    mobilePhone,
    workPhone,
    reply,
    team: '',
    leader: false,
    socket: null,
});

export const getUserData = ({
    _id,
    name,
    email,
    avatar,
    status,
    team,
    leader,
    mobilePhone,
    workPhone,
    reply,
}) => ({
    _id,
    name,
    email,
    avatar,
    status,
    mobilePhone,
    workPhone,
    reply,
    team,
    leader,
});

export const initUserRoom = async (fastify) => {
    try {
        const doucments = await DocumentModel.find({}).populate('creator');
        doucments.forEach(({ _id, creator, invites }) => {
            const room = createRoom(_id, creator, invites);
            fastify.appData.userrooms.set(_id.toString(), room);
        });
    } catch (error) {
        console.log(error);
    }
};

export const broadcastToDoc = (room) => {
    let users = [];
    for (let userData of room.userData.values()) {
        users.push(getUserData(userData));
    }
    for (let userData of room.userData.values()) {
        if (userData.socket)
            (async () => {
                try {
                    userData.socket.send(
                        JSON.stringify({
                            type: 'userslist',
                            users,
                            active: room.activeTeam,
                        }),
                    );
                } catch (error) {
                    console.log('socket error: ', error);
                }
            })();
    }
};
