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
                activeTeam: room.activeTeam,
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
            room.userData.set(userId, {
                ...room.userData.get(userId),
                socket: client,
            });
            sendTeamDataToMe(room, userId);
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
                case 'add-team':
                    (async () => {
                        try {
                            const doc = await DocumentModel.findById(roomId);
                            doc.invites = doc.invites.map((invite) => ({
                                ...invite,
                                leader:
                                    invite._id === data.teamLeader
                                        ? true
                                        : invite.leader,
                                team:
                                    invite._id === data.teamLeader
                                        ? data.teamName
                                        : invite.team,
                            }));
                            await doc.save();
                        } catch (error) {
                            console.log(error);
                        }
                    })();
                    room.userData.set(data.teamLeader, {
                        ...room.userData.get(data.teamLeader),
                        team: data.teamName,
                        leader: true,
                        invitor: userId,
                    });
                    broadcastToDoc(room);
                    break;
                case 'remove-team':
                    (async () => {
                        try {
                            const doc = await DocumentModel.findById(roomId);
                            doc.invites = doc.invites.map((invite) => ({
                                ...invite,
                                leader:
                                    invite.team === data.oldTeam
                                        ? false
                                        : invite.leader,
                                team:
                                    invite.team === data.oldTeam
                                        ? data.newTeam
                                        : invite.team,
                            }));
                            await doc.save();
                        } catch (error) {
                            console.log(error);
                        }
                    })();
                    for (let userData of room.userData.values()) {
                        if (userData.team === data.oldTeam)
                            room.userData.set(userData._id.toString(), {
                                ...userData,
                                team: data.newTeam,
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

export const createRoom = (_id, team = 'Init Team', creator, invites = []) => {
    const room = {
        userData: new Map(), // Map to store user data
        name: _id,
        activeTeam: team,
    };
    room.userData.set(
        creator._id.toString(),
        userData({
            ...creator._doc,
            leader: true,
            team,
            reply: 'creator',
        }),
    );
    for (let user of invites) {
        room.userData.set(user._id.toString(), userData({ ...user._doc }));
    }
    return room;
};

export const createRoom1 = (_id, team = 'Init Team', creator, invites = []) => {
    const room = {
        userData: new Map(), // Map to store user data
        name: _id,
        activeTeam: team,
    };
    room.userData.set(
        creator._id.toString(),
        userData({
            ...creator,
            leader: true,
            team,
            reply: 'creator',
        }),
    );
    for (let user of invites) {
        room.userData.set(user._id.toString(), userData({ ...user }));
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
    reply = 'pending',
    leader = false,
    team = 'Init Team',
    invitor = '',
}) => {
    return {
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
        socket: null,
        invitor,
    };
};

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
    invitor,
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
    invitor,
});

export const initUserRoom = async (fastify) => {
    try {
        const doucments = await DocumentModel.find({}).populate('creator');
        doucments.forEach(({ _id, team, creator, invites }) => {
            const room = createRoom(_id, team, creator, invites);
            fastify.appData.userrooms.set(_id.toString(), room);
        });
    } catch (error) {
        console.log(error);
    }
};

export const broadcastToDoc = (room) => {
    for (let userData of room.userData.values()) {
        if (userData.socket) {
            sendTeamDataToMe(room, userData._id.toString());
        }
    }
};

export const multicastToDoc = (room, user) => {
    const team = room.userData.get(user.tostring()).team;
    if (!team) return;
    let users = [];
    let leaders = [];
    for (let userData of room.userData.values()) {
        if (userData.team === team) users.push(getUserData(userData));
        if (userData.leader) leaders.push(getUserData(userData));
    }
    for (let userData of room.userData.values()) {
        if (userData.socket)
            (async () => {
                try {
                    userData.socket.send(
                        JSON.stringify({
                            type: 'userslist',
                            users,
                            leaders,
                            active: room.activeTeam,
                        }),
                    );
                } catch (error) {
                    console.log('socket error: ', error);
                }
            })();
    }
};

export const sendTeamDataToMe = (room, userId) => {
    const { team, socket } = room.userData.get(userId);
    if (!team || !socket) return;
    let users = [];
    let leaders = [];
    let emails = [];
    for (let userData of room.userData.values()) {
        emails.push(userData.email);
        if (userData.team === team) users.push(getUserData(userData));
        if (userData.leader) leaders.push(getUserData(userData));
    }
    (async () => {
        try {
            socket.send(
                JSON.stringify({
                    type: 'userslistWithTeam',
                    users,
                    emails,
                    leaders,
                    active: room.activeTeam,
                }),
            );
        } catch (error) {
            console.log('socket error: ', error);
        }
    })();
};
