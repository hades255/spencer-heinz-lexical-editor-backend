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
} from '../shared/helpers.js';
import DocumentModel from '../models/Document.js';
import MessageModel from '../models/Message.js';
import NotificationModel from '../models/Notification.js';
import InviteModel from '../models/invite.js';

export const update = async (request, reply) => {
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
        document.invites = invites;
        await document.save();
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
                    setTimeout(() => {
                        sendInvitationEmailToNew(
                            request.user,
                            contributor,
                            document,
                            token,
                        );
                    }, k * 1000);
                } else {
                    setTimeout(() => {
                        sendInvitationEmailToExist(
                            request.user,
                            contributor,
                            document,
                        );
                    }, k * 1000);
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

export const create = async (request, reply) => {
    const { name, description, initialText, invites: ninvites } = request.body;
    const invites = ninvites.filter(
        (item) => item.email !== request.user.email,
    );
    try {
        const newDoc = await DocumentModel({
            name,
            description,
            initialText,
            invites: invites,
            creator: request.user._id,
        }).save();
        //  if want to invite users
        let _invites = [];
        let _notifications = [];
        if (invites.length) {
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
            if (_notifications.length) {
                NotificationModel.insertMany(_notifications);
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

export const clearInvite = async (request, reply) => {
    const { invites } = request.body;
    try {
        const newDoc = await DocumentModel.findById(request.params.uniqueId);
        newDoc.invites = compareArrays(newDoc.invites, invites, 'email');
        newDoc.save();
        let _notifications = [];
        for (let contributor of invites) {
            _notifications.push({
                to: contributor._id,
                type: NOTIFICATION_TYPES.DOCUMENT_INVITE_DELETE,
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

export const setInvite = async (request, reply) => {
    const { invites } = request.body;
    try {
        const newDoc = await DocumentModel.findById(request.params.uniqueId);
        newDoc.invites = [
            ...newDoc.invites,
            ...invites.map((item) => ({
                ...item,
                invitor: request.user,
            })),
        ];
        newDoc.save();
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

export const handleInvite = async (request, reply) => {
    const { id, status } = request.body;
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
            doc.invites = doc.invites.map((invite) => ({
                ...invite,
                reply:
                    invite._id.toString() === request.user._id.toString()
                        ? status
                        : invite.reply,
            }));
            await doc.save();

            NotificationModel({
                to: doc.creator._id,
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
                        } your invitation at `,
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
