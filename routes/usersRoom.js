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
        client.on('message', (message) => {
            const data = JSON.parse(message.toString());
            switch (data.type) {
                case 'new-team':
                    if (Rooms.has(roomId)) {
                        const room = Rooms.get(roomId);
                        for (let user of room.userData.values()) {
                            room.userData.set(user._id.toString(), {
                                ...user,
                                team: data.value.includes(user.email)
                                    ? data.name
                                    : user.team,
                                leader: user._id === userId || user.leader,
                            });
                        }
                        broadcastToDoc(room);
                    }
                    break;
                default:
                    break;
            }
        });

        client.on('close', () => {
            if (Rooms.has(roomId)) {
                const room = Rooms.get(roomId);
                room.userData.set(userId, {
                    ...room.userData.get(userId),
                    socket: null,
                });
            }
        });

        if (Rooms.has(roomId)) {
            const room = Rooms.get(roomId);
            let users = [];
            room.userData.set(userId, {
                ...room.userData.get(userId),
                socket: client,
            });
            for (let userData of room.userData.values()) {
                users.push(getUserData(userData));
            }
            client.send(JSON.stringify({ type: 'userslist', users }));
        }
    });
    done();
};

export default usersRoom;

export const getUserData = ({
    _id,
    name,
    email,
    avatar,
    status,
    team,
    leader,
    reply,
}) => ({ _id, name, email, avatar, status, team, leader, reply });

export const broadcastToDoc = (room) => {
    let users = [];
    for (let userData of room.userData.values()) {
        users.push(getUserData(userData));
    }
    for (let userData of room.userData.values()) {
        if (userData.socket)
            userData.socket.send(JSON.stringify({ type: 'userslist', users }));
    }
};
