import {
    HTTP_RES_CODE,
    MESSAGE_TYPES,
    NOTIFICATION_STATUS,
    NOTIFICATION_TYPES,
    USER_STATUS,
} from '../shared/constants.js';
import {
    compareArrays,
    datetime,
    generateSecretString,
    nameSentence,
    sendInvitationEmailToExist,
    sendInvitationEmailToNew,
    sendInvitationEmailToUser,
    sendInvitationToMail,
} from '../shared/helpers.js';
import DocumentModel from '../models/Document.js';
import MessageModel from '../models/Message.js';
import NotificationModel from '../models/Notification.js';
import InviteModel from '../models/invite.js';
import { broadcastToDoc, createRoom1, userData } from '../routes/usersRoom.js';

export const update = (Rooms) => async (request, reply) => {
    const { uniqueId } = request.params;
    const { name, description, invites, a, r } = request.body;
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
        document.invites = invites.map((item) => ({
            ...item,
            mailStatus: item.mailStatus || document.emailMethod === 'automatic',
        }));
        await document.save();
        if (Rooms.has(document._id.toString())) {
            const room = Rooms.get(document._id.toString());
            for (let contributor of a) {
                room.userData.set(
                    contributor._id.toString(),
                    userData({
                        ...contributor,
                        mailStatus:
                            contributor.mailStatus ||
                            document.emailMethod === 'automatic',
                    }),
                );
            }
            for (let contributor of r) {
                room.userData.delete(contributor._id.toString());
            }
            broadcastToDoc(room);
        }
        let _invites = [];
        let _notifications = [];
        if (a.length !== 0) {
            let k = 0;
            for (let contributor of a) {
                k++;
                if (contributor.status === USER_STATUS.INVITED) {
                    const token = generateSecretString(
                        request.user.email,
                        contributor.email,
                        document._id,
                    );
                    _invites.push({
                        creator: request.user,
                        contributor,
                        document,
                        token,
                    });
                    if (document.emailMethod === 'automatic') {
                        setTimeout(() => {
                            sendInvitationEmailToNew(
                                request.user,
                                contributor,
                                document,
                                token,
                            );
                        }, k * 1000);
                    }
                } else {
                    if (document.emailMethod === 'automatic') {
                        setTimeout(() => {
                            sendInvitationEmailToExist(
                                request.user,
                                contributor,
                                document,
                            );
                        }, k * 1000);
                    }
                    _notifications.push({
                        to: contributor._id,
                        type: NOTIFICATION_TYPES.DOCUMENT_INVITE_RECEIVE,
                        redirect: document._id,
                        data: [
                            { text: 'Invited: ', variant: 'subtitle1' },
                            { text: 'You', variant: 'subtitle1' },
                            { text: ` were received by ` },
                            {
                                text: request.user.name,
                                variant: 'subtitle1',
                            },
                            { text: '<br/>' },
                            { text: 'Document: ' },
                            { text: document.name },
                        ],
                    });
                }
            }
            _notifications.push({
                to: request.user._id,
                type: NOTIFICATION_TYPES.DOCUMENT_INVITE_SEND,
                data: [
                    { text: 'Invited: ', variant: 'subtitle1' },
                    {
                        text: nameSentence(a.map((item) => item.name)),
                        variant: 'subtitle1',
                    },
                    {
                        text: ` ${
                            a.length === 1 ? 'was' : 'were'
                        } received by `,
                    },
                    { text: 'You', variant: 'subtitle1' },
                    { text: '<br/>' },
                    { text: 'Document: ' },
                    { text: document.name },
                ],
                redirect: document._id,
            });
        }
        if (r.length !== 0) {
            for (let contributor of r) {
                _notifications.push({
                    to: contributor._id,
                    type: NOTIFICATION_TYPES.DOCUMENT_INVITE_DELETE,
                    redirect: document._id,
                    data: [
                        { text: 'Deleted: ', variant: 'subtitle1' },
                        {
                            text: 'You',
                            variant: 'subtitle1',
                        },
                        {
                            text: ` were deleted by `,
                        },
                        {
                            text: request.user.name,
                            variant: 'subtitle1',
                        },
                        { text: '<br/>' },
                        { text: 'Document: ' },
                        { text: document.name },
                    ],
                });
            }
            _notifications.push({
                to: request.user._id,
                type: NOTIFICATION_TYPES.DOCUMENT_INVITE_DELETE,
                status: NOTIFICATION_STATUS.UNREAD,
                data: [
                    { text: 'Deleted: ', variant: 'subtitle1' },
                    {
                        text: nameSentence(r.map((item) => item.name)),
                        variant: 'subtitle1',
                    },
                    {
                        text: ` ${r.length === 1 ? 'was' : 'were'} deleted by `,
                    },
                    { text: 'You', variant: 'subtitle1' },
                    { text: '<br/>' },
                    { text: 'Document: ' },
                    { text: document.name },
                ],
                redirect: document._id,
            });
        }
        if (_invites.length) {
            InviteModel.insertMany(_invites);
        }
        if (_notifications.length) {
            NotificationModel.insertMany(_notifications);
        }

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
};

export const create = (Rooms) => async (request, reply) => {
    const { name, description, team, invites, emailMethod } = request.body;
    try {
        const newDoc = await DocumentModel({
            name,
            description,
            team,
            invites: invites.map((item) => ({
                ...item,
                mailStatus: emailMethod === 'automatic',
                invitor: request.user._id.toString(),
            })),
            emailMethod,
            creator: request.user._id,
        }).save();
        //  if want to invite users
        const room = createRoom1(
            newDoc._id,
            team,
            request.user,
            invites.map((item) => ({
                ...item,
                mailStatus: emailMethod === 'automatic',
                invitor: request.user._id.toString(),
            })),
        );
        Rooms.set(newDoc._id.toString(), room);
        let _notifications = [];
        if (invites.length) {
            let _invites = [];
            let nonActiveUsers = []; //  used for get non active users from the invites
            let k = 0;
            for (let contributor of invites) {
                k++;
                if (contributor.status === USER_STATUS.INVITED) {
                    const token = generateSecretString(
                        request.user.email,
                        contributor.email,
                        newDoc._id,
                    );
                    _invites.push({
                        creator: request.user,
                        contributor,
                        document: newDoc,
                        token,
                    });
                    if (emailMethod === 'automatic') {
                        setTimeout(() => {
                            sendInvitationEmailToNew(
                                request.user,
                                contributor,
                                newDoc,
                                token,
                            );
                        }, k * 1000);
                    }
                } else {
                    if (emailMethod === 'automatic') {
                        setTimeout(() => {
                            sendInvitationEmailToExist(
                                request.user,
                                contributor,
                                newDoc,
                            );
                        }, k * 1000);
                    }
                    if (contributor.status !== USER_STATUS.ACTIVE) {
                        nonActiveUsers.push(contributor);
                    }
                    _notifications.push({
                        to: contributor._id,
                        type: NOTIFICATION_TYPES.DOCUMENT_INVITE_RECEIVE,
                        redirect: newDoc._id,
                        data: [
                            { text: 'Invited: ', variant: 'subtitle1' },
                            { text: 'You', variant: 'subtitle1' },
                            { text: ` were received by ` },
                            {
                                text: request.user.name,
                                variant: 'subtitle1',
                            },
                            { text: '<br/>' },
                            { text: 'Document: ' },
                            { text: newDoc.name },
                        ],
                    });
                }
            }
            _notifications.push({
                to: request.user._id,
                type: NOTIFICATION_TYPES.DOCUMENT_INVITE_SEND,
                data: [
                    { text: 'Invited: ', variant: 'subtitle1' },
                    {
                        text: nameSentence(invites.map((item) => item.name)),
                        variant: 'subtitle1',
                    },
                    {
                        text: ` ${
                            invites.length === 1 ? 'was' : 'were'
                        } received by `,
                    },
                    { text: 'You', variant: 'subtitle1' },
                    { text: '<br/>' },
                    { text: 'Document: ' },
                    { text: newDoc.name },
                ],
                redirect: newDoc._id,
            });
            if (_invites.length) {
                InviteModel.insertMany(_invites);
            }
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
        _notifications.push({
            to: 'admin',
            type: NOTIFICATION_TYPES.DOCUMENT_CREATE_NEW,
            data: [
                { text: 'New Document: ', variant: 'subtitle1' },
                {
                    text: request.user.name,
                    variant: 'subtitle1',
                },
                {
                    text: ` create a new document. `,
                },
                { text: '<br/>' },
                { text: 'Document: ' },
                { text: newDoc.name },
            ],
            redirect: newDoc._id,
        });
        if (_notifications.length) {
            NotificationModel.insertMany(_notifications);
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
};

export const clearInvite = (Rooms) => async (request, reply) => {
    const { invites } = request.body;
    try {
        const newDoc = await DocumentModel.findById(request.params.uniqueId);
        newDoc.invites = compareArrays(newDoc.invites, invites, 'email');
        await newDoc.save();
        if (Rooms.has(newDoc._id.toString())) {
            const room = Rooms.get(newDoc._id.toString());
            for (let contributor of invites) {
                room.userData.delete(contributor._id);
            }
            broadcastToDoc(room);
        }
        let _notifications = [];
        for (let contributor of invites) {
            _notifications.push({
                to: contributor._id,
                type: NOTIFICATION_TYPES.DOCUMENT_INVITE_DELETE,
                redirect: newDoc._id,
                data: [
                    { text: 'Deleted: ', variant: 'subtitle1' },
                    {
                        text: 'You',
                        variant: 'subtitle1',
                    },
                    {
                        text: ` were deleted by `,
                    },
                    { text: request.user.name, variant: 'subtitle1' },
                    { text: '<br/>' },
                    { text: 'Document: ' },
                    { text: newDoc.name },
                ],
            });
        }
        _notifications.push({
            to: request.user._id,
            type: NOTIFICATION_TYPES.DOCUMENT_INVITE_DELETE,
            status: NOTIFICATION_STATUS.UNREAD,
            data: [
                { text: 'Deleted: ', variant: 'subtitle1' },
                {
                    text: nameSentence(invites.map((item) => item.name)),
                    variant: 'subtitle1',
                },
                {
                    text: ` ${
                        invites.length === 1 ? 'was' : 'were'
                    } deleted by `,
                },
                { text: 'You', variant: 'subtitle1' },
                { text: '<br/>' },
                { text: 'Document: ' },
                { text: newDoc.name },
            ],
            redirect: newDoc._id,
        });

        if (_notifications.length) {
            NotificationModel.insertMany(_notifications);
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
};

export const setInvite = (Rooms) => async (request, reply) => {
    const { invites, team } = request.body;
    try {
        const newDoc = await DocumentModel.findById(request.params.uniqueId);
        newDoc.invites = [
            ...newDoc.invites,
            ...invites.map((item) => ({
                ...item,
                invitor: request.user._id,
                mailStatus: newDoc.emailMethod === 'automatic',
                team,
            })),
        ];
        newDoc.save();
        if (Rooms.has(newDoc._id.toString())) {
            const room = Rooms.get(newDoc._id.toString());
            for (let contributor of invites) {
                room.userData.set(
                    contributor._id.toString(),
                    userData({
                        ...contributor,
                        team,
                        invitor: request.user._id.toString(),
                        mailStatus: newDoc.emailMethod === 'automatic',
                    }),
                );
            }
            broadcastToDoc(room);
        }
        let nonActiveUsers = [];
        let k = 0;
        let _invites = [];
        let _notifications = [];
        for (let contributor of invites) {
            k++;
            if (contributor.status === USER_STATUS.INVITED) {
                //  send invitation email to manually created user
                const token = generateSecretString(
                    request.user.email,
                    contributor.email,
                    newDoc._id,
                );
                _invites.push({
                    creator: request.user,
                    contributor,
                    document: newDoc,
                    token,
                });
                //  send email to invited user who are not registered yet.
                //  sending email part must be in setTimeout because that cause error.
                if (newDoc.emailMethod === 'automatic') {
                    setTimeout(() => {
                        sendInvitationEmailToNew(
                            request.user,
                            contributor,
                            newDoc,
                            token,
                        );
                    }, k * 1000);
                }
            } else {
                if (contributor.status !== USER_STATUS.ACTIVE) {
                    nonActiveUsers.push(contributor);
                }
                //  send email to exist user to join the document.
                if (newDoc.emailMethod === 'automatic') {
                    setTimeout(() => {
                        sendInvitationEmailToExist(
                            request.user,
                            contributor,
                            newDoc,
                        );
                    }, k * 1000);
                }
                //  send notification to users who are invited whether those status are not active
                _notifications.push({
                    to: contributor._id,
                    type: NOTIFICATION_TYPES.DOCUMENT_INVITE_RECEIVE,
                    redirect: newDoc._id,
                    data: [
                        { text: 'Invited: ', variant: 'subtitle1' },
                        { text: 'You', variant: 'subtitle1' },
                        { text: ` were received by ` },
                        {
                            text: request.user.name,
                            variant: 'subtitle1',
                        },
                        { text: '<br/>' },
                        { text: 'Document: ' },
                        { text: newDoc.name },
                    ],
                });
            }
        }
        const flagMe =
            newDoc.creator.toString() !== request.user._id.toString();
        if (invites.length !== 0) {
            //  send a notification to creator to wait his contributors to join
            _notifications.push({
                to: request.user._id,
                type: NOTIFICATION_TYPES.DOCUMENT_INVITE_SEND,
                data: [
                    { text: 'Invited: ', variant: 'subtitle1' },
                    {
                        text: nameSentence(invites.map((item) => item.name)),
                        variant: 'subtitle1',
                    },
                    {
                        text: ` ${
                            invites.length === 1 ? 'was' : 'were'
                        } received by `,
                    },
                    { text: 'You', variant: 'subtitle1' },
                    { text: '<br/>' },
                    { text: 'Document: ' },
                    { text: newDoc.name },
                ],
                redirect: newDoc._id,
            });
            if (flagMe)
                _notifications.push({
                    to: newDoc.creator,
                    type: NOTIFICATION_TYPES.DOCUMENT_INVITE_SEND,
                    data: [
                        { text: 'Invited: ', variant: 'subtitle1' },
                        {
                            text: nameSentence(
                                invites.map((item) => item.name),
                            ),
                            variant: 'subtitle1',
                        },
                        {
                            text: ` ${
                                invites.length === 1 ? 'was' : 'were'
                            } received by `,
                        },
                        {
                            text: `${request.user.name}(${request.user.email})`,
                            variant: 'subtitle1',
                        },
                        { text: '<br/>' },
                        { text: 'Document: ' },
                        { text: newDoc.name },
                    ],
                    redirect: newDoc._id,
                });
        }
        if (_invites.length) {
            InviteModel.insertMany(_invites);
        }
        if (_notifications.length) {
            NotificationModel.insertMany(_notifications);
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
};

export const handleInvite = (Rooms) => async (request, reply) => {
    const { id, status, leader } = request.body;
    try {
        let doc = await DocumentModel.findById(id);
        let flag = false;
        for (let invite of doc.invites) {
            if (
                invite._id.toString() === request.user._id.toString() &&
                invite.reply === 'pending'
            ) {
                flag = true;
                break;
            }
        }
        if (flag) {
            doc.invites =
                status === 'accept'
                    ? doc.invites.map((invite) => ({
                          ...invite,
                          reply:
                              invite._id.toString() ===
                              request.user._id.toString()
                                  ? 'accept'
                                  : invite.reply,
                      }))
                    : doc.invites.filter(
                          (invite) =>
                              invite._id.toString() !==
                              request.user._id.toString(),
                      );
            await doc.save();

            if (Rooms.has(doc._id.toString())) {
                const room = Rooms.get(doc._id.toString());
                if (status === 'accept')
                    room.userData.set(
                        request.user._id.toString(),
                        userData({
                            ...room.userData.get(request.user._id.toString()),
                            reply: 'accept',
                        }),
                    );
                else {
                    room.userData.delete(request.user._id.toString());
                }
                broadcastToDoc(room);
            }

            NotificationModel({
                to: leader || doc.creator,
                type:
                    status === 'accept'
                        ? NOTIFICATION_TYPES.DOCUMENT_INVITE_ACCEPT
                        : NOTIFICATION_TYPES.DOCUMENT_INVITE_REJECT,
                data: [
                    {
                        text: `${
                            status === 'accept' ? 'Accepted' : 'Rejected'
                        }: `,
                        variant: 'subtitle1',
                    },
                    { text: request.user.name, variant: 'subtitle1' },
                    {
                        text: ` ${
                            status === 'accept' ? 'accepted' : 'rejected'
                        } invitation at `,
                    },
                    { text: datetime(), variant: 'subtitle1' },
                    { text: '<br/>' },
                    { text: 'Document: ' },
                    { text: doc.name },
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
};

export const handleNewTeam = async (
    uniqueId,
    room,
    teamLeader,
    teamName,
    user,
) => {
    try {
        //  get doc
        const newDoc = await DocumentModel.findById(uniqueId);
        newDoc.invites = [
            ...newDoc.invites,
            userData({
                ...teamLeader,
                leader: true,
                team: teamName,
                invitor: user._id.toString(),
            }),
        ];
        //  set new contributor
        await newDoc.save();
        //  handle rooms / broadcast
        // if (Rooms.has(newDoc._id.toString())) {
        //     const room = Rooms.get(newDoc._id.toString());
        room.userData.set(
            teamLeader._id,
            userData({
                ...teamLeader,
                leader: true,
                team: teamName,
                invitor: user._id.toString(),
            }),
        );
        broadcastToDoc(room);
        // }
        //  send invitation email to the new user
        setTimeout(() => {
            sendInvitationEmailToExist(user, teamLeader, newDoc);
        }, 1000);
        //  handle notifications
        let _notifications = [];
        //  send contriubtor
        _notifications.push({
            to: teamLeader._id,
            type: NOTIFICATION_TYPES.DOCUMENT_INVITE_RECEIVE,
            redirect: newDoc._id,
            data: [
                { text: 'Invited: ', variant: 'subtitle1' },
                { text: 'You', variant: 'subtitle1' },
                { text: ` were received by ` },
                {
                    text: user.name,
                    variant: 'subtitle1',
                },
                { text: '<br/>' },
                { text: 'Document: ' },
                { text: newDoc.name },
            ],
        });
        //  send to me
        _notifications.push({
            to: user._id,
            type: NOTIFICATION_TYPES.DOCUMENT_INVITE_SEND,
            data: [
                { text: 'Invited: ', variant: 'subtitle1' },
                {
                    text: teamLeader.name,
                    variant: 'subtitle1',
                },
                {
                    text: ` was received by `,
                },
                { text: 'You', variant: 'subtitle1' },
                { text: '<br/>' },
                { text: 'Document: ' },
                { text: newDoc.name },
            ],
            redirect: newDoc._id,
        });
        //  if I is not creator send to craetor
        if (newDoc.creator.toString() !== user._id.toString())
            _notifications.push({
                to: newDoc.creator,
                type: NOTIFICATION_TYPES.DOCUMENT_INVITE_SEND,
                data: [
                    { text: 'Invited: ', variant: 'subtitle1' },
                    {
                        text: teamLeader.name,
                        variant: 'subtitle1',
                    },
                    {
                        text: ` was received by `,
                    },
                    {
                        text: `${user.name}(${user.email})`,
                        variant: 'subtitle1',
                    },
                    { text: '<br/>' },
                    { text: 'Document: ' },
                    { text: newDoc.name },
                ],
                redirect: newDoc._id,
            });
        //  save notifications
        NotificationModel.insertMany(_notifications);
        //  if the contributor is nonactive user, send admin to resolve this
        if (teamLeader.status !== 'active' && teamLeader.status !== 'invited') {
            MessageModel({
                from: user,
                to: 'admin',
                data: [
                    { text: 'I', variant: 'subtitle1' },
                    {
                        text: ' invited some contributors who are not active now. Please resolve this.',
                    },
                ],
                type: MESSAGE_TYPES.DOCUMENT_INVITE_RESOLVE,
                attachment: JSON.stringify([teamLeader]),
            }).save();
        }
        // return reply.send({
        //     code: HTTP_RES_CODE.SUCCESS,
        //     data: {},
        //     message: '',
        // });
    } catch (e) {
        console.log('document@create-room-error:', e);
        // return reply.code(500).send({
        //     code: HTTP_RES_CODE.ERROR,
        //     data: {},
        //     message: 'Unexpected Server Error Occured.',
        // });
    }
};

export const handleInvitation = (Rooms) => async (request, reply) => {
    const { uniqueId } = request.params;
    const { team, invitor, leader } = request.body;
    try {
        let doc = await DocumentModel.findById(uniqueId);
        doc.invites = [
            ...doc.invites,
            { ...request.user, team, invitor, leader: false, reply: 'accept' },
        ];
        await doc.save();

        if (Rooms.has(doc._id.toString())) {
            const room = Rooms.get(doc._id.toString());
            room.userData.set(
                request.user._id.toString(),
                userData({
                    ...request.user,
                    invitor,
                    team,
                    reply: 'accept',
                }),
            );
            broadcastToDoc(room);
        }

        NotificationModel({
            to: leader || doc.creator,
            type: NOTIFICATION_TYPES.DOCUMENT_INVITE_ACCEPT,
            data: [
                {
                    text: 'Accepted',
                    variant: 'subtitle1',
                },
                { text: request.user.name, variant: 'subtitle1' },
                { text: ' accepted invitation at ' },
                { text: datetime(), variant: 'subtitle1' },
                { text: '<br/>' },
                { text: 'Document: ' },
                { text: doc.name },
            ],
            redirect: doc._id,
        }).save();

        return reply.send({
            code: HTTP_RES_CODE.SUCCESS,
            data: {},
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
};

export const setInvitation = async (request, reply) => {
    const { uniqueId } = request.params;
    const { text, invites, emails } = request.body;
    try {
        let doc = await DocumentModel.findById(uniqueId);
        let messages = [];
        for (let invite of invites) {
            messages.push({
                from: request.user,
                to: invite,
                type: MESSAGE_TYPES.DOCUMENT_INVITATION_SEND,
                redirect: text,
                data: [
                    { text: request.user.name, variant: 'subtitle1' },
                    { text: ' send invitation at ' },
                    { text: datetime(), variant: 'subtitle1' },
                    { text: '<br/>' },
                    { text: 'Document: ' },
                    { text: doc.name },
                ],
            });
        }
        await MessageModel.insertMany(messages);
        setTimeout(() => {
            sendInvitationToMail(request.user, doc, emails, text);
        });

        return reply.send({
            code: HTTP_RES_CODE.SUCCESS,
            data: {},
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
};

export const sendEmailToInvitors = (Rooms) => async (request, reply) => {
    const { uniqueId } = request.params;
    const { invites } = request.body;
    try {
        let doc = await DocumentModel.findById(uniqueId);
        doc.invites = doc.invites.map((item) => ({
            ...item,
            mailStatus: invites.includes(item._id.toString())
                ? true
                : item.mailStatus,
        }));
        await doc.save();

        if (Rooms.has(doc._id.toString())) {
            const room = Rooms.get(doc._id.toString());
            let x = false;
            for (let inv of invites) {
                if (inv && typeof inv === 'string') {
                    x = true;
                    room.userData.set(
                        inv,
                        userData({
                            ...room.userData.get(inv),
                            mailStatus: true,
                        }),
                    );
                }
            }
            if (x) broadcastToDoc(room);
        }

        return reply.send({
            code: HTTP_RES_CODE.SUCCESS,
            data: {},
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
};

export const sendEmailToInvitor = (Rooms) => async (request, reply) => {
    const { uniqueId } = request.params;
    const { to } = request.body;
    try {
        let doc = await DocumentModel.findById(uniqueId);
        doc.invites = doc.invites.map((item) => ({
            ...item,
            mailStatus: to._id === item._id ? true : item.mailStatus,
        }));
        await doc.save();

        if (Rooms.has(doc._id.toString())) {
            const room = Rooms.get(doc._id.toString());
            room.userData.set(
                to._id,
                userData({
                    ...room.userData.get(to._id),
                    mailStatus: true,
                }),
            );
            broadcastToDoc(room);
        }

        setTimeout(() => {
            sendInvitationEmailToUser(request.user, to, doc);
        });

        return reply.send({
            code: HTTP_RES_CODE.SUCCESS,
            data: {},
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
};
