import { handleNewTeam } from '../controllers/document.js';
import DocumentModel from '../models/Document.js';
import NotificationModel from '../models/Notification.js';
import { HTTP_RES_CODE, NOTIFICATION_TYPES } from '../shared/constants.js';
import { nameSentence } from '../shared/helpers.js';

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
                active: room.activeTeam,
                blocked: room.blockTeams,
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
            setTimeout(() => {
                sendMyOnlineStatusToTeam(room, userId);
            }, 100);
        } else {
            console.log('close');
            client.close();
        }

        client.on('message', (message) => {
            const data = JSON.parse(message.toString());
            switch (data.type) {
                case 'set-active':
                    room.activeTeam = data.team;
                    broadcastToDocActiveTeam(room);
                    break;
                case 'set-block':
                    room.blockTeams = [...room.blockTeams, data.team];
                    broadcastToDocBlockedTeam(room);
                    break;
                case 'remove-block':
                    room.blockTeams = room.blockTeams.filter(
                        (item) => item !== data.team,
                    );
                    broadcastToDocBlockedTeam(room);
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
                case 'add-new-team':
                    if (!data.teamLeader) break;
                    handleNewTeam(
                        roomId,
                        room,
                        data.teamLeader,
                        data.teamName,
                        data.user,
                    );
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
                            for (let userData of room.userData.values()) {
                                if (userData.team === data.oldTeam)
                                    room.userData.set(userData._id.toString(), {
                                        ...userData,
                                        team: data.newTeam,
                                        leader: false,
                                    });
                            }
                            broadcastToDoc(room);
                        } catch (error) {
                            console.log(error);
                        }
                    })();
                    break;
                case 'delete-team':
                    (async () => {
                        try {
                            const doc = await DocumentModel.findById(roomId);
                            doc.invites = doc.invites.filter(
                                (invite) => invite.team !== data.oldTeam,
                            );
                            await doc.save();
                            let notis = [];
                            let names = [];
                            for (let userData of room.userData.values()) {
                                if (userData.team === data.oldTeam) {
                                    notis.push({
                                        to: userData._id,
                                        type: NOTIFICATION_TYPES.DOCUMENT_INVITE_DELETE,
                                        data: [
                                            {
                                                text: 'Deleted: ',
                                                variant: 'subtitle1',
                                            },
                                            {
                                                text:
                                                    data.me.name === userId
                                                        ? 'Your team'
                                                        : 'You',
                                                variant: 'subtitle1',
                                            },
                                            {
                                                text: ` were deleted by `,
                                            },
                                            {
                                                text:
                                                    data.me.name === userId
                                                        ? 'You'
                                                        : data.me.name,
                                                variant: 'subtitle1',
                                            },
                                            { text: '<br/>' },
                                            { text: 'Document: ' },
                                            { text: doc.name },
                                        ],
                                        redirect: doc._id,
                                    });
                                    if (data.me.name !== userId)
                                        names.push(userData.name);
                                    room.userData.delete(
                                        userData._id.toString(),
                                    );
                                }
                            }
                            if (names.length !== 0) {
                                notis.push({
                                    to: userId,
                                    type: NOTIFICATION_TYPES.DOCUMENT_INVITE_DELETE,
                                    data: [
                                        {
                                            text: 'Deleted: ',
                                            variant: 'subtitle1',
                                        },
                                        {
                                            text: nameSentence(names),
                                            variant: 'subtitle1',
                                        },
                                        {
                                            text: ` ${
                                                names.length === 1
                                                    ? 'was'
                                                    : 'were'
                                            } deleted by `,
                                        },
                                        { text: 'You', variant: 'subtitle1' },
                                        { text: '<br/>' },
                                        { text: 'Document: ' },
                                        { text: doc.name },
                                    ],
                                    redirect: doc._id,
                                });
                            }
                            NotificationModel.insertMany(notis);
                            broadcastToDoc(room);
                        } catch (error) {
                            console.log(error);
                        }
                    })();
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
            setTimeout(() => {
                sendMyOnlineStatusToTeam(room, userId, 'offline');
            }, 100);
        });
    });
    done();
};

export default usersRoom;

//  call when init the app
export const createRoom = (_id, team = 'authoring', creator, invites = []) => {
    const room = {
        userData: new Map(), // Map to store user data
        name: _id,
        activeTeam: team,
        blockTeams: [],
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

//  when create a new document
export const createRoom1 = (_id, team = 'authoring', creator, invites = []) => {
    const room = {
        userData: new Map(), // Map to store user data
        name: _id,
        activeTeam: team,
        blockTeams: [],
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
    mailStatus = false,
    reply = 'pending',
    leader = false,
    team = 'authoring',
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
        mailStatus,
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
    mailStatus,
    reply,
    invitor,
    socket,
}) => ({
    _id,
    name,
    email,
    mailStatus,
    avatar,
    status,
    mobilePhone,
    workPhone,
    reply,
    team,
    leader,
    invitor,
    online_status: socket ? 'available' : 'offline',
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
    let users = [];
    let leaders = [];
    let emails = [];
    let invitedUsers = [];
    for (let userData of room.userData.values()) {
        emails.push(userData.email);
        invitedUsers.push(getUserData(userData));
        if (userData.leader) leaders.push(getUserData(userData));
        if (users[userData.team] && users[userData.team].length) {
            users[userData.team].push(getUserData(userData));
        } else {
            users[userData.team] = [getUserData(userData)];
        }
    }
    for (let userData of room.userData.values()) {
        if (userData.socket) {
            userData.socket.send(
                JSON.stringify({
                    type: 'userslistWithTeam',
                    users: users[userData.team],
                    emails,
                    leaders,
                    invitedUsers: invitedUsers.filter(
                        (item) => item.invitor === userData._id.toString(),
                    ),
                    active: room.activeTeam,
                    blocked: room.blockTeams,
                }),
            );
        }
    }
};

export const broadcastToDocActiveTeam = (room) => {
    for (let userData of room.userData.values()) {
        if (userData.socket) {
            userData.socket.send(
                JSON.stringify({
                    type: 'active-team',
                    active: room.activeTeam,
                }),
            );
        }
    }
};

export const broadcastToDocBlockedTeam = (room) => {
    for (let userData of room.userData.values()) {
        if (userData.socket) {
            userData.socket.send(
                JSON.stringify({
                    type: 'block-team',
                    blocked: room.blockTeams,
                }),
            );
        }
    }
};

export const sendMyOnlineStatusToTeam = (
    room,
    userId,
    online_status = 'available',
) => {
    const user = room.userData.get(userId);
    if (!user) return;
    for (let userData of room.userData.values()) {
        if (userData.team === user.team && userData.socket) {
            (async () => {
                try {
                    userData.socket.send(
                        JSON.stringify({
                            type: 'online-status',
                            user: { _id: userId, online_status },
                        }),
                    );
                } catch (error) {
                    console.log('socket error: ', error);
                }
            })();
        }
    }
};

export const sendOnlineStatusToTeam = (room, userId) => {
    const user = room.userData.get(userId);
    if (!user) return;
    let users = [];
    for (let userData of room.userData.values()) {
        if (userData.team === user.team && userData.socket)
            users.push(userData.email);
    }
    for (let userData of room.userData.values()) {
        if (userData.team === user.team && userData.socket) {
            (async () => {
                try {
                    userData.socket.send(
                        JSON.stringify({
                            type: 'online-status',
                            users,
                        }),
                    );
                } catch (error) {
                    console.log('socket error: ', error);
                }
            })();
        }
    }
};

export const sendTeamDataToMe = (room, userId) => {
    const { team, socket } = room.userData.get(userId);
    if (!team || !socket) return;
    let users = [];
    let leaders = [];
    let emails = [];
    let invitedUsers = [];
    for (let userData of room.userData.values()) {
        emails.push(userData.email);
        if (userData.team === team) users.push(getUserData(userData));
        if (userData.invitor === userId)
            invitedUsers.push(getUserData(userData));
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
                    invitedUsers,
                    active: room.activeTeam,
                    blocked: room.blockTeams,
                }),
            );
        } catch (error) {
            console.log('socket error: ', error);
        }
    })();
};
